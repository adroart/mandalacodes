import {test,expect} from './fixtures';

test.use({viewport:{width:375,height:812},launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}});

async function waitForSavedAudio(page: import('@playwright/test').Page,sectionId:string){
 await expect(page.getByRole('dialog').locator('[data-recording-section-id]')).toHaveAttribute('data-recording-section-id',sectionId);
 await expect.poll(async()=>page.evaluate(async expected=>{
  const load=(path:string)=>import(path);
  const [{SectionDraftStore},{AuthoringStore}]=await Promise.all([load('/lib/oracle/authoring/sectionDrafts.ts'),load('/lib/oracle/authoring/storage.ts')]);
  const draft=(await new SectionDraftStore().list(2)).find((value:any)=>value.recording?.sectionId===expected&&value.recording?.captureId);if(!draft?.captureSessionId)return 'no matching recording';
  const store=new AuthoringStore(),saved=await store.load(draft.captureSessionId),capture=saved?.session.captures.find((item:any)=>item.id===draft.recording?.captureId);
  if(!capture)return 'no capture';
  return `${draft.recording?.sectionId}|${capture.status}|${(await store.captureChunks(draft.captureSessionId,capture.id)).length}`;
 },sectionId),{timeout:10000}).toMatch(new RegExp(`^${sectionId.replaceAll('/','\\/')}\\|recording\\|[1-9]`));
}

async function savedReviewState(page: import('@playwright/test').Page){
 return page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const [{SectionDraftStore},{AuthoringStore}]=await Promise.all([load('/lib/oracle/authoring/sectionDrafts.ts'),load('/lib/oracle/authoring/storage.ts')]);
  const draft=(await new SectionDraftStore().list(2)).find((value:any)=>value.results.some((result:any)=>result.sectionId==='2/CODE/reading')),store=new AuthoringStore(),audio=await store.load(draft.captureSessionId);
  const chunks=await store.chunks(draft.captureSessionId);
  const digests=await Promise.all(chunks.map(async(chunk:any)=>({key:chunk.key,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await chunk.blob.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('')})));
  return {results:draft.results,takes:draft.takes,chunks:digests,captures:audio?.session.captures.map((capture:any)=>({id:capture.id,status:capture.status})),recording:draft.recording};
 });
}

async function useEmptyMediaRecorder(page: import('@playwright/test').Page){
 await page.evaluate(()=>{
  class EmptyMediaRecorder {
   static isTypeSupported(){return true;}
   mimeType='audio/webm';state:'inactive'|'recording'|'paused'='inactive';onstop:((event:Event)=>void)|null=null;
   start(){this.state='recording';}
   stop(){this.state='inactive';queueMicrotask(()=>this.onstop?.(new Event('stop')));}
   requestData(){}pause(){this.state='paused';}resume(){this.state='recording';}
  }
  Object.defineProperty(window,'MediaRecorder',{value:EmptyMediaRecorder,configurable:true});
 });
}

test('a phone passage edit keeps its destination and operation visible through review',async({page,context,baseURL},info)=>{
 await context.grantPermissions(['microphone'],{origin:baseURL!});
 let assimilations=0,transcriptions=0;
 await page.route('**/api/oracle/authoring/ar-create',async route=>{
  const body=route.request().postDataJSON();
  if(body.operation==='transcribe'){
   transcriptions++;if(transcriptions===3)await new Promise(done=>setTimeout(done,650));
   return route.fulfill({json:{provider:'fixture',segments:[{text:transcriptions===2?'My better new passage.':'My precise new passage.',startMs:0,endMs:Math.max(1,Math.min(body.durationMs,100)),timing:'provider',sectionId:'CODE'}],doubtsAvailable:true,...(transcriptions===1?{doubts:[{text:'precise',heardAlso:'present',startMs:0,endMs:1}]}:{})}});
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
 const selected=await dialog.locator('.vs-passage-selected').innerText();
 expect(selected.length).toBeGreaterThan(10);
 // The tap itself starts recording over the passage; Add after can be chosen in review.
 await expect(dialog.locator('.vs-passage-editor')).toContainText('Replacing this passage');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('passage-recording-phone.png')});
 await waitForSavedAudio(page,'2/INTRO');
 await dialog.getByRole('button',{name:'Stop & review',exact:true}).click();
 await expect(dialog.locator('.vs-bar-title--passage strong')).toHaveText('Review',{timeout:15000});
 await expect(dialog.locator('.vs-review-status')).toHaveCount(0);
 await expect(dialog.locator('.vs-review-head, .vs-review-plan')).toHaveCount(0);
 await expect(dialog.locator('.vs-bar-title--passage')).toContainText('Card 2 · Intro · para 1/1');
 await expect(dialog.locator('.vs-bar-title--passage')).toHaveAttribute('aria-label',/Card 2 · Intro · Paragraph 1 of 1/);
 await expect(dialog.getByRole('button',{name:'Replace',exact:true})).toHaveAttribute('aria-pressed','true');
 // The complete take opens first. The original is one tap away.
 await expect(dialog.locator('[data-review-pane]').first()).toHaveAttribute('data-review-pane','words');
 await expect(dialog.locator('[data-review-pane=original]')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Original',exact:true}).click();
 await expect(dialog.locator('[data-review-pane=original]')).toHaveText(selected);
 await dialog.getByRole('button',{name:'Draft',exact:true}).click();
 await expect(dialog.locator('[data-review-pane=words]')).toContainText('My precise new passage.');
 await dialog.getByRole('button',{name:'Check “precise”',exact:true}).click();
 await dialog.getByRole('button',{name:'Use “present”',exact:true}).click();
 await expect(dialog.locator('[data-review-pane=words]')).toHaveText('My present new passage.');
 await expect(dialog.getByRole('textbox')).toHaveCount(0);
 await expect(dialog.locator('[data-editing]')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(dialog.locator('[data-review-pane=words]')).toHaveText('My precise new passage.');
 await dialog.getByRole('button',{name:'It’s right',exact:true}).click();

 await expect(dialog.locator('.vs-replacement-scope')).toHaveCount(0);
 await expect(dialog.locator('[data-action=apply]')).toHaveText('Apply replacement');
 await dialog.getByRole('button',{name:'Add after',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Add after',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(dialog.locator('[data-review-pane=words]')).toContainText('My precise new passage.');
 await expect(dialog.locator('[data-action=apply]')).toHaveText('Apply addition');
 expect(assimilations).toBe(0);
 await page.screenshot({path:info.outputPath('passage-review-phone.png')});
 for(const width of [430,320]){
  await page.setViewportSize({width,height:812});
  await expect(dialog.locator('.vs-bar-title--passage')).toBeVisible();
  const heading=await dialog.locator('.vs-bar-title--passage strong').boundingBox();
  const scope=await dialog.locator('.vs-bar-title--passage small').boundingBox();
  expect(Math.abs(heading!.y+heading!.height/2-scope!.y-scope!.height/2)).toBeLessThan(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`explicit-add-review-${width}.png`)});
 }
 await page.setViewportSize({width:375,height:812});
 await dialog.getByRole('button',{name:'Edit',exact:true}).click();
 const words=dialog.getByRole('textbox',{name:'Edit recorded passage'});
 await expect(words).toBeFocused();
 const visible=page.viewportSize()!.height-320;
 await page.evaluate(height=>{const vv=window.visualViewport!;Object.defineProperty(vv,'height',{configurable:true,get:()=>height});vv.dispatchEvent(new Event('resize'));},visible);
 const done=dialog.getByRole('button',{name:'Done',exact:true});
 await expect(dialog.locator('.vs-bar, .vs-dock')).toHaveCount(0);
 await expect.poll(async()=>Math.round((await done.boundingBox())!.x+(await done.boundingBox())!.width)).toBeGreaterThan(350);
 await expect.poll(async()=>Math.round((await done.boundingBox())!.y+(await done.boundingBox())!.height)).toBeLessThanOrEqual(visible);
 await expect(words).toBeInViewport();
 const longTake=Array.from({length:20},(_,i)=>`Spoken line ${i+1} stays in the draft.`).join('\n');
 await words.fill(longTake);
 await words.press('End');
 await expect.poll(()=>words.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 await expect(done).toBeInViewport();
 await words.fill('My precise new passage.');
 await page.screenshot({path:info.outputPath('passage-review-keyboard-phone.png')});
 await done.click();
 await page.evaluate(()=>{const vv=window.visualViewport!;delete (vv as any).height;vv.dispatchEvent(new Event('resize'));});
 await dialog.getByRole('button',{name:'Re-record',exact:true}).click();
 await expect(dialog.locator('.vs-passage-path')).toContainText('Card 2 · Intro · Paragraph 1 of 1');
 await expect(dialog.locator('.vs-passage-editor')).toContainText('Adding after this passage');
 await waitForSavedAudio(page,'2/INTRO');
 await dialog.getByRole('button',{name:'Stop & review',exact:true}).click();
 await expect(dialog.locator('[data-review-pane=words]')).toContainText('My better new passage.',{timeout:15000});
 await expect(dialog.locator('.vs-bar-title--passage')).toContainText('Card 2 · Intro · para 1/1');
 await dialog.getByRole('button',{name:'Edit',exact:true}).click();
 await dialog.getByRole('textbox',{name:'Edit recorded passage'}).fill('My corrected new passage.');
 await dialog.getByRole('button',{name:'Done',exact:true}).click();
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
 await expect(dialog.locator('.vs-dock')).toContainText('0:01');
 await waitForSavedAudio(page,'2/CODE/reading');
 await dialog.getByRole('button',{name:'Stop & review',exact:true}).click();
 await expect(dialog.locator('.vs-bar-title--passage')).toContainText('Card 2 · UL Reading · para 2/3');
 await expect(dialog.locator('.vs-bar-title--passage')).toHaveAttribute('aria-label',/Card 2 · Universal Language · Reading · Paragraph 2 of 3/);
 await expect(dialog.locator('[data-action=apply]')).toHaveCount(0);
 await expect.poll(async()=>page.evaluate(async()=>{const load=(path:string)=>import(path);const {SectionDraftStore}=await load('/lib/oracle/authoring/sectionDrafts.ts');const values=await new SectionDraftStore().list(2);return values.map((value:any)=>({takes:value.takes?.map((t:any)=>[t.startSectionId,t.state,t.error])??[],results:value.results?.map((r:any)=>[r.sectionId,r.passageEdit?.operation,r.applied])??[]}));}),{timeout:15000}).toEqual(expect.arrayContaining([expect.objectContaining({takes:expect.arrayContaining([expect.arrayContaining(['2/CODE/reading','review'])]),results:expect.arrayContaining([expect.arrayContaining(['2/CODE/reading','replace'])])})]));
 await expect(dialog.locator('.vs-bar-title--passage strong')).toHaveText('Review',{timeout:15000});
 // Reviewed where it sits: the paragraphs around it read as they do in the card.
 await expect(dialog.locator('.vs-review-context')).toHaveCount(0);
 await expect(dialog.locator('.vs-review-head, .vs-review-plan, .vs-replacement-scope')).toHaveCount(0);
 for(const width of [430,320]){
  await page.setViewportSize({width,height:812});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath(`explicit-replace-review-${width}.png`)});
 }
 await dialog.getByRole('button',{name:'Back',exact:true}).click();
 await expect(dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-para--choice').nth(1).locator('.vs-chip')).toHaveText('Ready to review');
 // The paragraph already under review is held back until that review is done.
 await dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-para--choice').nth(1).click();
 const blockedDock=dialog.locator('.vs-dock--blocked');
 await expect(dialog.locator('.vs-passage-pending')).toContainText('re-record it from review');
 await expect(dialog.locator('.vs-dock-choice')).toHaveCount(0);
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
 const beforeEmpty=await savedReviewState(page),transcriptionsBeforeEmpty=transcriptions;
 await useEmptyMediaRecorder(page);
 await dialog.getByRole('button',{name:'Re-record',exact:true}).click();
 await expect(dialog.locator('[data-recording-section-id]')).toHaveAttribute('data-recording-section-id','2/CODE/reading');
 await dialog.getByRole('button',{name:'Stop & review',exact:true}).click();
 await expect(dialog.locator('[data-view=review]')).toBeVisible();
 await expect(dialog.locator('.vs-toast')).toContainText('No audio was captured. Record again when you are ready.');
 await expect(dialog.locator('.vs-bar-title--passage')).toContainText('Card 2 · UL Reading · para 2/3');
 await expect(dialog.getByRole('button',{name:'Re-record',exact:true})).toBeEnabled();
 const afterEmpty=await savedReviewState(page);
 expect(afterEmpty.results).toEqual(beforeEmpty.results);
 expect(afterEmpty.takes).toEqual(beforeEmpty.takes);
 expect(afterEmpty.chunks).toEqual(beforeEmpty.chunks);
 expect(afterEmpty.captures?.slice(0,-1)).toEqual(beforeEmpty.captures);
 expect(afterEmpty.captures?.at(-1)?.status).toBe('empty');
 expect(afterEmpty.recording).toBeUndefined();
 expect(transcriptions).toBe(transcriptionsBeforeEmpty);
});

test('an empty new passage recording keeps the selected operation ready to retry',async({page,context,baseURL})=>{
 await context.grantPermissions(['microphone'],{origin:baseURL!});
 let transcriptions=0;
 await page.route('**/api/oracle/authoring/ar-create',route=>{transcriptions++;return route.fulfill({status:500,json:{error:'An empty recording must not reach transcription.'}});});
 await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();
 await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await useEmptyMediaRecorder(page);
 await dialog.locator('.vs-para--choice').first().click();
 await expect(dialog.locator('[data-recording-section-id]')).toHaveAttribute('data-recording-section-id','2/INTRO');
 await dialog.getByRole('button',{name:'Stop & review',exact:true}).click();
 await expect(dialog.locator('[data-view=passage]')).toBeVisible();
 await expect(dialog.locator('.vs-toast')).toContainText('No audio was captured. Record again when you are ready.');
 await expect(dialog.locator('.vs-passage-path')).toContainText('Card 2 · Intro · Paragraph 1 of 1');
 await expect(dialog.locator('.vs-passage-editor')).toContainText('Replace: speak the whole passage.');
 await expect(dialog.getByRole('button',{name:'Replace',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(dialog.getByRole('button',{name:'Replace',exact:true})).toBeEnabled();
 const stored=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const [{SectionDraftStore},{AuthoringStore}]=await Promise.all([load('/lib/oracle/authoring/sectionDrafts.ts'),load('/lib/oracle/authoring/storage.ts')]);
  const draft=(await new SectionDraftStore().list(2)).find((value:any)=>value.startSectionId==='2/INTRO'),store=new AuthoringStore(),audio=await store.load(draft.captureSessionId);
  return {results:draft.results,takes:draft.takes,recording:draft.recording,captures:audio?.session.captures.map((capture:any)=>capture.status),chunks:(await store.chunks(draft.captureSessionId)).length};
 });
 expect(stored.results).toEqual([]);expect(stored.takes??[]).toEqual([]);
 expect(stored.recording).toBeUndefined();expect(stored.captures).toEqual(['empty']);expect(stored.chunks).toBe(0);
 expect(transcriptions).toBe(0);
});

test('records passage after passage without waiting, then keeps the best sentences of each',async({page,context,baseURL},info)=>{
 await context.grantPermissions(['microphone'],{origin:baseURL!});
 let transcriptions=0;const release:(()=>void)[]=[];
 await page.route('**/api/oracle/authoring/ar-create',async route=>{
  const body=route.request().postDataJSON();
  if(body.operation!=='transcribe')return route.fulfill({status:500,json:{error:'Explicit passage must not use section assimilation.'}});
  const n=++transcriptions;
  // The first answer is held back: the second recording must start while it is still being prepared.
  if(n===1)await new Promise<void>(done=>release.push(done));
  return route.fulfill({json:{provider:'fixture',segments:[{text:n===1?'My whole new first paragraph.':'My fresh opening line. A second new line.',startMs:0,endMs:Math.max(1,Math.min(body.durationMs,100)),timing:'provider',sectionId:'CODE'}],doubtsAvailable:false}});
 });
 await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();
 await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();
 const dialog=page.getByRole('dialog'),reading=dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-para--choice');
 await reading.first().click();
 await waitForSavedAudio(page,'2/CODE/reading');
 const firstText=await dialog.locator('.vs-passage-selected').innerText();
 await dialog.getByRole('button',{name:'Next passage',exact:true}).click();
 // The next paragraph records at once, while the first recording is still with the speech service.
 await expect(dialog.locator('.vs-passage-selected')).not.toHaveText(firstText);
 await expect(dialog.getByRole('button',{name:'Next passage',exact:true})).toBeEnabled();
 const second=await dialog.locator('.vs-passage-selected').innerText();
 await expect.poll(()=>transcriptions,{timeout:10000}).toBe(1);
 await waitForSavedAudio(page,'2/CODE/reading');
 await page.screenshot({path:info.outputPath('next-passage-recording-phone.png')});
 await dialog.getByRole('button',{name:'Stop & review',exact:true}).click();
 await expect.poll(()=>transcriptions,{timeout:10000}).toBe(2);
 release.forEach(done=>done());
 await expect(dialog.locator('[data-review-pane=words]')).toContainText('My whole new first paragraph.');
 await dialog.locator('[data-action=apply]').click();
 // The next edit opens by itself.
 await expect(dialog.locator('.vs-toast')).toContainText('Applied. The next edit is open.');
 await expect(dialog.locator('.vs-bar-title--passage strong')).toHaveText('Review');
 await expect(dialog.locator('.vs-bar-title--passage')).toContainText('para 2/3');
 await expect(dialog.locator('[data-review-pane=words]')).toHaveText('My fresh opening line. A second new line.');
 await dialog.getByRole('button',{name:'Compare sentences',exact:true}).click();
 const pairs=dialog.locator('.vs-pair');
 const sentenceCount=await pairs.count();
 expect(sentenceCount).toBeGreaterThan(1);
 await expect(pairs.first()).toContainText('My fresh opening line.');
 await page.screenshot({path:info.outputPath('sentence-review-phone.png')});
 // Keep the old words for the first sentence; the rest uses the new words.
 await pairs.first().getByRole('button',{name:'Original',exact:true}).click();
 await expect(pairs.first()).toHaveAttribute('data-choice','original');
 await dialog.getByRole('button',{name:'Preview',exact:true}).click();
 await expect(dialog.locator('[data-review-pane=preview]')).toContainText('A second new line.');
 await dialog.locator('[data-action=apply]').click();
 await expect(dialog.locator('.vs-bar-title--passage strong')).toHaveText('Replacement applied');
 const finalText=await page.evaluate(async()=>{const load=(path:string)=>import(path);const [{SectionDraftStore},{currentSectionTexts}]=await Promise.all([load('/lib/oracle/authoring/sectionDrafts.ts'),load('/src/mobile/authoring/sectionWorkflow.ts')]);const draft=(await new SectionDraftStore().list(2)).find((value:any)=>value.results.some((r:any)=>r.sectionId==='2/CODE/reading'));return (await currentSectionTexts(draft))['2/CODE/reading'];});
 const firstOld=second.match(/^[^.!?…]*[.!?…]+["”’)\]]*/)![0];
 expect(finalText.startsWith('My whole new first paragraph.\n\n'+firstOld)).toBe(true);
 expect(finalText).not.toContain('My fresh opening line.');
});
