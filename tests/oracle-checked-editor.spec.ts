import {test,expect,type Page} from './fixtures';
const said='I can feel direction in my chess before I find the words.';
function wave(){const bytes=Buffer.alloc(16044);bytes.write('RIFF');bytes.writeUInt32LE(16036,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(16000,40);return bytes;}
async function checkedReview(page:Page){
 await page.route('**/api/oracle/authoring/ar-create',route=>{const body=route.request().postDataJSON();return body.operation==='transcribe'?route.fulfill({json:{provider:'fixture',segments:[{text:said,startMs:0,endMs:1000,timing:'provider',sectionId:'CODE'}]}}):route.fulfill({json:{assimilation:{sections:[{sectionId:'2/CODE/reading',text:said,evidenceQuotes:[said],changes:[],warnings:['Check whether “chess” was heard correctly.']}],unassigned:[]}}});});
 await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Record',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'Recording settings',exact:true}).click();await dialog.getByRole('button',{name:/^Recordings and transcript/}).click();await dialog.getByLabel('Add audio file',{exact:true}).setInputFiles({name:'synthetic.wav',mimeType:'audio/wav',buffer:wave()});await dialog.getByRole('button',{name:'Use this audio',exact:true}).click();await expect(dialog.locator('.vs-checked-prose')).toBeVisible();return dialog;
}
test('inline checks never enter copied prose, phrase selection, pasted text, or the applied reading',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const dialog=await checkedReview(page),editor=dialog.locator('.vs-checked-prose'),apply=dialog.locator('[data-action=apply]');
 await expect(editor.getByRole('button')).toHaveCount(0);
 const check=dialog.locator('.vs-word-check-note').first(),original=dialog.locator('.vs-original').first();await expect(check.getByRole('button',{name:'It’s right',exact:true})).toBeVisible();
 const typography=await Promise.all([editor,original].map(el=>el.evaluate(node=>({size:getComputedStyle(node).fontSize,line:getComputedStyle(node).lineHeight}))));expect(typography[0]).toEqual(typography[1]);
 const positions=await Promise.all([editor,check].map(el=>el.boundingBox()));expect(positions[1]!.y).toBeGreaterThanOrEqual(positions[0]!.y+positions[0]!.height-1);await page.screenshot({path:info.outputPath('passage-editing-uninterrupted.png')});
 const copied=await editor.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);const event=new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:new DataTransfer()});el.dispatchEvent(event);return event.clipboardData!.getData('text/plain');});
 expect(copied).toBe(said);
 // The phrase after the non-editable controls must use prose offsets, not UI-label offsets.
 await editor.evaluate(el=>{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest('[data-check-controls]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});let node:Node|null;while((node=walker.nextNode())){const at=node.textContent!.indexOf('before');if(at<0)continue;const range=document.createRange();range.setStart(node,at);range.setEnd(node,at+6);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));break;}});
 await expect(dialog.getByRole('button',{name:'Re-record selection',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'It’s right',exact:true}).click();await expect(dialog.getByRole('button',{name:'Check again',exact:true})).toBeVisible();await expect(apply).toBeEnabled();
 await dialog.getByRole('button',{name:'Check again',exact:true}).click();await expect(apply).toBeDisabled();
 // Replacing contenteditable DOM must not make React restore obsolete annotated words.
 await editor.fill('I feel direction in my chest.');
 await editor.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);range.collapse(false);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);});
 await editor.press('Enter');await page.keyboard.insertText('Second line.');
 // Dispatch the browser paste contract with rich HTML: only text/plain belongs in the reading.
 await editor.evaluate(el=>{const clipboardData=new DataTransfer();clipboardData.setData('text/plain',' Plain words.');clipboardData.setData('text/html','<b>WRONG HTML</b>');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData}));});
 await editor.blur();await expect(apply).toBeEnabled();
 const edited='I feel direction in my chest.\nSecond line. Plain words.';
 await expect(editor).toHaveText(edited);
 // Type again without remounting, then let the normal autosave settle.
 await editor.focus();await editor.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);range.collapse(false);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);});await page.keyboard.insertText(' Still mine.');await editor.blur();
 await expect(editor).toHaveText(edited+' Still mine.');await page.screenshot({path:info.outputPath('checked-editor-edited.png')});
 await apply.click();const applied=dialog.locator('.vs-applied-text');await expect(applied).toContainText('I feel direction in my chest.');await expect(applied).toContainText('Second line. Plain words. Still mine.');await expect(applied).not.toContainText('Hear it');await expect(applied).not.toContainText('It’s right');await expect(applied).not.toContainText('Check again');await expect(applied).not.toContainText('WRONG HTML');expect(errors).toEqual([]);
});
