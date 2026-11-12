import {test,expect,type Page,type Locator} from './fixtures';
/**
 * Aiming is explicit. A section's heading aims the next recording at the whole section; paragraph text is
 * only read. In the aimed section alone, "Record one paragraph only" makes its paragraphs choosable. Nothing
 * moves the destination while the microphone is live, and an interrupted microphone does not look live.
 * Also: words placed by hand are added to the section, and the review's word-check rows share one shape.
 * Speech processing is a fixture; it proves the interface only.
 */
test.use({launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}});

const READING='2/CODE/reading';
const said='These are my own words for this reading.';
const seconds=6;
function wave(length=seconds){const rate=8000,data=rate*2*length,bytes=Buffer.alloc(44+data);bytes.write('RIFF');bytes.writeUInt32LE(36+data,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(data,40);return bytes;}
async function scriptedSpeech(page:Page,{unplaced=false,text=said,words}:{unplaced?:boolean;text?:string;words?:unknown[]}={}){
 await page.route('**/api/oracle/authoring/ar-create',route=>{const body=route.request().postDataJSON();
  if(body.operation==='transcribe')return route.fulfill({json:{provider:'browser-test-fixture',durationMs:body.durationMs,...(words?{doubtsAvailable:true}:{}),segments:[{text,startMs:0,endMs:Math.max(200,Math.min(body.durationMs,seconds*1000)),timing:'provider',sectionId:'CODE',...(words?{words}:{})}]}});
  if(body.operation==='assimilate-sections')return route.fulfill({json:{assimilation:unplaced?{sections:[],unassigned:[{text,reason:'The recording did not name a clear section.'}]}:{sections:[{sectionId:READING,text,evidenceQuotes:[text],changes:[],warnings:[]}],unassigned:[]}}});
  return route.fulfill({status:404,json:{error:'Not in this fixture.'}});
 });
}
async function openRecording(page:Page){await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Record',exact:true})).toBeEnabled();return dialog;}
/** Imports a recording, which goes through the same processing as a spoken one. */
async function importAudio(dialog:Locator){
 await dialog.getByRole('button',{name:'Recording settings',exact:true}).click();await dialog.getByRole('button',{name:/^Recordings and transcript/}).click();
 await dialog.getByLabel('Add audio file',{exact:true}).setInputFiles({name:'spoken.wav',mimeType:'audio/wav',buffer:wave()});
 await dialog.getByRole('button',{name:'Use this audio',exact:true}).click();
}
const section=(d:Locator,id:string)=>d.locator(`.vs-section[data-section-id="${id}"]`);
const destination=(d:Locator)=>d.locator('.vs-dock .vs-dock-target strong');
const narrow=(d:Locator)=>d.getByRole('button',{name:'Record one paragraph only',exact:true});
const whole=(d:Locator)=>d.getByRole('button',{name:'Record the whole section',exact:true});
const aim=(d:Locator,id:string)=>section(d,id).locator('.vs-section-head').click();
const shot=(page:Page,name:string)=>page.screenshot({path:test.info().outputPath(`${test.info().project.name.replace(/\W+/g,'-')}-aim-${name}.png`)});
const nativeEvent=(page:Page,kind:string)=>page.evaluate(k=>window.dispatchEvent(new CustomEvent('oracle-recording-native',{detail:{kind:k}})),kind);
const RED='rgb(239, 85, 72)';
/** The first section that has a single paragraph. */
const singleParagraph=(d:Locator)=>d.locator('.vs-section').evaluateAll(sections=>sections.find(s=>!s.querySelector('.vs-para'))?.getAttribute('data-section-id')??'');

test.describe('choosing what a recording replaces',()=>{
 test.beforeEach(async({page})=>{await scriptedSpeech(page);});

 test('tapping paragraph text never changes the destination, and paragraphs are not buttons',async({page})=>{
  const d=await openRecording(page);await aim(d,'2/INTRO');
  const before=await destination(d).textContent();
  const reading=section(d,READING);await reading.scrollIntoViewIfNeeded();
  await reading.locator('.vs-para').nth(1).click();await reading.locator('.vs-para').nth(2).dblclick();
  await expect(destination(d)).toHaveText(before!);
  await expect(reading).not.toHaveAttribute('aria-current','step');
  await expect(section(d,'2/INTRO')).toHaveAttribute('aria-current','step');
  await expect(d.locator('.vs-manuscript').getByRole('button',{name:/^Paragraph \d/})).toHaveCount(0);
  await expect(reading.locator('.vs-para[data-aimed]')).toHaveCount(0);
 });

 test('the narrower choice shows only in the aimed section, and only when it has more than one paragraph',async({page})=>{
  const d=await openRecording(page);await aim(d,READING);
  await expect(narrow(d)).toHaveCount(1);await expect(section(d,READING).getByRole('button',{name:'Record one paragraph only',exact:true})).toBeVisible();
  expect((await narrow(d).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await shot(page,'aimed-section');
  const single=await singleParagraph(d);expect(single).not.toBe('');
  await aim(d,single);await expect(section(d,single)).toHaveAttribute('aria-current','step');
  await expect(narrow(d)).toHaveCount(0);await expect(whole(d)).toHaveCount(0);
 });

 test('choosing a paragraph aims at it, and "Record the whole section" returns',async({page})=>{
  const d=await openRecording(page);await aim(d,READING);const reading=section(d,READING);
  await expect(destination(d)).toHaveText(/ · all (\d+) paragraphs$/);
  const count=Number((await destination(d).textContent())!.match(/all (\d+) paragraphs/)![1]);
  await narrow(d).click();
  await expect(reading.getByRole('status')).toHaveText('Choose the paragraph to replace');
  const choices=reading.getByRole('button',{name:/^Paragraph \d+: /});await expect(choices).toHaveCount(count);
  const second=reading.locator('.vs-para').nth(1),secondText=(await second.innerText()).trim();
  await expect(choices.nth(1)).toHaveAccessibleName(new RegExp(`^Paragraph 2: ${secondText.split(/\s+/).slice(0,3).join(' ').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`));
  for(const choice of await choices.all())expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await choices.nth(1).focus();await shot(page,'choosing');
  // Until a paragraph is chosen the whole section stays the destination.
  await expect(destination(d)).toHaveText(/ · all \d+ paragraphs$/);
  await choices.nth(1).click();
  await expect(destination(d)).toHaveText(/ · paragraph 2$/);
  await expect(reading.locator('.vs-para[data-aimed]')).toHaveCount(1);
  await expect(reading.locator('.vs-para').nth(1)).toHaveAttribute('data-aimed','true');
  await expect(reading.locator('.vs-para').nth(1)).toContainText('Only this paragraph will change');
  await expect(reading.getByRole('button',{name:/^Paragraph \d+: /})).toHaveCount(0);
  await expect(whole(d)).toBeVisible();await expect(narrow(d)).toHaveCount(0);
  await shot(page,'paragraph-aimed');
  await whole(d).click();
  await expect(destination(d)).toHaveText(/ · all \d+ paragraphs$/);
  await expect(reading.locator('.vs-para[data-aimed]')).toHaveCount(0);await expect(narrow(d)).toBeVisible();
  // Leaving the choice open and aiming elsewhere closes it.
  await narrow(d).click();await aim(d,'2/INTRO');await aim(d,READING);
  await expect(reading.getByRole('button',{name:/^Paragraph \d+: /})).toHaveCount(0);await expect(narrow(d)).toBeVisible();
 });
});

test.describe('while the microphone is live',()=>{
 test.beforeEach(async({page,context,baseURL,browserName})=>{
  test.skip(browserName!=='chromium','Uses the Chromium fake microphone.');
  await context.grantPermissions(['microphone'],{origin:baseURL!});await scriptedSpeech(page);
 });

 test('nothing can change the destination',async({page})=>{
  const d=await openRecording(page),reading=section(d,READING);await aim(d,READING);
  await narrow(d).click();await reading.getByRole('button',{name:/^Paragraph 2: /}).click();
  await d.getByRole('button',{name:'Record',exact:true}).click();await expect(d.locator('.vs-dock')).toContainText('0:01');
  await expect(d.locator('.vs-dock')).toContainText('Paragraph 2 of');
  await expect(narrow(d)).toHaveCount(0);await expect(whole(d)).toHaveCount(0);
  await expect(d.locator('.vs-manuscript').getByRole('button',{name:/^Paragraph \d/})).toHaveCount(0);
  await reading.locator('.vs-para').nth(2).click();
  await expect(section(d,'2/INTRO').locator('.vs-section-head')).toBeDisabled();
  await section(d,'2/INTRO').locator('.vs-section-head').click({force:true});
  await expect(d.locator('.vs-dock')).toContainText('Paragraph 2 of');
  await expect(reading).toHaveAttribute('aria-current','step');
  await expect(reading.locator('.vs-para').nth(1)).toContainText('Recording over this paragraph');
  await d.getByRole('button',{name:'Stop & review',exact:true}).click();
 });

 test('an interrupted microphone is shown neutral, and red again when it returns',async({page})=>{
  const d=await openRecording(page),reading=section(d,READING);await aim(d,READING);
  await d.getByRole('button',{name:'Record',exact:true}).click();await expect(d.locator('.vs-dock')).toContainText('0:01');
  const icon=reading.locator('.vs-aim'),bar=()=>reading.evaluate(el=>getComputedStyle(el,'::before').backgroundColor),fill=()=>icon.evaluate(el=>getComputedStyle(el).backgroundColor);
  await expect.poll(fill).toBe(RED);await expect.poll(bar).toBe(RED);
  await nativeEvent(page,'interruption-began');
  await expect(reading.locator('.vs-chip')).toHaveText('Interrupted');
  await expect.poll(fill).not.toBe(RED);await expect.poll(bar).not.toBe(RED);
  await reading.scrollIntoViewIfNeeded();await shot(page,'interrupted');
  await nativeEvent(page,'interruption-ended');
  await expect(reading.locator('.vs-chip')).toHaveText('Recording');
  await expect.poll(fill).toBe(RED);await expect.poll(bar).toBe(RED);
  await d.getByRole('button',{name:'Stop & review',exact:true}).click();
 });
});

test('"Re-record this passage" arrives aimed at that paragraph',async({page})=>{
 await scriptedSpeech(page);
 await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();await page.getByRole('button',{name:'Open passage tools',exact:true}).click();
 const selected=await page.locator('section[data-chapter="humandesign"]').evaluate(section=>{const p=[...section.querySelectorAll('p')].find(p=>p.textContent?.startsWith('You feel where your life'));if(!p)throw Error('Source passage missing');const range=document.createRange();range.selectNodeContents(p);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));return p.textContent!;});
 await page.getByRole('button',{name:'Re-record this passage',exact:true}).click();const d=page.getByRole('dialog');
 await expect(d.locator('.vs-manuscript>section')).toHaveCount(1);
 const aimed=d.locator('.vs-para[data-aimed]');await expect(aimed).toHaveCount(1);
 await expect(aimed).toContainText(selected);await expect(aimed.locator('.vs-para-tag')).toHaveText('Only this paragraph will change');
 await expect(destination(d)).toHaveText(/ · paragraph \d+$/);
 await expect(narrow(d)).toHaveCount(0);
});

test('words placed by hand are added to the section, and the applied reading keeps its paragraphs',async({page})=>{
 const addition='And this belongs with my notes about Gate 7.';
 await scriptedSpeech(page,{unplaced:true,text:addition});
 const d=await openRecording(page);
 const original=(await section(d,READING).locator('.vs-para').allInnerTexts()).map(t=>t.trim());expect(original.length).toBeGreaterThan(1);
 await importAudio(d);
 await d.getByRole('button',{name:/was not placed/}).click();
 await expect(d.getByRole('region',{name:'Unplaced words',exact:true})).toContainText(addition);
 await d.getByRole('button',{name:'Choose a section',exact:true}).click();
 await d.getByRole('navigation',{name:'Choose a card section'}).locator(`button[data-section-id="${READING}"]`).click();
 const words=d.locator('[data-review-pane=words]');await expect(words).toContainText('Your addition');await expect(words).toContainText(addition);
 await expect(d.locator('.vs-replacement-scope')).toHaveCount(0);
 await d.getByRole('button',{name:'I’ve checked this',exact:true}).click();
 const apply=d.locator('.vs-dock [data-action=apply]');await expect(apply).toHaveText('Add my words');await apply.click();
 const now=d.getByRole('region',{name:'Now in your reading',exact:true});await expect(now).toContainText(addition);
 for(const paragraph of original)await expect(now).toContainText(paragraph.slice(0,60));
});

test('every word-check row has the quote on its first line and its actions on the second',async({page})=>{
 const text='I can feel direction in my chess before I find my words.',parts=text.split(' '),step=Math.floor(seconds*1000/parts.length);
 const doubts:Record<string,string>={chess:'chest',find:''};
 const words=parts.map((word,i)=>{const bare=word.replace(/\W/g,'');return {text:word,startMs:i*step,endMs:(i+1)*step,...(bare in doubts?{doubt:true,heardAlso:doubts[bare]}:{})};});
 await page.route('**/api/oracle/authoring/ar-create',route=>{const body=route.request().postDataJSON();
  if(body.operation==='transcribe')return route.fulfill({json:{provider:'browser-test-fixture',durationMs:body.durationMs,doubtsAvailable:true,doubts:words.filter(w=>'doubt' in w).map(w=>({text:w.text,startMs:w.startMs,endMs:w.endMs,heardAlso:(w as {heardAlso:string}).heardAlso})),segments:[{text,startMs:0,endMs:seconds*1000,timing:'provider',sectionId:'CODE',words}]}});
  return route.fulfill({json:{assimilation:{sections:[{sectionId:READING,text,evidenceQuotes:[text],changes:[],warnings:[]}],unassigned:[]}}});});
 const d=await openRecording(page);await importAudio(d);
 const rows=d.locator('[data-review-pane=words] .vs-word-check-row');await expect(rows).toHaveCount(2);
 const shape=await rows.evaluateAll(list=>list.map(row=>{const quote=row.querySelector('.vs-word-check-quote')!.getBoundingClientRect(),also=row.querySelector('.vs-word-check-also')?.getBoundingClientRect(),actions=[...row.querySelectorAll('.vs-word-check-actions button')].map(b=>b.getBoundingClientRect()),box=row.getBoundingClientRect();
  return {alsoBesideQuote:!!also&&also.top<quote.bottom,actionsBelow:actions.every(a=>a.top>=quote.bottom-1),firstActionLeft:Math.round(actions[0].left-box.left),bottom:box.bottom,top:box.top};}));
 for(const row of shape){expect(row.alsoBesideQuote).toBe(true);expect(row.actionsBelow).toBe(true);expect(row.firstActionLeft).toBeLessThanOrEqual(1);}
 expect(shape[1].top-shape[0].bottom).toBeGreaterThanOrEqual(6);
 await rows.first().scrollIntoViewIfNeeded();await shot(page,'check-rows');
});
