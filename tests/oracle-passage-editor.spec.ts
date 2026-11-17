import {test,expect} from './fixtures';

test.use({viewport:{width:375,height:812},launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}});

test('a phone passage edit keeps its destination and operation visible through review',async({page,context,baseURL},info)=>{
 await context.grantPermissions(['microphone'],{origin:baseURL!});
 let assimilations=0,transcriptions=0;
 await page.route('**/api/oracle/authoring/ar-create',async route=>{
  const body=route.request().postDataJSON();
  if(body.operation==='transcribe'){
   transcriptions++;if(transcriptions===3)await new Promise(done=>setTimeout(done,650));
   return route.fulfill({json:{provider:'fixture',segments:[{text:transcriptions===2?'My better new passage.':'My precise new passage.',startMs:0,endMs:Math.max(1,Math.min(body.durationMs,100)),timing:'provider',sectionId:'CODE'}],doubtsAvailable:false}});
  }
  assimilations++;return route.fulfill({status:500,json:{error:'Explicit passage must not use section assimilation.'}});
 });
 await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();
 await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();
 const dialog=page.getByRole('dialog'),passage=dialog.locator('.vs-para--choice').first();
 await expect(dialog.locator('.vs-dock-target strong')).toHaveText('Tap a passage to edit');
 await expect(dialog.locator('.vs-dock-target small')).toHaveCount(0);
 await passage.click();await expect(dialog.locator('[data-view=passage]')).toBeVisible();
 await expect(dialog.locator('.vs-passage-path')).toContainText('Card 2 · Intro · Paragraph 1 of 1');
 await expect(dialog.getByRole('button',{name:'Record',exact:true})).toBeDisabled();
 const selected=await dialog.locator('.vs-passage-selected').innerText();
 expect(selected.length).toBeGreaterThan(10);
 await dialog.getByRole('button',{name:'Add after',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Record addition',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const editor=await dialog.locator('.vs-passage-editor').boundingBox(),actions=await dialog.locator('.vs-passage-actions').boundingBox(),dock=await dialog.locator('.vs-dock').boundingBox();
 expect(editor&&actions&&dock).toBeTruthy();expect(actions!.y).toBeGreaterThan(editor!.y);expect(actions!.y+actions!.height).toBeLessThan(dock!.y);
 await page.screenshot({path:info.outputPath('passage-choice-phone.png')});
 await dialog.getByRole('button',{name:'Record addition',exact:true}).click();
 await expect(dialog.locator('.vs-passage-editor')).toContainText('Adding after this passage');
 await expect(dialog.locator('.vs-dock-target')).toContainText('Add after');
 await dialog.getByRole('button',{name:'Stop & review',exact:true}).click();
 await expect(dialog.locator('.vs-bar-title--passage strong')).toHaveText('Review',{timeout:15000});
 await expect(dialog.locator('.vs-review-status')).toHaveText('Not applied yet. You can undo after applying.');
 await expect(dialog.locator('.vs-review-head, .vs-review-plan')).toHaveCount(0);
 await expect(dialog.locator('.vs-bar-title--passage')).toContainText('Card 2 · Intro · para 1/1');
 await expect(dialog.locator('.vs-bar-title--passage')).toHaveAttribute('aria-label',/Card 2 · Intro · Paragraph 1 of 1/);
 await expect(dialog.getByRole('button',{name:'Add after',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(dialog.locator('[data-review-pane=original]')).toContainText(selected);
 await expect(dialog.locator('[data-review-pane=words]')).toContainText('My precise new passage.');
 await expect(dialog.locator('.vs-replacement-scope')).toHaveCount(0);
 await expect(dialog.locator('[data-action=apply]')).toHaveText('Apply addition');
 await dialog.getByRole('button',{name:'Replace',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Replace',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(dialog.locator('[data-review-pane=original]')).toContainText(selected);
 await expect(dialog.locator('[data-review-pane=words]')).toContainText('My precise new passage.');
 await expect(dialog.locator('[data-action=apply]')).toHaveText('Apply replacement');
 await dialog.getByRole('button',{name:'Add after',exact:true}).click();
 await expect(dialog.locator('[data-action=apply]')).toHaveText('Apply addition');
 expect(assimilations).toBe(0);
 await page.screenshot({path:info.outputPath('passage-review-phone.png')});
 for(const width of [430,320]){
  await page.setViewportSize({width,height:812});
  await expect(dialog.locator('.vs-bar-title--passage')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`explicit-add-review-${width}.png`)});
 }
 await page.setViewportSize({width:375,height:812});
 const words=dialog.locator('[data-review-pane=words]').getByRole('textbox');await words.click();
 const visible=page.viewportSize()!.height-320;
 await page.evaluate(height=>{const vv=window.visualViewport!;Object.defineProperty(vv,'height',{configurable:true,get:()=>height});vv.dispatchEvent(new Event('resize'));},visible);
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 const bar=await dialog.locator('.vs-bar').boundingBox(),raisedDock=await dialog.locator('.vs-dock').boundingBox();
 expect(Math.round(raisedDock!.y+raisedDock!.height)).toBe(visible);expect(Math.round(bar!.y)).toBe(0);
 const destinationBar=dialog.locator('.vs-bar-title--passage');
 await expect(destinationBar).toContainText('Card 2 · Intro · para 1/1');
 await expect(dialog.locator('[data-action=apply]')).toHaveText('Apply addition');
 expect((await destinationBar.boundingBox())!.y+(await destinationBar.boundingBox())!.height).toBeLessThan(raisedDock!.y);
 await words.evaluate(el=>el.scrollIntoView({block:'nearest'}));const wordBox=await words.boundingBox();expect(wordBox!.y).toBeGreaterThanOrEqual(bar!.y+bar!.height-1);expect(wordBox!.y).toBeLessThan(raisedDock!.y);
 await page.screenshot({path:info.outputPath('passage-review-keyboard-phone.png')});
 await page.evaluate(()=>{const vv=window.visualViewport!;delete (vv as any).height;vv.dispatchEvent(new Event('resize'));});
 await dialog.getByRole('button',{name:'Re-record',exact:true}).click();
 await expect(dialog.locator('.vs-passage-path')).toContainText('Card 2 · Intro · Paragraph 1 of 1');
 await expect(dialog.locator('.vs-passage-editor')).toContainText('Adding after this passage');
 await dialog.getByRole('button',{name:'Stop & review',exact:true}).click();
 await expect(dialog.locator('[data-review-pane=words]')).toContainText('My better new passage.',{timeout:15000});
 await expect(dialog.locator('.vs-bar-title--passage')).toContainText('Card 2 · Intro · para 1/1');
 const corrected=dialog.locator('[data-review-pane=words]').getByRole('textbox');
 await corrected.fill('My corrected new passage.');await corrected.blur();
 await expect.poll(async()=>page.evaluate(async()=>{const load=(path:string)=>import(path);const {SectionDraftStore}=await load('/lib/oracle/authoring/sectionDrafts.ts');return (await new SectionDraftStore().list(2))[0]?.results.find((r:any)=>r.sectionId==='2/INTRO')?.text;})).toBe('My corrected new passage.');
 await dialog.locator('[data-action=apply]').click();
 await expect(dialog.locator('.vs-bar-title--passage strong')).toHaveText('Addition applied');
 await expect(dialog.locator('.vs-applied-state')).toContainText('Applied to your private reading.');
 await expect(dialog.locator('.vs-just-applied')).toContainText('My corrected new passage.');
 await expect(dialog.getByRole('button',{name:'Undo',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Undo',exact:true}).click();
 await dialog.getByRole('button',{name:'Back',exact:true}).click();
 const reading=dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-para--choice');
 await expect(reading).toHaveCount(3);
 await reading.nth(1).click();
 await expect(dialog.locator('.vs-passage-path')).toContainText('Card 2 · Universal Language · Reading · Paragraph 2 of 3');
 await dialog.getByRole('button',{name:'Back',exact:true}).click();
 const workDock=dialog.locator('.vs-dock--idle');
 await expect(workDock).toContainText('Reading · paragraph 2');
 await expect(workDock.getByRole('button',{name:'Edit passage',exact:true})).toBeVisible();
 await expect(workDock.getByRole('button',{name:/Review 1: 1 edit/})).toBeVisible();
 await expect(workDock.locator('.vs-dock-review')).toHaveText('Review 1');
 await expect(workDock.getByRole('button',{name:'Record',exact:true})).toHaveCount(0);
 for(const width of [430,320]){
  await page.setViewportSize({width,height:812});
  expect(await workDock.locator(':scope > *').evaluateAll(children=>new Set(children.map(child=>Math.round(child.getBoundingClientRect().top))).size)).toBeLessThanOrEqual(2);
  expect((await workDock.locator('.vs-dock-target strong').boundingBox())!.height).toBeLessThanOrEqual(21);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const button of await workDock.getByRole('button').all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:info.outputPath(`selected-passage-compact-dock-${width}.png`)});
 }
 await page.setViewportSize({width:375,height:812});
 await workDock.getByRole('button',{name:'Edit passage',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Add after',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Replace',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Record replacement',exact:true})).toBeEnabled();
 await page.screenshot({path:info.outputPath('reading-paragraph-replace-phone.png')});
 await dialog.getByRole('button',{name:'Record replacement',exact:true}).click();
 await dialog.getByRole('button',{name:'Stop & review',exact:true}).click();
 await expect(dialog.locator('.vs-bar-title--passage')).toContainText('Card 2 · UL Reading · para 2/3');
 await expect(dialog.locator('.vs-bar-title--passage')).toHaveAttribute('aria-label',/Card 2 · Universal Language · Reading · Paragraph 2 of 3/);
 await expect(dialog.locator('[data-action=apply]')).toHaveCount(0);
 await expect.poll(async()=>page.evaluate(async()=>{const load=(path:string)=>import(path);const {SectionDraftStore}=await load('/lib/oracle/authoring/sectionDrafts.ts');const values=await new SectionDraftStore().list(2);return values.map((value:any)=>({takes:value.takes?.map((t:any)=>[t.startSectionId,t.state,t.error])??[],results:value.results?.map((r:any)=>[r.sectionId,r.passageEdit?.operation,r.applied])??[]}));}),{timeout:15000}).toEqual(expect.arrayContaining([expect.objectContaining({takes:expect.arrayContaining([expect.arrayContaining(['2/CODE/reading','review'])]),results:expect.arrayContaining([expect.arrayContaining(['2/CODE/reading','replace'])])})]));
 await expect(dialog.locator('.vs-bar-title--passage strong')).toHaveText('Review',{timeout:15000});
 await expect(dialog.locator('.vs-review-status')).toContainText('Not applied yet');
 await expect(dialog.locator('.vs-review-head, .vs-review-plan, .vs-replacement-scope')).toHaveCount(0);
 for(const width of [430,320]){
  await page.setViewportSize({width,height:812});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`explicit-replace-review-${width}.png`)});
 }
 await dialog.getByRole('button',{name:'Back',exact:true}).click();
 await dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-para--choice').first().click();
 const blockedDock=dialog.locator('.vs-dock--blocked');
 await expect(dialog.locator('.vs-passage-pending')).toContainText('re-record that edit');
 await expect(dialog.locator('.vs-passage-actions')).toHaveCount(0);
 await expect(dialog.locator('.vs-passage-instruction')).toHaveCount(0);
 await expect(blockedDock.getByRole('button',{name:'Review saved words',exact:true})).toBeVisible();
 await expect(blockedDock.getByRole('button',{name:/Record/})).toHaveCount(0);
 expect(await blockedDock.locator(':scope > *').count()).toBe(1);
 expect((await blockedDock.getByRole('button',{name:'Review saved words'}).boundingBox())!.height).toBeGreaterThanOrEqual(44);
 for(const width of [430,320]){
  await page.setViewportSize({width,height:812});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`pending-review-compact-dock-${width}.png`)});
 }
 await blockedDock.getByRole('button',{name:'Review saved words',exact:true}).click();
 await expect(dialog.locator('.vs-bar-title--passage strong')).toHaveText('Review');
 await expect(dialog.getByRole('button',{name:'Re-record',exact:true})).toBeVisible();
 expect(assimilations).toBe(0);
});
