import fs from 'node:fs';
import {test,expect,type Page} from './fixtures';
import {parseVoiceBundle} from '../lib/oracle/authoring/voiceExport';
/**
 * Send finished sections to the card: apply one section with scripted speech, then hand the card's
 * words over as one file and prove the file is one the Mac's apply step accepts.
 * Speech processing is a fixture, as in oracle-voice-journey.spec.ts (its helpers are copied here).
 */
test.use({launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}});
const reading='Trust lets life reach you all the way. You feel it in the middle of your chest, and you carry what you are given while it grows.';
const timed=(text:string,durationMs:number)=>{const words=text.split(/\s+/),step=Math.max(1,Math.floor(Math.min(durationMs,4000)/words.length));return words.map((word,i)=>({text:word,startMs:i*step,endMs:(i+1)*step,probability:0.97}));};
async function scriptedSpeech(page:Page){
 await page.route('**/api/oracle/authoring/ar-create',async route=>{const body=route.request().postDataJSON();
  if(body.operation==='transcribe'){const end=Math.max(200,Math.min(body.durationMs,4000));return route.fulfill({json:{provider:'browser-test-fixture',durationMs:body.durationMs,segments:[{text:reading,startMs:0,endMs:end,timing:'provider',sectionId:body.sectionId,words:timed(reading,end)}]}});}
  if(body.operation==='assimilate-sections')return route.fulfill({json:{assimilation:{sections:[{sectionId:'2/CODE/reading',text:reading,evidenceQuotes:[reading],changes:[],warnings:[]}],unassigned:[]}}});
  throw new Error(`Unexpected operation ${body.operation}`);});
}
async function openRecording(page:Page){await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Record',exact:true})).toBeEnabled();return dialog;}

test('apply one section, then send it to the card as one file the Mac accepts',async({page,context,browserName,baseURL})=>{
 test.setTimeout(60_000);
 test.skip(browserName!=='chromium','Uses the Chromium fake microphone');await context.grantPermissions(['microphone'],{origin:baseURL!});
 await scriptedSpeech(page);const dialog=await openRecording(page);
 await dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-section-head').click();
 await dialog.getByRole('button',{name:'Record',exact:true}).click();
 await expect(dialog.locator('.vs-dock')).toContainText('0:01');
 await dialog.getByRole('button',{name:'Done',exact:true}).click();
 const apply=dialog.locator('.vs-dock [data-action=apply]');
 await expect(apply).toBeEnabled();await apply.click();
 await expect(dialog.getByRole('region',{name:'Now in your reading',exact:true})).toContainText('middle of your chest');
 await dialog.getByRole('button',{name:'Back',exact:true}).click();
 await expect(dialog.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-chip')).toHaveText('Your words');

 await dialog.getByRole('button',{name:'Recording settings',exact:true}).click();
 const row=dialog.getByRole('button',{name:/^Send finished sections to the card/});
 await expect(row).toContainText('1 section with your words is ready.');
 await row.click();
 const screen=dialog.getByRole('region',{name:'Send to the card',exact:true});
 await expect(screen.locator('[data-send-section="2/CODE/reading"]')).toContainText('Reading');
 await expect(screen.locator('[data-send-section]')).toHaveCount(1);
 await expect(screen).toContainText('nothing changes on the site until you approve it there');
 const send=screen.getByRole('button',{name:'Send 1 section',exact:true});
 expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 const [download]=await Promise.all([page.waitForEvent('download'),send.click()]);
 expect(download.suggestedFilename()).toMatch(/^oracle-voice-card-02-\d{4}-\d{2}-\d{2}\.json$/);
 const file=test.info().outputPath(download.suggestedFilename());await download.saveAs(file);
 const bundle=await parseVoiceBundle(fs.readFileSync(file,'utf8'));
 expect(bundle.cardNumber).toBe(2);
 const section=bundle.sections.find(s=>s.id==='2/CODE/reading');
 expect(section?.applied.text).toBe(reading);
 expect(bundle.sections).toHaveLength(1);
 await expect(screen.getByRole('status')).toContainText('Saved the file with 1 section.');

 await screen.getByRole('button',{name:'Back to settings',exact:true}).click();
 const today=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'});
 await expect(row).toContainText(`Sent 1 section on ${today}. Nothing new since then.`);
});
