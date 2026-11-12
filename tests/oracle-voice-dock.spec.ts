import {test,expect,type Page,type Locator} from './fixtures';
/**
 * The recording dock's words: Pause or Resume, Stop & review, Send & next, and what it says when the
 * microphone goes quiet, when the meter cannot read, whether section names are heard, and whether
 * recordings can be prepared. Speech processing is a fixture; it proves the interface only.
 */
test.use({launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}});

const said='These are my own words for this reading.';
/** Scripted speech, copied from the journey spec so shared code stays untouched. */
async function scriptedSpeech(page:Page,{flagged=false}={}){
 await page.route('**/api/oracle/authoring/ar-create',route=>{const body=route.request().postDataJSON();
  if(body.operation==='transcribe')return route.fulfill({json:{provider:'browser-test-fixture',durationMs:body.durationMs,segments:[{text:said,startMs:0,endMs:Math.max(200,Math.min(body.durationMs,1000)),timing:'provider',sectionId:body.sectionId}]}});
  if(body.operation==='assimilate-sections')return route.fulfill({json:{assimilation:{sections:[{sectionId:'2/CODE/reading',text:said,evidenceQuotes:[said],changes:[],warnings:flagged?['Check whether “reading” was heard correctly.']:[]}],unassigned:[]}}});
  return route.fulfill({status:404,json:{error:'Not in this fixture.'}});
 });
}
/** A recogniser that stays open until stopped, so "Listening for section names" is deterministic. */
const fakeRecognition=()=>{const w=window as any;class Recognition{onresult:any=null;onerror:any=null;onend:any=null;continuous=false;interimResults=false;lang='';start(){}stop(){const end=this.onend;this.onend=null;end?.();}}w.SpeechRecognition=Recognition;w.webkitSpeechRecognition=Recognition;};
const noRecognition=()=>{const w=window as any;delete w.SpeechRecognition;delete w.webkitSpeechRecognition;w.SpeechRecognition=undefined;w.webkitSpeechRecognition=undefined;};
/** The installed app as Capacitor sees it, with the hosted service answering `capabilities` as the test says. */
function nativeApp(page:Page,capabilities:{status:number;data?:unknown}|'offline'){
 return page.addInitScript((answer)=>{
  const w=window as any;
  w.webkit={messageHandlers:{bridge:{postMessage(){}}}};
  w.Capacitor={PluginHeaders:[{name:'CapacitorHttp',methods:[{name:'request',rtype:'promise'}]}],nativePromise:async(_plugin:string,_method:string,options:any)=>{
   const path=new URL(options.url).pathname;
   if(path==='/api/oracle/authoring/process'&&options.data?.operation==='capabilities'){if(answer==='offline')throw new Error('The Internet connection appears to be offline.');return {...answer,url:options.url};}
   return {status:503,data:{error:'Not in this fixture.'},url:options.url};
  }};
 },capabilities);
}
async function openRecording(page:Page){await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Record',exact:true})).toBeEnabled();return dialog;}
async function recordIn(dialog:Locator,sectionId:string){await dialog.locator(`.vs-section[data-section-id="${sectionId}"] .vs-section-head`).click();await dialog.getByRole('button',{name:'Record',exact:true}).click();await expect(dialog.locator('.vs-dock')).toContainText('0:01');}
const shot=(page:Page,name:string)=>page.screenshot({path:test.info().outputPath(`${test.info().project.name.replace(/\W+/g,'-')}-dock-${name}.png`)});
const nativeEvent=(page:Page,kind:string)=>page.evaluate(k=>window.dispatchEvent(new CustomEvent('oracle-recording-native',{detail:{kind:k}})),kind);
/** Nothing in the dock is cut short, and every button is at least 44 px tall with its words showing. */
async function expectWholeWords(dock:Locator){
 const items=await dock.locator('p,strong,span,button').evaluateAll(els=>els.filter(el=>el.getClientRects().length&&!el.classList.contains('vs-dock-announce')).map(el=>({text:el.textContent,tag:el.tagName,width:el.clientWidth,scroll:el.scrollWidth,overflow:getComputedStyle(el).textOverflow,height:el.getBoundingClientRect().height,size:parseFloat(getComputedStyle(el).fontSize)})));
 for(const item of items){expect(item.overflow,item.text!).not.toBe('ellipsis');expect(item.scroll,item.text!).toBeLessThanOrEqual(item.width+1);expect(item.size,item.text!).toBeGreaterThanOrEqual(12);if(item.tag==='BUTTON')expect(item.height,item.text!).toBeGreaterThanOrEqual(44);}
}

test.describe('recording with a browser that hears section names',()=>{
 test.beforeEach(async({page,context,baseURL,browserName})=>{
  test.skip(browserName!=='chromium','Uses the Chromium fake microphone.');
  await context.grantPermissions(['microphone'],{origin:baseURL!});await page.addInitScript(fakeRecognition);await scriptedSpeech(page);
 });

 test('the idle dock names a shared title in full, and the live dock says Pause, Stop & review and Send & next',async({page})=>{
  const d=await openRecording(page),dock=d.locator('.vs-dock');
  await d.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-section-head').click();
  await expect(dock.locator('strong')).toHaveText(/^Universal Language · Reading/);await expectWholeWords(dock);await shot(page,'idle');
  await d.getByRole('button',{name:'Record',exact:true}).click();await expect(dock).toContainText('0:01');
  const pause=dock.getByRole('button',{name:'Pause',exact:true}),review=dock.getByRole('button',{name:'Stop & review',exact:true}),send=dock.getByRole('button',{name:'Send this recording and go to I Ching · Combination',exact:true});
  await expect(pause).toBeVisible();await expect(review).toBeVisible();await expect(send).toHaveText('Send & next');
  await expect(send).toHaveClass(/vs-btn--primary/);await expect(review).not.toHaveClass(/vs-btn--primary/);
  await expect(dock.locator('.vs-recording-next')).toHaveText('Next · I Ching · Combination');
  await expect(dock.locator('.vs-dock-target strong')).toHaveText('Universal Language · Reading');
  await expect(dock.locator('.vs-dock-listening')).toHaveText('Listening for section names');
  await expect(dock.locator('.vs-level')).toBeVisible();await expect(dock).not.toContainText('Level meter unavailable');
  await expect(dock.getByRole('button',{name:/^(Done|Next)$/})).toHaveCount(0);
  await expectWholeWords(dock);await shot(page,'recording');
  await pause.click();
  await expect(dock.getByRole('button',{name:'Resume',exact:true})).toBeVisible();await expect(dock.getByRole('button',{name:'Pause',exact:true})).toHaveCount(0);
  await expect(dock.locator('.vs-recording-status')).toContainText('Paused · ');await expect(dock.locator('.vs-dot')).toHaveAttribute('data-paused','true');
  await expect(send).toBeVisible();await expectWholeWords(dock);await shot(page,'paused');
  await dock.getByRole('button',{name:'Resume',exact:true}).click();await expect(dock.locator('.vs-recording-status')).toContainText('Recording · ');
  await review.click();await expect(d.locator('.vs-dock--review')).toBeVisible();
 });

 test('with continuous recording on, the main action says the microphone stays on',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('oracle.voice.continuous','true'));
  const d=await openRecording(page),dock=d.locator('.vs-dock');await recordIn(d,'2/CODE/reading');
  const send=dock.getByRole('button',{name:'Send this recording and keep recording in I Ching · Combination',exact:true});
  await expect(send).toHaveText('Send & next');await expect(dock.locator('.vs-recording-next')).toHaveText('Next, recording continues · I Ching · Combination');
  await send.click();
  await expect(dock.locator('.vs-dock-target strong')).toHaveText('I Ching · Combination');await expect(dock.getByRole('button',{name:'Stop & review',exact:true})).toBeVisible();
  await dock.getByRole('button',{name:'Stop & review',exact:true}).click();
 });

 test('at the end of the card there is no Send, and Stop & review is the main action',async({page})=>{
  const d=await openRecording(page),dock=d.locator('.vs-dock');
  const last=(await d.locator('.vs-section').last().getAttribute('data-section-id'))!;
  await recordIn(d,last);
  await expect(dock.locator('.vs-recording-next')).toHaveCount(0);
  await expect(dock.getByRole('button',{name:/^Send/})).toHaveCount(0);
  await expect(dock.getByRole('button',{name:'Stop & review',exact:true})).toHaveClass(/vs-btn--primary/);
  await expect(dock.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  await expectWholeWords(dock);await shot(page,'end-of-card');
 });

 test('the microphone going quiet is said in plain words and clears when it comes back',async({page})=>{
  const d=await openRecording(page),dock=d.locator('.vs-dock'),status=dock.locator('.vs-recording-status');await recordIn(d,'2/CODE/reading');
  await nativeEvent(page,'interruption-began');
  await expect(status).toHaveText('Microphone interrupted. What you said so far is saved.');
  await expect(dock.locator('.vs-dot')).toHaveAttribute('data-paused','true');await expect(dock.locator('.vs-level')).toHaveCount(0);
  await expect(dock.getByRole('status')).toHaveText('Microphone interrupted. What you said so far is saved.');
  await expect(d.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-chip')).toHaveText('Interrupted');
  // Red means a live microphone: the dot and the words are neutral while it is interrupted.
  expect(await dock.locator('.vs-dot').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgb(239, 85, 72)');
  expect(await status.evaluate(el=>getComputedStyle(el).color)).not.toBe('rgb(239, 85, 72)');
  await expectWholeWords(dock);await shot(page,'interrupted');
  await nativeEvent(page,'interruption-ended');
  await expect(status).toContainText('Recording · ');await expect(status).not.toContainText('Microphone interrupted');
  await expect(dock.getByRole('status')).toHaveText('Microphone back. Recording.');
  await nativeEvent(page,'route-changed');
  await expect(status).toContainText('Microphone changed.');await expect(status).toContainText('Recording · ');
  await expect(status).not.toContainText('Microphone changed.',{timeout:8000});
 });
});

test('the words "Level meter unavailable" stand where the meter cannot read',async({page,context,baseURL,browserName})=>{
 test.skip(browserName!=='chromium','Uses the Chromium fake microphone.');
 await context.grantPermissions(['microphone'],{origin:baseURL!});await page.addInitScript(fakeRecognition);await scriptedSpeech(page);
 await page.addInitScript(()=>{const w=window as any;w.AudioContext=undefined;w.webkitAudioContext=undefined;});
 const d=await openRecording(page),dock=d.locator('.vs-dock');await recordIn(d,'2/CODE/reading');
 await expect(dock.locator('.vs-recording-status')).toContainText('Level meter unavailable');await expect(dock.locator('.vs-level')).toHaveCount(0);
 await expectWholeWords(dock);
});

test('re-recording selected words keeps only Pause and a gold Stop & review',async({page,context,baseURL,browserName})=>{
 test.skip(browserName!=='chromium','Uses the Chromium fake microphone.');
 await context.grantPermissions(['microphone'],{origin:baseURL!});await page.addInitScript(fakeRecognition);await scriptedSpeech(page,{flagged:true});
 const d=await openRecording(page);
 await d.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-section-head').click();await d.getByRole('button',{name:'Record',exact:true}).click();await expect(d.locator('.vs-dock')).toContainText('0:01');
 await d.getByRole('button',{name:'Stop & review',exact:true}).click();
 const editor=d.locator('.vs-checked-prose').first();await expect(editor).toContainText('my own words');
 await editor.evaluate(el=>{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walker.nextNode())){const at=node.textContent!.indexOf('own words');if(at<0)continue;const range=document.createRange();range.setStart(node,at);range.setEnd(node,at+9);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));break;}});
 const again=d.getByRole('button',{name:'Re-record selection',exact:true});await expect(again).toBeVisible();await again.dispatchEvent('click');
 const dock=d.locator('.vs-dock');await expect(dock).toContainText('Selected words');await expect(dock).toContainText('0:01');
 await expect(dock.locator('.vs-recording-next')).toHaveCount(0);await expect(dock.getByRole('button',{name:/^Send/})).toHaveCount(0);
 await expect(dock.getByRole('button',{name:'Stop & review',exact:true})).toHaveClass(/vs-btn--primary/);
 await expect(dock.locator('.vs-dock-listening')).toHaveCount(0);
 await expectWholeWords(dock);
});

test('spoken section names are off where the browser cannot hear them, and the dock says so',async({page,context,baseURL,browserName})=>{
 test.skip(browserName!=='chromium','Uses the Chromium fake microphone.');
 await context.grantPermissions(['microphone'],{origin:baseURL!});await page.addInitScript(noRecognition);await scriptedSpeech(page);
 const d=await openRecording(page);
 await d.getByRole('button',{name:'Recording settings',exact:true}).click();
 await expect(d.getByRole('switch',{name:/Move when I say a section/})).not.toBeChecked();
 await expect(d.getByRole('switch',{name:/Keep recording after Send & next/})).toBeVisible();
 await d.getByRole('button',{name:'Back',exact:true}).click();
 await recordIn(d,'2/CODE/reading');await expect(d.locator('.vs-dock-listening')).toHaveText('Not listening for section names');
});

test.describe('in the installed app',()=>{
 test('spoken section names are off by default',async({page})=>{
  await page.addInitScript(fakeRecognition);await nativeApp(page,{status:200,data:{transcription:{available:true},writing:{available:true}}});
  const d=await openRecording(page);
  await expect(d.getByRole('region',{name:'Recording and transcription status'})).toHaveCount(0);
  await d.getByRole('button',{name:'Recording settings',exact:true}).click();
  await expect(d.getByRole('switch',{name:/Move when I say a section/})).not.toBeChecked();
 });
 const lines:[string,{status:number;data?:unknown}|'offline',string][]=[
  ['not allowed',{status:403,data:{error:'Not for this account.'}},'This account cannot prepare recordings. You can still record; everything is saved on this phone.'],
  ['not set up',{status:503,data:{error:'Not configured.'}},'Preparing words is not set up yet. You can still record; everything is saved on this phone.'],
  ['not set up, one piece missing',{status:200,data:{transcription:{available:true},writing:{available:false}}},'Preparing words is not set up yet. You can still record; everything is saved on this phone.'],
  ['unreachable','offline','No connection. You can still record; your words will be prepared when you are back online.'],
  ['signed out',{status:401,data:{error:'Sign in.'}},'This version of the app cannot sign in, so your recordings cannot be prepared yet. They stay saved on this device.'],
 ];
 for(const [name,answer,line] of lines)test(`readiness: ${name}`,async({page})=>{
  await nativeApp(page,answer);const d=await openRecording(page);
  const status=d.getByRole('region',{name:'Recording and transcription status'});
  await expect(status).toContainText(line);await expect(status.getByRole('button',{name:'Retry',exact:true})).toHaveCount(0);
  await expect(d.getByRole('button',{name:'Record',exact:true})).toBeEnabled();
  if(name==='unreachable'&&test.info().project.name==='Phone')await page.screenshot({path:test.info().outputPath('readiness-unreachable.png')});
 });
});
