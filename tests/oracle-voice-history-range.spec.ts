import {test,expect,type Page,type Locator} from './fixtures';

test.use({launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}});

function wave(){const bytes=Buffer.alloc(16044);bytes.write('RIFF');bytes.writeUInt32LE(16036,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(16000,40);return bytes;}
const candidate='These are my own words for this reading.';
async function openPending(page:Page){
 await page.route('**/api/oracle/authoring/ar-create',route=>{const body=route.request().postDataJSON();if(body.operation==='transcribe')return route.fulfill({json:{provider:'fixture',segments:[{text:candidate,startMs:0,endMs:Math.min(body.durationMs,1000),timing:'provider',sectionId:'CODE'}]}});const section=body.assimilation.sections.find((item:{id:string})=>item.id==='2/CODE/reading');return route.fulfill({json:{assimilation:{sections:[{sectionId:section.id,text:candidate,evidenceQuotes:[candidate],changes:[],warnings:[]}],unassigned:[]}}});});
 await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();
 const reading=await page.locator('[data-oracle-reader]').innerText();
 await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-section-head').click();
 await dialog.locator('.vs-section[data-section-id="2/CODE/reading"]').getByRole('button',{name:'Record whole section',exact:true}).click();
 await dialog.getByRole('button',{name:'Recording settings',exact:true}).click();
 await dialog.getByRole('button',{name:/^Recordings and transcript/}).click();
 await dialog.getByLabel('Add audio file',{exact:true}).setInputFiles({name:'fixture.wav',mimeType:'audio/wav',buffer:wave()});
 await dialog.getByRole('button',{name:'Use this audio',exact:true}).click();
 await expect(dialog.locator('.vs-compare')).toBeVisible();
 return {dialog,reading};
}
async function choose(textarea:Locator,phrase:string){
 await textarea.evaluate((element,word)=>{const field=element as HTMLTextAreaElement;const start=field.value.indexOf(word);if(start<0)throw Error(`Missing ${word}`);field.focus();field.setSelectionRange(start,start+word.length);field.dispatchEvent(new Event('select',{bubbles:true}));document.dispatchEvent(new Event('selectionchange'));},phrase);
}
async function sessions(page:Page){
 return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('oracle-section-drafts-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const rows=await new Promise<any[]>((resolve,reject)=>{const request=db.transaction('sessions').objectStore('sessions').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return rows;});
}

test('selected original and recorded words stay locked across focus, stage a preview, and survive reload',async({page},info)=>{
 const {dialog,reading}=await openPending(page);
 const before=await sessions(page),old=before.find(s=>s.results.some((r:{sectionId:string})=>r.sectionId==='2/CODE/reading'));
 expect(old?.captureSessionId).toBeTruthy();
 await dialog.getByRole('button',{name:'Replace selected words'}).click();
 const original=dialog.getByRole('textbox',{name:'Select original words'}),words=dialog.getByRole('textbox',{name:'Select recorded words'});
 const originalText=await original.inputValue();expect(originalText).toContain('Trust');
 await choose(original,'Trust');await dialog.getByRole('button',{name:'Use selection'}).first().click();
 await expect(dialog.locator('[data-selected-original]')).toHaveText('“Trust”');
 await choose(words,'my own words');await dialog.getByRole('button',{name:'Use selection'}).click();
 await expect(dialog.locator('[data-selected-original]')).toHaveText('“Trust”');
 await expect(dialog.locator('[data-selected-words]')).toHaveText('“my own words”');
 await expect(dialog.getByRole('region',{name:'Replacement preview'}).locator('p')).toHaveText(originalText.split('\n\n')[0].replace('Trust','my own words'));
 if(info.project.name==='Phone')for(const width of [320,430]){await page.setViewportSize({width,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`range-${width}.png`)});}
 await dialog.getByRole('button',{name:'Prepare replacement'}).click();
 await expect(dialog.locator('.vs-review-status')).toContainText('Not applied yet');
 const reviewTitle=dialog.locator('.vs-bar-title--passage');
 await expect(reviewTitle).toContainText('Card 2 · UL Reading · Selected words');
 await expect(reviewTitle).toHaveAttribute('aria-label',/Card 2 · Universal Language · Reading · Selected words/);
 await expect(reviewTitle).not.toContainText('Whole section');
 await expect.poll(()=>page.locator('[data-oracle-reader]').innerText()).toBe(reading);
 const staged=(await sessions(page)).find(s=>s.id===old.id);
 expect(staged.results.find((r:{sectionId:string})=>r.sectionId==='2/CODE/reading').text).toBe('my own words');
 expect(staged.unassigned.map((item:{text:string})=>item.text).join(' ')).toContain('These are');
 expect(staged.unassigned.map((item:{text:string})=>item.text).join(' ')).toContain('for this reading');
 expect(staged.captureSessionId).toBe(old.captureSessionId);
 await page.reload();await expect.poll(()=>page.locator('[data-oracle-reader]').innerText()).toBe(reading);
 await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:/^Review/}).first().click();
 await expect(page.getByRole('dialog').locator('.vs-compare')).toContainText('my own words');
});

test('History restores a proposal into a separate pending session and retains the original draft and audio',async({page},info)=>{
 const {dialog,reading}=await openPending(page);
 const old=(await sessions(page)).find(s=>s.results.some((r:{sectionId:string})=>r.sectionId==='2/CODE/reading'));
 await dialog.getByRole('button',{name:'History',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Restore as draft'}).first()).toBeVisible();
 if(info.project.name==='Phone')for(const width of [320,430]){await page.setViewportSize({width,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath(`history-${width}.png`)});}
 await dialog.getByRole('button',{name:'Restore as draft'}).first().click();
 await expect(dialog.locator('.vs-review-status')).toHaveCount(0);
 await expect(dialog.locator('.vs-compare')).toBeVisible();
 await expect.poll(()=>page.locator('[data-oracle-reader]').innerText()).toBe(reading);
 const rows=await sessions(page),unchanged=rows.find(s=>s.id===old.id),restored=rows.find(s=>s.id!==old.id&&s.historyOrigin);
 expect(unchanged.results).toEqual(old.results);
 expect(unchanged.captureSessionId).toBe(old.captureSessionId);
 expect(restored).toBeTruthy();expect(restored.id).not.toBe(old.id);expect(restored.results[0].applied).toBe(false);
 await dialog.getByRole('button',{name:'Back',exact:true}).click();
 await dialog.getByRole('button',{name:'Recording settings',exact:true}).click();
 await dialog.getByRole('button',{name:/^Sessions/}).click();
 await expect(dialog.getByRole('region',{name:'Voice setup'}).getByRole('button',{name:/1 section · 0 used/})).toHaveCount(2);
});
