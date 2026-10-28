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

test('visible passage tools connect printed-book search to re-recording',async({page},info)=>{
 await page.goto('/universal-language/2');const tools=page.getByRole('complementary',{name:'Reading and recording tools'});await expect(tools).toBeVisible();
 await expect(tools.getByRole('button',{name:'Record a voice rewrite',exact:true})).toBeVisible();await tools.getByRole('button',{name:'Passage tools',exact:true}).click();
 for(const name of ['Re-record passage','Find in book','Connections'])await expect(tools.getByRole('button',{name,exact:true})).toBeVisible();
 await tools.getByRole('button',{name:'Find in book',exact:true}).click();await tools.getByLabel('Words from your book').fill('Trust lets life reach you all the way');await tools.getByRole('button',{name:'Find passage',exact:true}).click();
 const result=tools.locator('.passage-tools__results button').first();await expect(result).toContainText('Trust lets life');await result.click();await tools.getByRole('button',{name:'Re-record',exact:true}).click();await expect(page.getByLabel('Selected passage teleprompter')).toContainText('Trust lets life');await page.screenshot({path:info.outputPath('discoverable-book-rerecord.png')});
});
test('one visible recording sends a thought and keeps recording before final finish',async({page,context,browserName,baseURL},info)=>{
 test.skip(browserName!=='chromium','Uses Chromium fake microphone');await context.grantPermissions(['microphone'],{origin:baseURL!});let requests=0;
 const thoughts=['My first thought stays beside the paragraph.','A second thought follows in the same recording.'];await page.route('**/api/oracle/authoring/ar-create',route=>route.fulfill({json:{provider:'fixture',durationMs:1000,segments:[{text:thoughts[requests++],startMs:0,endMs:1000,timing:'provider',sectionId:'CODE'}]}}));
 await page.goto('/universal-language/2');await page.getByRole('complementary',{name:'Reading and recording tools'}).getByRole('button',{name:'Record a voice rewrite',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Record',exact:true}).click();await expect(dialog.getByRole('button',{name:'Finish',exact:true})).toBeVisible();await expect(dialog.locator('.ov-live-recording')).toContainText('0:01');await dialog.getByRole('button',{name:'Apply this thought',exact:true}).click();await expect(page.locator('.working-card-reading__words')).toContainText(thoughts[0]);await expect(dialog.getByRole('button',{name:'Finish',exact:true})).toBeVisible();
 await expect(dialog.locator('.ov-live-recording')).toContainText('0:02');await dialog.getByRole('button',{name:'Finish',exact:true}).click();await expect(page.locator('.working-card-reading__words')).toContainText(thoughts[1]);expect(requests).toBe(2);await page.screenshot({path:info.outputPath('connected-progressive-recording.png')});
});

test('passage selection leads to a durable connection without duplicating prose',async({page})=>{
 await page.goto('/universal-language/2');const tools=page.getByRole('complementary',{name:'Reading and recording tools'});await tools.getByRole('button',{name:'Passage tools',exact:true}).click();await tools.getByRole('button',{name:'Re-record passage',exact:true}).click();
 const results=tools.locator('.passage-tools__results button');await expect(results.first()).toBeVisible();await results.nth(0).click();await tools.getByRole('button',{name:'Keep selected',exact:true}).click();await results.nth(1).click();await tools.getByLabel('Connection note').fill('Both passages describe making room.');await tools.getByRole('button',{name:'Connect passages',exact:true}).click();
 await page.reload();await page.getByRole('complementary',{name:'Reading and recording tools'}).getByRole('button',{name:'Passage tools',exact:true}).click();await page.getByRole('button',{name:/^Connections/}).click();await expect(page.getByRole('region',{name:'Connected passages'})).toContainText('Both passages describe making room.');await expect(page.getByRole('button',{name:'Talk about this connection',exact:true})).toBeVisible();await expect(page.locator('.working-card-reading__words')).toHaveCount(0);
});
