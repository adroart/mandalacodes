import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const AR_ORIGIN = 'http://127.0.0.1:8841';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_AUDIO = 10 * 1024 * 1024;
const MAX_BODY = 15 * 1024 * 1024;
const SECTIONS = new Set(['CODE','ICHING','KEYS','DESIGN','BODY','RELATIONS']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const error = (message,status=400) => Object.assign(new Error(message),{status});
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
function identities(body) {
  if (!body || !UUID.test(body.sessionId||'') || !UUID.test(body.captureId||'')) throw error('This saved recording needs its original session and capture identity.');
  return `${body.sessionId}:${body.captureId}`;
}
function audioInput(body) {
  const key = identities(body);
  if (typeof body.audioBase64!=='string' || !body.audioBase64.length || body.audioBase64.length > Math.ceil(MAX_AUDIO/3)*4 || body.audioBase64.length%4 || /[^A-Za-z0-9+/=]/.test(body.audioBase64)) throw error('Choose valid audio up to 10 MiB.');
  const bytes = Buffer.from(body.audioBase64,'base64');
  if (!bytes.length || bytes.length>MAX_AUDIO || bytes.toString('base64')!==body.audioBase64) throw error('The audio encoding is invalid.');
  if (typeof body.mimeType!=='string' || !/^audio\/(?:webm|mp4|wav|mpeg|ogg|flac|aac)(?:;codecs=[\w., -]+)?$/.test(body.mimeType)) throw error('Choose a supported audio recording.');
  if (!Number.isFinite(body.durationMs) || body.durationMs<=0 || body.durationMs>1200000) throw error('Choose a recording up to 20 minutes.');
  if (body.sectionId!==null && !SECTIONS.has(body.sectionId)) throw error('Choose a known section or leave it unassigned.');
  return { key,bytes,hash:digest(bytes) };
}
function extension(mime) { return ({'audio/mp4':'m4a','audio/wav':'wav','audio/mpeg':'mp3','audio/ogg':'ogg','audio/flac':'flac','audio/aac':'aac'})[mime.split(';')[0]] || 'webm'; }
function normalizeResult(result,record) {
  if (!result || !Array.isArray(result.segments)) throw error('AR Create has not returned a usable transcript yet.',502);
  const sourceHash=result.metadata?.source_sha256;
  if(sourceHash!==undefined&&sourceHash!==record.audioHash)throw error('AR Create returned a transcript for different audio. The saved recording is preserved.',502);
  // AR's merge contract permits point-timed words (end == start), particularly
  // when exclusive diarization separates the last word from its previous group.
  // Such a group has no precise passage interval. Retain its real word offsets
  // and label the passage for whole-recording replay rather than inventing a span.
  const decodedMs=Number(result.metadata?.duration_seconds)*1000;
  const recordingDurationMs=Number.isFinite(decodedMs)&&decodedMs>0&&decodedMs<=1200000&&Math.abs(decodedMs-record.durationMs)<=1500&&sourceHash===record.audioHash
    ?Math.max(record.durationMs,Math.round(decodedMs)):record.durationMs;
  const segments=[];let recordingLevelPassages=false;
  for(const segment of result.segments) {
    const startMs=Math.round(Number(segment.start)*1000),endMs=Math.round(Number(segment.end)*1000);
    if(typeof segment.text!=='string'||!segment.text.trim())continue;
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<0||endMs<startMs||endMs>record.durationMs+1500)throw error('AR Create returned transcript timing outside this recording.',502);
    // Preserve actual provider offsets. Browser recording clocks can differ slightly
    // from decoded duration; expose that duration rather than inventing sub-times.
    const words=(Array.isArray(segment.words)?segment.words:[]).map(word=>({startMs:Math.round(Number(word.start)*1000),endMs:Math.round(Number(word.end)*1000),text:String(word.word??word.text??''),...(Number.isFinite(word.probability)?{probability:word.probability}:{})}));
    if(words.some(w=>!Number.isFinite(w.startMs)||!Number.isFinite(w.endMs)||w.startMs<0||w.endMs<w.startMs||w.startMs<startMs-1000||w.endMs>endMs+1000))throw error('AR Create returned invalid word alignment.',502);
    const pointTimed=endMs===startMs;
    if(pointTimed&&(endMs>recordingDurationMs||words.some(w=>w.startMs!==startMs||w.endMs!==endMs)))throw error('AR Create returned invalid point-word alignment for this recording.',502);
    if(pointTimed)recordingLevelPassages=true;
    segments.push({text:segment.text,startMs:pointTimed?0:startMs,endMs:pointTimed?recordingDurationMs:endMs,sectionId:record.sectionId,timing:pointTimed?'recording':'provider',...(typeof segment.speaker==='string'?{speaker:segment.speaker}:{}),...(words.length?{words}:{})});
  }
  if(!segments.length)throw error('AR Create found no speech in this recording. Your audio is retained.',422);
  return {provider:'AR Create · local Whisper',segments,durationMs:Math.max(record.durationMs,...segments.flatMap(s=>[s.endMs,...(s.words??[]).map(w=>w.endMs)])),arCreate:{sourceId:record.sourceId,jobId:record.jobId,reviewUrl:`${AR_ORIGIN}/transcription/${record.jobId}/view`,wordTimestamps:result.metadata?.word_timestamps??null,qualityFlags:Array.isArray(result.metadata?.quality_flags)?result.metadata.quality_flags:[],warnings:[...(Array.isArray(result.metadata?.warnings)?result.metadata.warnings.filter(w=>typeof w==='string'):[]),...(recordingLevelPassages?['A point-timed passage uses whole-recording replay; original provider word offsets are retained.']:[])]}};
}

/** Fixed local AR Create owner. No arbitrary URL, cookies, private config or source files. */
export function createArCreateBridge({stateDir=path.join(os.homedir(),'Library','Caches','mandalacodes','oracle-ar-create'),fetcher=globalThis.fetch,pendingBudgetMs=12000,pollIntervalMs=750}={}) {
  const active=new Map();
  async function upstream(route,body) {
    if(!route.startsWith('/')||route.startsWith('//'))throw error('Invalid AR Create route.');
    let response;
    try {response=await fetcher(AR_ORIGIN+route,{method:body===undefined?'GET':'POST',headers:body===undefined?{Accept:'application/json'}:{Accept:'application/json','Content-Type':'application/json','X-AR-Actor':'import:oracle','X-AR-Client':'http'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw error('AR Create is not reachable on this Mac. Your recording stays saved.',503);}
    let value;try{value=await response.json();}catch{throw error('AR Create returned an unreadable response. Your recording is saved.',502);}
    if(!response.ok)throw error(response.status===409?'AR Create is already processing this saved recording. Resume its status.':'AR Create could not complete this step. Your recording is retained.',response.status===409?409:502);
    return value;
  }
  async function capabilities() {
    const value=await upstream('/api/capabilities');
    const t=value.transcription;
    return {status:200,body:{service:'AR Create',ready:t?.ready===true,transcription:{ready:t?.ready===true,engine:t?.engine??'AR Create local transcription',problem:t?.ready?null:(typeof t?.problem==='string'?t.problem:'Local transcription is unavailable.'),wordTimestamps:true},phone:{direct:false,reason:'AR Create is local to this Mac. Private phone connectivity is not installed.'}}};
  }
  const recordPath=key=>path.join(stateDir,`${digest(key)}.json`);
  async function read(key) {try{return JSON.parse(await fs.readFile(recordPath(key),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw error('The saved AR Create connection needs recovery; no new upload was made.',409);}}
  async function write(record) {
    await fs.mkdir(stateDir,{recursive:true,mode:0o700});
    const target=recordPath(`${record.sessionId}:${record.captureId}`),temp=`${target}.${randomUUID()}.tmp`;
    const handle=await fs.open(temp,'wx',0o600);
    try{await handle.writeFile(JSON.stringify(record));await handle.sync();}finally{await handle.close();}
    await fs.rename(temp,target);
    const directory=await fs.open(stateDir,'r');try{await directory.sync();}finally{await directory.close();}
  }
  async function lock(key,work) {
    if(active.has(key))throw error('This recording is already being connected. Resume in a moment.',409);
    active.set(key,true);await fs.mkdir(stateDir,{recursive:true,mode:0o700});const file=recordPath(key)+'.lock';let held=false;
    try {
      try{await fs.writeFile(file,JSON.stringify({pid:process.pid}),{flag:'wx',mode:0o600});held=true;}catch(e){if(e.code!=='EEXIST')throw e;let owner;try{owner=JSON.parse(await fs.readFile(file,'utf8'));}catch{throw error('The existing connection lock needs recovery.',409);}let alive=true;try{process.kill(owner.pid,0);}catch{alive=false;}if(alive)throw error('This recording is already being connected. Resume in a moment.',409);await fs.unlink(file);await fs.writeFile(file,JSON.stringify({pid:process.pid}),{flag:'wx',mode:0o600});held=true;}
      return await work();
    }finally{active.delete(key);if(held)await fs.unlink(file).catch(()=>{});}
  }
  async function findJob(record) {
    if(record.jobId)return;
    // This is the existing AR API's sole source -> recording link. Filter the exact
    // newly imported source identity here; unrelated jobs never leave this function.
    const value=await upstream('/api/recordings');const matches=(value.jobs||[]).filter(job=>job.sourceId===record.sourceId);
    if(matches.length!==1||!UUID.test(matches[0].id||''))throw error('AR Create retained the audio but its recording link is not ready. No duplicate upload was made.',502);
    record.jobId=matches[0].id;record.phase='linked';await write(record);
  }
  async function progress(record) {
    if(record.phase==='complete')return {status:200,body:record.response};
    if(record.phase==='importing'||record.phase==='import-uncertain')throw error('The previous upload response was interrupted. Its audio may already be in AR Create; no duplicate upload will be made. Recover that connection before retrying.',409);
    await findJob(record);
    let value=await upstream(`/transcription/${record.jobId}`),job=value.job;
    if(!job||job.id!==record.jobId)throw error('AR Create returned a different recording identity.',502);
    if(job.state==='saved') {
      record.phase='starting';await write(record);
      try{await upstream(`/transcription/${record.jobId}/start`,{story:`${record.synthetic?'Synthetic Oracle test':'Oracle recording'} ${record.captureId}`});}catch(e){if(e.status!==409)throw e;}
      value=await upstream(`/transcription/${record.jobId}`);job=value.job;
    }
    if(job?.id!==record.jobId)throw error('AR Create returned a different recording identity.',502);
    if(job.state==='failed')throw error('AR Create could not transcribe this recording. It and your local audio are retained for recovery.',502);
    if(job.state==='done'&&job.transcriptReady===true&&value.result) {
      record.response=normalizeResult(value.result,record);record.phase='complete';await write(record);return {status:200,body:record.response};
    }
    record.phase='processing';await write(record);
    return {status:202,body:{pending:true,service:'AR Create',jobId:record.jobId,stage:typeof job.stage==='string'?job.stage:'processing'}};
  }
  async function handle(body) {
    try{
      if(body?.operation==='capabilities')return await capabilities();
      if(!['transcribe','transcription-status'].includes(body?.operation))throw error('Choose transcription or its saved status.');
      const key=identities(body),input=body.operation==='transcribe'?audioInput(body):null;
      return await lock(key,async()=>{
        let record=await read(key);
        if(record&&input&&(record.audioHash!==input.hash||record.mimeType!==body.mimeType||record.durationMs!==body.durationMs))throw error('This recording identity contains different audio. The original connection is preserved.',409);
        if(!record){
          if(!input)throw error('This recording has no AR Create connection yet.',404);
          const available=await capabilities();if(!available.body.ready)throw error('AR Create transcription is not ready on this Mac. Your audio is saved.',503);
          record={schema:1,sessionId:body.sessionId,captureId:body.captureId,audioHash:input.hash,mimeType:body.mimeType,durationMs:body.durationMs,sectionId:body.sectionId,phase:'importing',synthetic:body.synthetic===true};await write(record);
          let imported;
          try{imported=await upstream('/api/sources/import',{rootId:'library',folder:'Oracle',files:[{name:`${body.synthetic===true?'oracle-synthetic':'oracle'}-${body.captureId}.${extension(body.mimeType)}`,base64:body.audioBase64}],urls:[]});}catch(e){record.phase='import-uncertain';await write(record);throw e;}
          const receipt=imported.receipts?.[0];
          if(receipt?.ok!==true||!UUID.test(receipt.source?.id||'')){record.phase='import-uncertain';await write(record);throw error('AR Create did not confirm the retained audio. No automatic duplicate upload will be made.',502);}
          record.sourceId=receipt.source.id;record.phase='imported';await write(record);
          if(receipt.recordingError)throw error('AR Create retained the audio but could not create its transcription job.',502);
        }
        let value=await progress(record),started=Date.now();
        while(value.status===202&&Date.now()-started<pendingBudgetMs){await pause(pollIntervalMs);value=await progress(record);}
        return value;
      });
    }catch(e){return {status:e.status||500,body:{error:e.status?e.message:'The local AR Create connection could not be saved. Your audio remains on this device.'}};}
  }
  return {handle};
}

/** Same-origin loopback-only entrance for Vite dev/preview; never an open proxy. */
export function createArCreateMiddleware({writingHandler,writingCapabilities,...options}={}) {
  const bridge=createArCreateBridge(options);
  return async(req,res,next)=>{
    if((req.url||'').split('?')[0]!=='/api/oracle/authoring/ar-create')return next();
    const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    const host=req.headers.host,origin=req.headers.origin;
    if(typeof host!=='string'||!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)||origin!==`http://${host}`)return send(403,{error:'Open this recording from the Oracle page on this Mac.'});
    if(req.method!=='POST')return send(405,{error:'Use a saved recording request.'});
    if(!req.headers['content-type']?.toLowerCase().startsWith('application/json'))return send(415,{error:'Send a recording JSON request.'});
    try{
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw error('The recording request exceeds 15 MiB.',413);chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw error('Send a valid recording JSON request.');}
      if(['propose','compare-passage','writing-status'].includes(body?.operation)){
        const result=writingHandler?await writingHandler(body):{status:503,body:{error:'AR Create writing is not connected yet. The recording and words are retained.'}};
        return send(result.status,result.body);
      }
      const result=await bridge.handle(body);if(body?.operation==='capabilities'&&result.status===200&&writingCapabilities)result.body.writing=await writingCapabilities();send(result.status,result.body);
    }catch(e){send(e.status||500,{error:e.status?e.message:'The local AR Create connection could not finish. Your recording is saved.'});}
  };
}

export async function verifySyntheticAudio(file,{stateDir,durationMs,...options}={}) {
  if(!Number.isFinite(durationMs)||durationMs<=0)throw new Error('Supply the synthetic audio duration in milliseconds.');
  const bytes=await fs.readFile(file);
  const bridge=createArCreateBridge({stateDir,...options});
  const sessionId=randomUUID(),captureId=randomUUID();
  const initial=await bridge.handle({operation:'transcribe',sessionId,captureId,audioBase64:bytes.toString('base64'),mimeType:file.endsWith('.wav')?'audio/wav':'audio/mp4',durationMs,sectionId:'CODE',synthetic:true});
  return {sessionId,captureId,...initial};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href&&process.argv[2]==='--verify-synthetic') {
  if(!process.argv[3]||!process.argv[4])throw new Error('Supply an explicitly synthetic audio file and its duration in milliseconds.');
  console.log(JSON.stringify(await verifySyntheticAudio(process.argv[3],{durationMs:Number(process.argv[4])}),null,2));
}
