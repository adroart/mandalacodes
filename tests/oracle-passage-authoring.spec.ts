import {test,expect} from './fixtures';
test.use({launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}});
async function selectPassage(page:import('@playwright/test').Page){
 await page.goto('/universal-language/2');
 await expect(page.locator('.card-reading')).toBeVisible();
 // Select the actual rendered manuscript text, as a browser text selection does.
 const selected=await page.locator('section[data-chapter="ul"]').evaluate(section=>{
 const p=Array.from(section.querySelectorAll('p')).find(p=>p.textContent?.includes('Trust lets life'));
 if(!p)throw new Error('Rendered passage missing');const range=document.createRange();range.selectNodeContents(p);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));return p.textContent!;
 });
 await expect(page.getByRole('button',{name:'Re-record',exact:true})).toBeVisible();return selected;
}
test('selected passage opens isolated editable teleprompter without losing reader context',async({page},info)=>{
 const selected=await selectPassage(page);await page.getByRole('button',{name:'Re-record',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Selected passage teleprompter')).toHaveText(selected);
 await expect(dialog.getByRole('button',{name:'Record',exact:true})).toBeVisible();
 await expect(page).toHaveURL(/\/universal-language\/2$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('isolated-passage.png')});
 await dialog.getByRole('button',{name:'Back',exact:true}).click();await expect(dialog).toHaveCount(0);
});
test('re-record waits for review, replaces one passage verbatim and undo restores it',async({page,context,browserName,baseURL},info)=>{
 test.skip(browserName!=='chromium','Uses Chromium fake microphone');await context.grantPermissions(['microphone'],{origin:baseURL!});
 await page.route('**/api/oracle/authoring/ar-create',route=>route.fulfill({json:{provider:'fixture',durationMs:2000,segments:[{text:'My spoken version is clear and entirely my own.',startMs:0,endMs:2000,timing:'provider',sectionId:'CODE'}]}}));
 const selected=await selectPassage(page);await page.getByRole('button',{name:'Re-record',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'Record',exact:true}).click();await expect(dialog.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
 await expect(dialog.getByRole('status')).toContainText('0:01');await dialog.getByRole('button',{name:'Finish',exact:true}).click();
 await expect(dialog.getByRole('textbox',{name:'Your replacement words'})).toHaveValue('My spoken version is clear and entirely my own.');
 await expect(page.locator('.working-card-reading__words')).toHaveCount(0);
 await dialog.getByRole('textbox',{name:'Your replacement words'}).fill('My checked version stays exactly as I wrote it.');await page.screenshot({path:info.outputPath('check-original-and-spoken.png')});
 await dialog.getByRole('button',{name:'Use my words',exact:true}).click();await expect(dialog).toHaveCount(0);
 const words=page.locator('[data-working-section="CODE"] .working-card-reading__words');await expect(words).toContainText('My checked version stays exactly as I wrote it.');await expect(words).not.toContainText(selected);
 await expect(words).toContainText('Some days you feel out of place');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(words).toContainText(selected);
});
