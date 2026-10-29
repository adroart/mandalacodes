import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createArCreateBridge } from './oracle-ar-create-bridge.mjs';
import { createArCreateWriting } from './oracle-ar-create-writing.mjs';
export const BRIDGE_PATH='/api/oracle/authoring/ar-create';
const NATIVE_ORIGIN='capacitor://localhost';
const defaultSecret=path.join(os.homedir(),'Library/Application Support/Mandala Codes/oracle-authoring-bridge/pairing-key');
export async function loadPairingKey(secretFile=defaultSecret){
 await fs.mkdir(path.dirname(secretFile),{recursive:true,mode:0o700});
 try{await fs.writeFile(secretFile,randomBytes(32).toString('base64url'),{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}
 const info=await fs.lstat(secretFile);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077)!==0)throw Error('Pairing key must be a regular private file with mode 0600.');
 const key=(await fs.readFile(secretFile,'utf8')).trim();if(!/^[A-Za-z0-9_-]{43,128}$/.test(key))throw Error('Pairing key format is invalid.');return key;
}
export function createPrivateBridge({token,endpoint,transcription=createArCreateBridge(),writing=createArCreateWriting()}={}){
 const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!==BRIDGE_PATH||!url.hostname.endsWith('.ts.net'))throw Error('Configure the exact private Tailscale HTTPS bridge endpoint.');
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(token??''))throw Error('A private pairing key is required.');
 const expected=Buffer.from(`Bearer ${token}`);
 return http.createServer(async(req,res)=>{
  const send=(status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));};
  // Pairing is visible only directly on this Mac, never through the tailnet proxy.
  if(req.url==='/pairing'&&req.method==='GET'){
   if(!/^(?:127\.0\.0\.1|localhost):\d+$/.test(req.headers.host??'')||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers.origin||req.headers['x-forwarded-for']||req.headers['tailscale-user-login'])return send(403,{error:'Open setup directly on this Mac.'});
   const escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
   return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Oracle private Mac connection</title><h1>Connect Oracle to this Mac</h1><p>Keep your Mac awake and connect your phone to your private Tailscale network. Copy these into Connect to your Mac in Oracle.</p><h2>Private HTTPS address</h2><p>${escape(url.href)}</p><h2>Pairing key</h2><p>${escape(token)}</p><p>This key allows transcription and writing on your Mac. Keep it private. Testing in Oracle sends no recording.</p>`);
  }
  if(req.url!==BRIDGE_PATH)return send(404,{error:'Unknown bridge route.'});
  if(req.headers.origin!==NATIVE_ORIGIN)return send(403,{error:'Use the installed Oracle app.'});
  const cors={'Access-Control-Allow-Origin':NATIVE_ORIGIN,Vary:'Origin'};
  if(req.method==='OPTIONS')return send(204,null,{...cors,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Authorization, Content-Type'});
  const received=Buffer.from(req.headers.authorization??'');
  if(received.length!==expected.length||!timingSafeEqual(received,expected))return send(401,{error:'The pairing key was not accepted.'},cors);
  if(req.method!=='POST')return send(405,{error:'Use a saved recording request.'},cors);
  if(!req.headers['content-type']?.toLowerCase().startsWith('application/json'))return send(415,{error:'Use a JSON recording request.'},cors);
  try{
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>15*1024*1024)return send(413,{error:'The request exceeds 15 MiB.'},cors);chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Use valid JSON.'},cors);}
   if(!['capabilities','transcribe','transcription-status','propose','compare-passage','assimilate-sections','writing-status'].includes(body?.operation))return send(400,{error:'Unsupported bridge operation.'},cors);
   const result=['propose','compare-passage','assimilate-sections','writing-status'].includes(body.operation)?await writing.handle(body):await transcription.handle(body);
   if(body.operation==='capabilities'&&result.status===200){result.body={...result.body,writing:await writing.capabilities(),phone:{direct:true,transport:'private HTTPS',authentication:'pairing key'}};}
   send(result.status,result.body,cors);
  }catch{return send(500,{error:'The Mac bridge could not finish. Your recording is saved.'},cors);}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const endpoint=process.env.ORACLE_PRIVATE_BRIDGE_ENDPOINT;
 if(!endpoint)throw Error('Set ORACLE_PRIVATE_BRIDGE_ENDPOINT to the full private Tailscale HTTPS bridge address.');
 const token=await loadPairingKey(process.env.ORACLE_PRIVATE_BRIDGE_SECRET_FILE);
 const port=Number(process.env.ORACLE_PRIVATE_BRIDGE_PORT??8842);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose an unprivileged local port.');
 const writing=createArCreateWriting(process.env.ORACLE_AR_CREATE_RUNNER?{runnerPath:process.env.ORACLE_AR_CREATE_RUNNER}:{});
 const server=createPrivateBridge({token,endpoint,writing});server.requestTimeout=30000;server.headersTimeout=15000;
 server.listen(port,'127.0.0.1',()=>console.log(`Oracle private bridge listening on 127.0.0.1:${port}. Open http://127.0.0.1:${port}/pairing on this Mac. The pairing key is never printed here.`));
}
