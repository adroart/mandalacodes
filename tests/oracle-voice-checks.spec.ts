import {test,expect,type Page,type Locator} from './fixtures';
/**
 * Word checks on the review screen with a second listening: what else was heard, using it, the line for a
 * recording that was not double-checked, and each check's own audio state. Speech processing is a fixture
 * that answers the way the hosted server does: doubtful words carry `doubt` and `heardAlso`, and the response
 * lists the same doubts at its top level with `doubtsAvailable`.
 */
const said='I can feel direction in my chess before I find my words.';
const seconds=6;
/** A silent mono WAV of the given length, so the saved recording really plays. */
function wave(length=seconds){const rate=8000,data=rate*2*length,bytes=Buffer.alloc(44+data);bytes.write('RIFF');bytes.writeUInt32LE(36+data,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(data,40);return bytes;}
type Doubt={word:string;occurrence?:number;heardAlso:string};
/** Words spread over the recording; each doubtful word gets a long span so its clip plays for a few seconds. */
function timedWords(text:string,durationMs:number,doubts:Doubt[]){
 const words=text.split(' '),step=Math.floor(durationMs/words.length),seen:Record<string,number>={};
 return words.map((word,i)=>{const bare=word.replace(/\W/g,''),n=seen[bare]=(seen[bare]??0)+1,doubt=doubts.find(d=>d.word===bare&&(d.occurrence??1)===n);
  return {text:word,startMs:i*step,endMs:Math.min(durationMs,(i+1)*step+(doubt?3*step:0)),...(doubt?{doubt:true,heardAlso:doubt.heardAlso}:{})};});
}
async function scriptedSpeech(page:Page,{doubts=[{word:'chess',heardAlso:'chest'}] as Doubt[],doubtsAvailable=true as boolean|undefined}={}){
 await page.route('**/api/oracle/authoring/ar-create',route=>{const body=route.request().postDataJSON();
  if(body.operation==='transcribe'){const end=Math.min(body.durationMs,seconds*1000),words=timedWords(said,end,doubts);
   return route.fulfill({json:{provider:'browser-test-fixture',durationMs:body.durationMs,...(doubtsAvailable===undefined?{}:{doubtsAvailable}),doubts:words.filter(w=>'doubt' in w).map(w=>({text:w.text,startMs:w.startMs,endMs:w.endMs,heardAlso:w.heardAlso})),segments:[{text:said,startMs:0,endMs:end,timing:'provider',sectionId:'CODE',words}]}});}
  if(body.operation==='assimilate-sections')return route.fulfill({json:{assimilation:{sections:[{sectionId:'2/CODE/reading',text:said,evidenceQuotes:[said],changes:[],warnings:[]}],unassigned:[]}}});
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
const prose=(editor:Locator)=>editor.evaluate(el=>el.textContent??'');
const shot=(page:Page,name:string)=>page.screenshot({path:test.info().outputPath(`${test.info().project.name.replace(/\W+/g,'-')}-${page.viewportSize()!.width}-${name}.png`)});

test('a word heard two ways offers the other wording, replaces only that occurrence, and can be undone',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await scriptedSpeech(page,{doubts:[{word:'chess',heardAlso:'chest'},{word:'my',occurrence:2,heardAlso:'the'}]});
 const dialog=await review(page),editor=dialog.locator('.vs-checked-prose'),apply=dialog.locator('[data-action=apply]');
 const rows=dialog.locator('[data-review-pane=words] .vs-word-check-row'),chess=rows.filter({hasText:'“chess”'}),my=rows.filter({hasText:'“my”'});
 await expect(rows).toHaveCount(2);
 // The row reads: the word, what else was heard, then its actions.
 await expect(chess.locator('.vs-word-check-also')).toHaveText('also heard “chest”');
 await expect(chess.getByRole('button')).toHaveText(['“chess”','Hear it','It’s right','Use “chest”']);
 await expect(dialog.locator('.vs-review-unchecked')).toHaveCount(0);
 await expect(apply).toHaveText('Check 2 words first');
 // A repeated word cannot be told apart from its twin, so nothing offers to replace either one.
 await expect(my.locator('.vs-word-check-also')).toHaveText('also heard “the”');
 await expect(my.getByRole('button',{name:/^Use/})).toHaveCount(0);
 for(const button of await rows.getByRole('button').all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await shot(page,'also-heard');
 // Using it changes only the marked occurrence, and settles the check as an edit would.
 await chess.getByRole('button',{name:'Use “chest”',exact:true}).click();
 await expect.poll(()=>prose(editor)).toBe('I can feel direction in my chest before I find my words.');
 await expect(chess).toHaveCount(0);await expect(apply).toHaveText('Check 1 word first');
 // The normal text undo brings the word back, with its check.
 await editor.press('ControlOrMeta+z');
 await expect.poll(()=>prose(editor)).toBe(said);
 await editor.blur();await expect(chess).toHaveCount(1);await expect(apply).toHaveText('Check 2 words first');
 await chess.getByRole('button',{name:'Use “chest”',exact:true}).click();await editor.blur();
 await expect(chess).toHaveCount(0);await expect.poll(()=>prose(editor)).toBe('I can feel direction in my chest before I find my words.');
 await my.getByRole('button',{name:'It’s right',exact:true}).click();
 await expect(apply).toBeEnabled();
 await apply.click();
 const applied=dialog.locator('.vs-applied-text');
 await expect(applied).toContainText('in my chest before I find my words.');await expect(applied).not.toContainText('chess');await expect(applied).not.toContainText('Use');
 expect(errors).toEqual([]);
});

test('a word the second listening did not hear says so and offers no replacement',async({page})=>{
 await scriptedSpeech(page,{doubts:[{word:'chess',heardAlso:''}]});
 const dialog=await review(page),row=dialog.locator('[data-review-pane=words] .vs-word-check-row');
 await expect(row).toHaveCount(1);
 await expect(row.locator('.vs-word-check-also')).toHaveText('not heard on the second listening');
 await expect(row.getByRole('button')).toHaveText(['“chess”','Hear it','It’s right']);
});

test('a recording that was not double-checked says so once, and never blocks applying',async({page})=>{
 await scriptedSpeech(page,{doubts:[],doubtsAvailable:false});
 const dialog=await review(page),line=dialog.locator('.vs-review-unchecked');
 await expect(line).toHaveText('This recording was not double-checked. Listen once before you use it.');
 await expect(dialog.locator('[data-review-pane=words] .vs-word-check-row')).toHaveCount(0);
 const apply=dialog.locator('[data-action=apply]');await expect(apply).toBeEnabled();
 await apply.click();await expect(dialog.locator('.vs-applied-text')).toContainText('my chess');
 await expect(line).toHaveCount(0);
});

test('a check plays its own clip, stops it, and says when the recording cannot be played',async({page})=>{
 await scriptedSpeech(page);
 const dialog=await review(page),row=dialog.locator('[data-review-pane=words] .vs-word-check-row');
 await row.getByRole('button',{name:'Hear it',exact:true}).click();
 const stop=row.getByRole('button',{name:'Stop clip',exact:true});await expect(stop).toBeVisible();
 await expect(row.getByRole('button',{name:'It’s right',exact:true})).toBeEnabled();
 await shot(page,'stop-clip');
 await stop.click();
 await expect(row.getByRole('button',{name:'Hear it',exact:true})).toBeVisible();
 // The saved recording goes away on this device: the check keeps editing and confirming, without audio.
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const open=indexedDB.open('oracle-authoring-v1');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const tx=open.result.transaction(['sessions'],'readwrite');tx.objectStore('sessions').clear();tx.oncomplete=()=>{open.result.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
 await row.getByRole('button',{name:'Hear it',exact:true}).click();
 await expect(row.locator('.vs-word-check-status')).toHaveText('Audio unavailable');
 await expect(row.getByRole('button',{name:/^(Hear it|Stop clip|Try audio again)$/})).toHaveCount(0);
 await row.getByRole('button',{name:'It’s right',exact:true}).click();
 await expect(dialog.locator('[data-action=apply]')).toBeEnabled();
});

test('a long other wording wraps inside its row and every action stays full height',async({page})=>{
 const long='chest, right in the middle where the breath turns over before it says anything at all';
 await scriptedSpeech(page,{doubts:[{word:'chess',heardAlso:long}]});
 const dialog=await review(page),row=dialog.locator('[data-review-pane=words] .vs-word-check-row');
 await expect(row.locator('.vs-word-check-also')).toHaveText(`also heard “${long}”`);
 const use=row.getByRole('button',{name:`Use “${long}”`,exact:true});await expect(use).toBeVisible();
 const width=page.viewportSize()!.width;
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 for(const part of [row,use,row.locator('.vs-word-check-also')]){const b=(await part.boundingBox())!;expect(b.x+b.width).toBeLessThanOrEqual(width);}
 for(const button of await row.getByRole('button').all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 expect(await row.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await shot(page,'long-also-heard');
 await use.click();
 await expect.poll(()=>dialog.locator('.vs-checked-prose').evaluate(el=>el.textContent)).toBe(`I can feel direction in my ${long} before I find my words.`);
});
