import {test,expect,type Page,type Locator} from './fixtures';
const said='I can feel direction in my chess before I find the words.';
function wave(){const bytes=Buffer.alloc(16044);bytes.write('RIFF');bytes.writeUInt32LE(16036,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(16000,40);return bytes;}
async function checkedReview(page:Page){
 await page.route('**/api/oracle/authoring/ar-create',route=>{const body=route.request().postDataJSON();return body.operation==='transcribe'?route.fulfill({json:{provider:'fixture',segments:[{text:said,startMs:0,endMs:1000,timing:'provider',sectionId:'CODE'}]}}):route.fulfill({json:{assimilation:{sections:[{sectionId:'2/CODE/reading',text:said,evidenceQuotes:[said],changes:[],warnings:['Check whether “chess” was heard correctly.']}],unassigned:[]}}});});
 await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Record',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'Recording settings',exact:true}).click();await dialog.getByRole('button',{name:/^Recordings and transcript/}).click();await dialog.getByLabel('Add audio file',{exact:true}).setInputFiles({name:'synthetic.wav',mimeType:'audio/wav',buffer:wave()});await dialog.getByRole('button',{name:'Use this audio',exact:true}).click();await expect(dialog.locator('.vs-checked-prose')).toBeVisible();return dialog;
}
const gold='rgb(217, 181, 108)',green='rgb(143, 199, 159)',amber='rgb(240, 163, 94)',offWhite='rgb(243, 243, 244)',muted='rgb(164, 164, 173)';
const box=(el:Locator)=>el.boundingBox().then(b=>b!);
test('word checks sit on their own row, never inside copied prose, phrase selection, pasted text, or the applied reading',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const dialog=await checkedReview(page),editor=dialog.locator('.vs-checked-prose'),apply=dialog.locator('[data-action=apply]'),words=dialog.locator('[data-review-pane=words]').first();
 // Nothing but prose and its mark lives in the editable text, so no sentence is split by a control.
 await expect(editor.locator('button, [contenteditable=false], [data-check-controls]')).toHaveCount(0);await expect(editor).toHaveText(said);
 const mark=editor.locator('.vs-inline-word-check .vs-checked-word');await expect(mark).toHaveText('chess');
 expect(await mark.evaluate(el=>{const s=getComputedStyle(el);return {line:s.textDecorationLine,style:s.textDecorationStyle,color:s.textDecorationColor,thickness:s.textDecorationThickness,offset:s.textUnderlineOffset,ink:s.color};})).toEqual({line:'underline',style:'dotted',color:amber,thickness:'2px',offset:'4px',ink:offWhite});
 // The row follows the passage: the quoted word, then its actions.
 const rows=words.locator('.vs-word-check-row'),row=rows.first();await expect(rows).toHaveCount(1);
 await expect(row.locator('.vs-word-check-quote')).toHaveText('“chess”');
 const hear=row.getByRole('button',{name:/^(Hear it|Listen to recording)$/}),right=row.getByRole('button',{name:'It’s right',exact:true});await expect(hear).toBeVisible();await expect(right).toBeVisible();
 const [editorBox,rowBox]=await Promise.all([box(editor),box(row)]);expect(rowBox.y).toBeGreaterThanOrEqual(editorBox.y+editorBox.height-1);
 for(const button of [hear,right])expect(await button.evaluate(el=>{const s=getComputedStyle(el);return {tall:el.getBoundingClientRect().height>=44,radius:s.borderRadius};})).toEqual({tall:true,radius:'6px'});
 // One text size: his words and the original share size and line height at both widths.
 const original=dialog.locator('.vs-original').first(),type=(el:Locator)=>el.evaluate(node=>({size:getComputedStyle(node).fontSize,line:getComputedStyle(node).lineHeight}));
 const expected=page.viewportSize()!.width>=900?{size:'18px',line:'28.8px'}:{size:'17px',line:'27.2px'};
 expect(await type(editor)).toEqual(expected);expect(await type(original)).toEqual(expected);
 for(const text of await dialog.locator('[data-review-pane] *').all())expect(await text.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
 // Before applying: off-white words with the gold edge; the original has no edge.
 expect(await words.evaluate(el=>({edge:getComputedStyle(el).borderLeftColor,width:getComputedStyle(el).borderLeftWidth}))).toEqual({edge:gold,width:'3px'});
 expect(await editor.evaluate(el=>getComputedStyle(el).color)).toBe(offWhite);expect(await original.evaluate(el=>getComputedStyle(el).color)).toBe(muted);
 expect(await dialog.locator('[data-review-pane=original]').first().evaluate(el=>getComputedStyle(el).borderLeftWidth)).toBe('0px');
 await page.screenshot({path:info.outputPath('passage-editing-uninterrupted.png')});
 const copied=await editor.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);const event=new ClipboardEvent('copy',{bubbles:true,cancelable:true,clipboardData:new DataTransfer()});el.dispatchEvent(event);return event.clipboardData!.getData('text/plain');});
 expect(copied).toBe(said);
 // The phrase after the marked word must use prose offsets.
 await editor.evaluate(el=>{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walker.nextNode())){const at=node.textContent!.indexOf('before');if(at<0)continue;const range=document.createRange();range.setStart(node,at);range.setEnd(node,at+6);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));break;}});
 await expect(dialog.getByRole('button',{name:'Re-record selection',exact:true})).toBeVisible();
 // Tapping the quote brings the marked word into focus.
 await row.locator('.vs-word-check-quote').click();await expect(editor).toBeFocused();expect(await page.evaluate(()=>window.getSelection()!.toString())).toBe('chess');
 // Confirming changes only the row: the passage does not move and the mark turns neutral.
 const before=await box(editor);await right.click();
 await expect(row.locator('.vs-word-check-actions').getByRole('button')).toHaveText(['Check again']);await expect(row.locator('.vs-word-check-quote')).toHaveText('“chess”');await expect(apply).toBeEnabled();
 expect(await box(editor)).toEqual(before);await expect.poll(()=>mark.evaluate(el=>getComputedStyle(el).textDecorationColor)).toBe(muted);
 await row.getByRole('button',{name:'Check again',exact:true}).click();await expect(apply).toBeDisabled();await expect(row.getByRole('button',{name:'It’s right',exact:true})).toBeVisible();
 // Replacing contenteditable DOM must not make React restore obsolete annotated words; editing the word away settles its row.
 await editor.fill('I feel direction in my chest.');
 await editor.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);range.collapse(false);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);});
 await editor.press('Enter');await page.keyboard.insertText('Second line.');
 // Dispatch the browser paste contract with rich HTML: only text/plain belongs in the reading.
 await editor.evaluate(el=>{const clipboardData=new DataTransfer();clipboardData.setData('text/plain',' Plain words.');clipboardData.setData('text/html','<b>WRONG HTML</b>');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData}));});
 await editor.blur();await expect(apply).toBeEnabled();await expect(rows).toHaveCount(0);
 const edited='I feel direction in my chest.\nSecond line. Plain words.';
 await expect(editor).toHaveText(edited);
 // Type again without remounting, then let the normal autosave settle.
 await editor.focus();await editor.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);range.collapse(false);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);});await page.keyboard.insertText(' Still mine.');await editor.blur();
 await expect(editor).toHaveText(edited+' Still mine.');await page.screenshot({path:info.outputPath('checked-editor-edited.png')});
 await apply.click();const applied=dialog.locator('.vs-applied-text');await expect(applied).toContainText('I feel direction in my chest.');await expect(applied).toContainText('Second line. Plain words. Still mine.');await expect(applied).not.toContainText('Hear it');await expect(applied).not.toContainText('It’s right');await expect(applied).not.toContainText('Check again');await expect(applied).not.toContainText('WRONG HTML');
 // Green appears only once the words are applied.
 expect(await applied.evaluate(el=>getComputedStyle(el).borderLeftColor)).toBe(green);expect(errors).toEqual([]);
});
