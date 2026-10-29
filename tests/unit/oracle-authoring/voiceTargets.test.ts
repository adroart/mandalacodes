import {afterEach,describe,expect,it,vi} from 'vitest';
import {phraseReplayBounds,phraseReplacement,quoteReplayBounds,snapshotVoiceTargets} from '../../../src/mobile/authoring/voiceTargets';
import {recognizeVoiceRoute,startVoiceRouting} from '../../../src/mobile/authoring/voiceCaptureRouting';
import {passagesFromText} from '../../../lib/oracle/authoring/passageContext';
import type {ReplayWord} from '../../../lib/oracle/authoring/wordReplay';
const words:ReplayWord[]=[{text:'one',from:0,to:3,captureId:'audio',startMs:100,endMs:300},{text:' ',from:3,to:4},{text:'two',from:4,to:7,captureId:'audio',startMs:400,endMs:650}];
afterEach(()=>vi.unstubAllGlobals());
describe('exact voice targets and replay',()=>{
 it('copies exact selected ranges and refuses stale selection text',()=>{
  const anchors=passagesFromText(1,'CODE','First.\n\nSecond.',3,'hash'),snapshot=snapshotVoiceTargets(anchors);
  anchors[0].text='changed';expect(snapshot[0].text).toBe('First.');expect(()=>snapshotVoiceTargets(anchors)).toThrow('Select it again');
 });
 it('permits only actual complete monotonic word timing in one capture',()=>{
  expect(phraseReplayBounds(words,0,7)).toEqual({captureId:'audio',startMs:100,endMs:650,from:0,to:7});
  expect(phraseReplayBounds(words,1,7)).toBeNull();
  expect(phraseReplayBounds(words.map(word=>word.text==='two'?{...word,startMs:undefined}:word),0,7)).toBeNull();
  expect(phraseReplayBounds(words.map(word=>word.text==='two'?{...word,captureId:'other'}:word),0,7)).toBeNull();
  expect(quoteReplayBounds('one one','one',[])).toBeNull();
 });
 it('replaces only exact phrase characters and preserves original audio reference',()=>{
  const bounds=phraseReplayBounds(words,4,7),plan=phraseReplacement('one two!',4,7,'three',bounds,'new-audio');
  expect(plan.text).toBe('one three!');expect(plan.replacement.original).toBe('two');expect(plan.replacement.originalAudio?.startMs).toBe(400);
 });
});
describe('evidence-backed routing',()=>{
 const sections=[{id:'CODE',title:'Code'},{id:'ICHING',title:'I Ching'}];
 it('routes only standalone headings or commands, preserving receipt time provenance',()=>{
  expect(recognizeVoiceRoute('Next section.',sections,'CODE',1200)).toMatchObject({sectionId:'ICHING',atMs:1200,timing:'recognition-received'});
  expect(recognizeVoiceRoute('I Ching',sections,'CODE',1300)?.sectionId).toBe('ICHING');
  expect(recognizeVoiceRoute('I discuss the I Ching today',sections,'CODE',1300)).toBeNull();
  expect(recognizeVoiceRoute('next section',sections,'ICHING',1300)).toBeNull();
 });
 it('reports unsupported speech recognition without inventing words or markers',()=>{
  vi.stubGlobal('window',{});const onRoute=vi.fn(),onStatus=vi.fn();
  const control=startVoiceRouting({sections,currentSectionId:()=>null,elapsed:()=>1000,onRoute,onStatus});
  expect(control.supported).toBe(false);expect(onStatus).toHaveBeenCalledWith('unsupported');expect(onRoute).not.toHaveBeenCalled();
 });
 it('ignores interim results, records final evidence, and stops routing after disposal',()=>{
  let recognition:any;
  class Recognition {onresult:any;onerror:any;onend:any;start=vi.fn();stop=vi.fn();constructor(){recognition=this;}}
  vi.stubGlobal('window',{SpeechRecognition:Recognition});const onRoute=vi.fn(),onStatus=vi.fn();
  const control=startVoiceRouting({sections,currentSectionId:()=> 'CODE',elapsed:()=>900,onRoute,onStatus});
  recognition.onresult({resultIndex:0,results:[{isFinal:false,0:{transcript:'next section'}}]});expect(onRoute).not.toHaveBeenCalled();
  recognition.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'next section'}}]});expect(onRoute).toHaveBeenCalledWith(expect.objectContaining({sectionId:'ICHING',atMs:900}));
  const callback=recognition.onresult;control.stop();callback({resultIndex:0,results:[{isFinal:true,0:{transcript:'next section'}}]});expect(onRoute).toHaveBeenCalledTimes(1);
 });
});
