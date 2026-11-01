import {test,expect,type Page,type Locator} from './fixtures';
/**
 * The whole recording journey on a phone and a desktop, with screenshots of every step.
 * Speech processing is a fixture here: it proves the interface and the saved-work rules,
 * not the hosted provider or an installed phone build.
 */
test.use({launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}});
const intro={said:'Trust is what lets you take in whatever life brings. Um, you carry it until it grows.',text:'Trust is what lets you take in whatever life brings. You carry it until it grows.',changes:[{before:'Um, you carry',after:'You carry',reason:'Removed a filler word.'}]};
const reading={said:'Trust lets life reach you all the way. You feel it in the middle of your chess, and you carry what you are given while it grows.',heard:'chess'};
const timed=(text:string,durationMs:number,unsure?:string)=>{const words=text.split(/\s+/),step=Math.max(1,Math.floor(Math.min(durationMs,4000)/words.length));return words.map((word,i)=>({text:word,startMs:i*step,endMs:(i+1)*step,probability:unsure&&word.replace(/\W/g,'')===unsure?0.38:0.97}));};
async function scriptedSpeech(page:Page,{unplaced=false}={}){
 let transcribed=0;const delays=unplaced?[0]:[6000,0];
 await page.route('**/api/oracle/authoring/ar-create',async route=>{const body=route.request().postDataJSON();
  if(body.operation==='transcribe'){const n=transcribed++,said=unplaced?reading.said+' And this belongs with my notes about Gate 7.':n===0?intro.said:reading.said;await new Promise(r=>setTimeout(r,delays[n]??0));const end=Math.max(200,Math.min(body.durationMs,4000));return route.fulfill({json:{provider:'browser-test-fixture',durationMs:body.durationMs,segments:[{text:said,startMs:0,endMs:end,timing:'provider',sectionId:body.sectionId,words:timed(said,end,said===intro.said?undefined:reading.heard)}]}});}
  if(body.operation==='assimilate-sections'){const input=body.assimilation;const words:string=input.words;
   if(words.includes(intro.said))return route.fulfill({json:{assimilation:{sections:[{sectionId:'2/INTRO',text:intro.text,evidenceQuotes:[intro.said],changes:intro.changes,warnings:[]}],unassigned:[]}}});
   const quote=words.includes(reading.said)?reading.said:words;return route.fulfill({json:{assimilation:{sections:[{sectionId:'2/CODE/reading',text:reading.said,evidenceQuotes:[quote],changes:[],warnings:[]}],unassigned:unplaced?[{text:'And this belongs with my notes about Gate 7.',reason:'It names another card without saying to move there.'}]:[]}}});}
  throw new Error(`Unexpected operation ${body.operation}`);});
}
async function expectProse(editor:Locator,value:string|RegExp){const actual=()=>editor.evaluate(el=>{if(el instanceof HTMLTextAreaElement)return el.value;const prose=el.cloneNode(true) as HTMLElement;prose.querySelectorAll('[data-check-controls]').forEach(node=>node.remove());return prose.textContent??'';});if(typeof value==='string')await expect.poll(actual).toBe(value);else await expect.poll(actual).toMatch(value);}
async function openRecording(page:Page){await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Record',exact:true})).toBeEnabled();return dialog;}
const shot=(page:Page,name:string)=>page.screenshot({path:test.info().outputPath(`${test.info().project.name.replace(/\W+/g,'-')}-${page.viewportSize()!.width}-${name}.png`)});

for(const [label,size] of [['phone',{width:390,height:844}],['desktop',{width:1440,height:900}]] as const){
 test.describe(label,()=>{
  test.use({viewport:size,...(label==='phone'?{isMobile:true,hasTouch:true,deviceScaleFactor:2}:{})});
  test('record two sections without waiting, check one word, use my words, undo, and see them in the card',async({page,context,browserName,baseURL})=>{
   test.setTimeout(60_000); // Includes a six-second provider delay and twelve full-screen captures.
   test.skip(browserName!=='chromium','Uses the Chromium fake microphone');await context.grantPermissions(['microphone'],{origin:baseURL!});
   await scriptedSpeech(page);const dialog=await openRecording(page);
   const dock=dialog.locator('.vs-dock');
   await expect(dock).toContainText('Record over');
   await dialog.locator('.vs-section[data-section-id="2/INTRO"] .vs-section-head').click();await expect(dock.locator('strong')).toHaveText('Intro');
   await expect(dialog.locator('.vs-section[aria-current=step]')).toHaveAttribute('data-section-id','2/INTRO');
   await shot(page,'01-open');
   await dialog.getByRole('button',{name:'Record',exact:true}).click();
   await expect(dock).toContainText('0:01');await expect(dialog.locator('.vs-section[data-recording]')).toHaveAttribute('data-section-id','2/INTRO');
   await shot(page,'02-recording-intro');
   await dialog.getByRole('button',{name:'Send this recording and go to Universal Language · Reading',exact:true}).click();
   await expect(dock).toContainText('Record over');await expect(dock.locator('strong')).toHaveText(/^Reading/);
   await expect(dialog.locator('.vs-section[data-section-id="2/INTRO"] .vs-chip')).toHaveText('Processing');await expect(dock).toContainText('1 processing');
   await dialog.getByRole('button',{name:'Record',exact:true}).click();
   await expect(dock).toContainText('0:01');
   // Reading ahead does not move the microphone.
   await dialog.locator('.vs-manuscript').evaluate(el=>el.scrollTo({top:el.scrollHeight/2}));
   await expect(dialog.locator('.vs-section[data-recording]')).toHaveAttribute('data-section-id','2/CODE/reading');
   await dialog.locator('.vs-manuscript').evaluate(el=>el.scrollTo({top:0}));
   await shot(page,'03-recording-reading-while-intro-processes');
   await dialog.getByRole('button',{name:'Done',exact:true}).click();
   const words=dialog.getByRole('textbox',{name:'Your section words',exact:true});
   await expectProse(words,reading.said);
   await expect(dialog.getByRole('textbox',{name:'Section title',exact:true})).toHaveValue('Reading');
   await expect(dialog.getByRole('region',{name:'Original section',exact:true})).toContainText('Trust lets life reach you all the way');
   const checks=words.locator('.vs-inline-word-check');await expect(dialog.locator('.vs-checks')).toHaveCount(0);await expect(checks.getByRole('button',{name:'Hear it',exact:true})).toBeVisible();await expect(checks.getByRole('button',{name:'It’s right',exact:true})).toBeVisible();
   await expect(checks.locator('.vs-checked-word')).toHaveText('chess');await expectProse(words,reading.said);
   const apply=dialog.locator('.vs-dock [data-action=apply]');
   await expect(apply).toBeDisabled();await expect(apply).toHaveText('Check 1 word first');
   await shot(page,'04-review-one-word-to-check');
   await checks.getByRole('button',{name:'Hear it',exact:true}).click();
   await expect(dialog.locator('.vs-dock--review .vs-progress')).toBeVisible();
   await shot(page,'05-hearing-the-word');
   await dialog.getByRole('button',{name:'Done',exact:true}).click();
   await words.fill(reading.said.replace('chess','chest'));await words.blur();
   await expect(apply).toBeEnabled();await expectProse(words,reading.said.replace('chess','chest'));await expect(checks).toHaveCount(0);await expect(apply).toHaveText(/^Replace all \d+ paragraphs$/);await expect(dialog.locator('.vs-replacement-scope')).toHaveText(/^Replaces all \d+ paragraphs$/);
   await shot(page,'06-word-corrected');
   await apply.click();
   await expect(dialog.getByRole('region',{name:'Now in your reading',exact:true})).toContainText('middle of your chest');
   await expect(dialog.getByRole('region',{name:'Next section to record',exact:true}).locator('p')).not.toBeEmpty();await expect(dialog.getByRole('button',{name:'Record this section',exact:true})).toBeVisible();await shot(page,'07-applied');
   await dialog.getByRole('button',{name:'Undo',exact:true}).click();
   await expect(words).toBeVisible();await expect(dialog.locator('.vs-toast')).toContainText('Undone');
   await apply.click();
   await expect(dialog.getByRole('region',{name:'Now in your reading',exact:true})).toBeVisible();
   await dialog.getByRole('button',{name:'Next to review',exact:true}).click();
   await expect(dialog.getByRole('textbox',{name:'Section title',exact:true})).toHaveValue('Intro');
   await expectProse(words,intro.text);
   await expect(dialog.getByRole('button',{name:'1 stumble tidied',exact:true})).toBeVisible();
   await dialog.getByRole('button',{name:'Listen',exact:true}).click();
   await expect(dialog.locator('.word-replay mark')).toHaveCount(1);
   await shot(page,'08-listening-with-highlight');
   await dialog.getByRole('button',{name:'Back to editing',exact:true}).click();
   await expect(words).toBeVisible();
   await dialog.locator('.vs-dock [data-action=apply]').click();
   await expect(dialog.getByRole('region',{name:'Now in your reading',exact:true})).toBeVisible();
   await shot(page,'09-intro-applied');
   await dialog.getByRole('button',{name:'Back',exact:true}).click();
   await expect(dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-chip')).toHaveText('Your words');
   await expect(dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-section-text')).toContainText('middle of your chest');
   await expect(dialog.locator('.vs-card-progress')).toHaveText(/^2 of \d+ sections in your words$/);await expect(dialog.getByRole('progressbar',{name:'Sections entirely in your words',exact:true})).toHaveAttribute('aria-valuenow','2');await shot(page,'10-card-sections-show-your-words');
   await dialog.getByRole('button',{name:'Recording settings',exact:true}).click();
   await shot(page,'11-settings');
   await dialog.getByRole('button',{name:'Back',exact:true}).click();
   await dialog.getByRole('button',{name:'Close recording',exact:true}).click();
   await expect(page.getByRole('dialog')).toHaveCount(0);
   await expect(page.locator('[data-working-section="CODE"]')).toContainText('middle of your chest');
   await shot(page,'12-card-reading-updated');
  });

  test('words that fit no section stay saved and are placed by choosing one section',async({page,context,browserName,baseURL})=>{
   test.skip(browserName!=='chromium','Uses the Chromium fake microphone');await context.grantPermissions(['microphone'],{origin:baseURL!});
   await scriptedSpeech(page,{unplaced:true});const dialog=await openRecording(page);
   await dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-section-head').click();
   await expect(dialog.locator('.vs-dock strong')).toHaveText(/^Reading · all \d+ paragraphs$/);
   await dialog.getByRole('button',{name:'Record',exact:true}).click();await expect(dialog.locator('.vs-dock')).toContainText('0:01');
   await dialog.getByRole('button',{name:'Send this recording and go to I Ching · Combination',exact:true}).click();
   await expect(dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-chip')).toHaveText('Check words');
   await expect(dialog.getByRole('button',{name:'1 passage not placed yet'})).toBeVisible();
   await shot(page,'20-unplaced-noted');
   await dialog.getByRole('button',{name:/^Review \d+$/}).click();
   await dialog.getByRole('button',{name:/was not placed/}).click();
   await expect(dialog.getByRole('region',{name:'Unplaced words',exact:true})).toContainText('Gate 7');
   await shot(page,'21-unplaced-screen');
   await dialog.getByRole('button',{name:'Choose a section',exact:true}).click();
   await shot(page,'22-choose-section');
   await dialog.getByRole('navigation',{name:'Choose a card section'}).locator('button[data-section-id="2/CODE/reading"]').click();
   await expect(dialog.getByRole('textbox',{name:'Section title',exact:true})).toHaveValue('Reading');
   await expectProse(dialog.getByRole('textbox',{name:'Your section words',exact:true}),/Gate 7\.$/);
   await expect(dialog.locator('.vs-word-check-note')).toContainText('placed by hand');
  });
 });
}
