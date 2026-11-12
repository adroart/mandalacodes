import {test,expect,type Page} from './fixtures';
/**
 * Word checks that must survive: a doubt on a word the shared word library fixed stays on the fixed wording, and
 * "It's right" on one section is kept while another section is looked at. Speech processing is a fixture that answers
 * the way the hosted server does. Helpers are copied from the other voice specs.
 */
const seconds=6;
/** A silent mono WAV of the given length, so the saved recording really plays. */
function wave(length=seconds){const rate=8000,data=rate*2*length,bytes=Buffer.alloc(44+data);bytes.write('RIFF');bytes.writeUInt32LE(36+data,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(data,40);return bytes;}
type Doubt={word:string;heardAlso:string};
function timedWords(text:string,durationMs:number,doubts:Doubt[]){
 const words=text.split(' '),step=Math.floor(durationMs/words.length);
 return words.map((word,i)=>{const doubt=doubts.find(d=>d.word===word.replace(/\W/g,''));
  return {text:word,startMs:i*step,endMs:Math.min(durationMs,(i+1)*step),...(doubt?{doubt:true,heardAlso:doubt.heardAlso}:{})};});
}
/** `raw` is what was heard, `corrected` the same words with the shared word library's fixes; sections get their own sentences. */
async function scriptedSpeech(page:Page,{raw,corrected,doubts,sections}:{raw:string;corrected?:string;doubts:Doubt[];sections:{sectionId:string;text:string}[]}){
 await page.route('**/api/oracle/authoring/ar-create',route=>{const body=route.request().postDataJSON();
  if(body.operation==='transcribe'){const end=Math.min(body.durationMs,seconds*1000),words=timedWords(raw,end,doubts);
   return route.fulfill({json:{provider:'browser-test-fixture',durationMs:body.durationMs,doubtsAvailable:true,doubts:words.filter(w=>'doubt' in w).map(w=>({text:w.text,startMs:w.startMs,endMs:w.endMs,heardAlso:w.heardAlso})),segments:[{text:raw,...(corrected?{corrected}:{}),startMs:0,endMs:end,timing:'provider',sectionId:'CODE',words}]}});}
  if(body.operation==='assimilate-sections')return route.fulfill({json:{assimilation:{sections:sections.map(s=>({...s,evidenceQuotes:[s.text],changes:[],warnings:[]})),unassigned:[]}}});
  throw new Error(`Unexpected operation ${body.operation}`);});
}
/** Opens the recording workspace and imports a recording, which goes through the same processing as a spoken one. */
async function review(page:Page){
 await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();
 await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('button',{name:'Record',exact:true})).toBeEnabled();
 await dialog.getByRole('button',{name:'Recording settings',exact:true}).click();await dialog.getByRole('button',{name:/^Recordings and transcript/}).click();
 await dialog.getByLabel('Add audio file',{exact:true}).setInputFiles({name:'spoken.wav',mimeType:'audio/wav',buffer:wave()});
 await dialog.getByRole('button',{name:'Use this audio',exact:true}).click();await expect(dialog.locator('[data-review-pane=words]').first()).toBeVisible();
 return dialog;
}

test('a doubtful word the shared word library fixed is checked on its fixed wording',async({page})=>{
 const raw='I feel my jean keys open before I speak.',corrected='I feel my Gene Keys open before I speak.';
 await scriptedSpeech(page,{raw,corrected,doubts:[{word:'jean',heardAlso:'gene'}],sections:[{sectionId:'2/CODE/reading',text:corrected}]});
 const dialog=await review(page),rows=dialog.locator('[data-review-pane=words] .vs-word-check-row'),apply=dialog.locator('[data-action=apply]');
 await expect(rows).toHaveCount(1);
 await expect(rows.locator('.vs-word-check-quote')).toHaveText('“Gene Keys”');
 await expect(apply).toHaveText('Check 1 word first');
 await rows.getByRole('button',{name:'It’s right',exact:true}).click();
 await expect(apply).toBeEnabled();
});

test('a confirmed word stays confirmed after looking at another section and coming back',async({page})=>{
 const first='I can feel direction in my chess before I find my words.',second='The drive moves like a river today.';
 await scriptedSpeech(page,{raw:`${first} ${second}`,doubts:[{word:'chess',heardAlso:'chest'},{word:'river',heardAlso:'liver'}],sections:[{sectionId:'2/CODE/reading',text:first},{sectionId:'2/DESIGN/the-drive',text:second}]});
 const dialog=await review(page),apply=dialog.locator('[data-action=apply]'),rows=dialog.locator('[data-review-pane=words] .vs-word-check-row');
 await expect(rows.filter({hasText:'“chess”'})).toHaveCount(1);await expect(apply).toHaveText('Check 1 word first');
 await rows.getByRole('button',{name:'It’s right',exact:true}).click();
 await expect(apply).toBeEnabled();
 await dialog.getByRole('button',{name:'Next section',exact:true}).click();
 await expect(rows.filter({hasText:'“river”'})).toHaveCount(1);await expect(apply).toHaveText('Check 1 word first');
 await dialog.getByRole('button',{name:'Previous section',exact:true}).click();
 await expect(rows.filter({hasText:'“chess”'})).toHaveCount(1);
 await expect(apply).toBeEnabled();
});
