import { test, expect } from './fixtures';

async function assertClearControls(page: import('@playwright/test').Page) {
  const collisions = await page.locator('.oracle-account-page').evaluate(root => {
    const controls = Array.from(root.querySelectorAll<HTMLElement>('input, button, textarea, a')).filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
    const issues: string[] = [];
    controls.forEach((a, i) => {
      const x = a.getBoundingClientRect();
      if (x.right > innerWidth + 1 || x.left < -1) issues.push(`outside screen: ${a.textContent || a.tagName}`);
      controls.slice(i + 1).forEach(b => {
        const y = b.getBoundingClientRect();
        if (Math.min(x.right,y.right)-Math.max(x.left,y.left)>1 && Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1) issues.push(`${a.textContent || a.tagName} overlaps ${b.textContent || b.tagName}`);
      });
    });
    return issues;
  });
  expect(collisions).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test.beforeEach(async ({ page, context }) => {
  await context.route(/^https:\/\//, route => route.abort());
  await page.addInitScript(() => {
    const w = window as any;
    w.webkit = { messageHandlers: { bridge: {}, oracleGoogleAuth: { postMessage: (body: any) => {
      if (body.action === 'start') window.dispatchEvent(new CustomEvent('oracle-google-result', { detail: { id: body.id, state: body.state, error: 'cancelled' } }));
    } } } };
    w.Capacitor = {
      PluginHeaders: [{name:'CapacitorHttp', methods:[{name:'request',rtype:'promise'}]}],
      nativePromise: async (_plugin: string, _method: string, options: any) => {
        const path = new URL(options.url).pathname;
        if (w.__nativeAccountFixture) return w.__nativeAccountFixture(path, options);
        if (path === '/api/auth/get-session') return {status:200,data:null,url:options.url};
        if (path === '/api/auth/email-otp/send-verification-otp') return {status:200,data:{success:true},url:options.url};
        return {status:401,data:{message:'Rejected test credentials'},url:options.url};
      },
    };
  });
});

for (const width of [320, 375, 430, 1024]) {
  test(`shared sign-in and backup controls do not overlap at ${width}px`, async ({page}, testInfo) => {
    await page.setViewportSize({width,height:844});
    await page.goto('/account');
    const panel = page.locator('.sign-in-panel');
    await expect(panel.getByRole('button',{name:'continue with google',exact:true})).toBeVisible();
    await expect(panel.getByLabel('Email',{exact:true})).toBeVisible();
    await expect(panel.getByLabel('Password',{exact:true})).toBeVisible();
    await assertClearControls(page);
    await panel.screenshot({path:testInfo.outputPath('login.png'),scale:'css'});
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({path:testInfo.outputPath('login-screen.png'),scale:'css'});
    await panel.getByLabel('Email',{exact:true}).fill('tester@example.com');
    await panel.getByLabel('Password',{exact:true}).fill('test-only-password');
    await panel.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(panel.getByRole('alert')).toContainText('Could not sign in');
    await expect(panel.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
    await panel.getByRole('button',{name:'Create an account',exact:true}).click();
    await expect(panel.getByLabel('Name (optional)',{exact:true})).toBeVisible();
    await assertClearControls(page);
    await panel.getByRole('button',{name:'Email me a code instead',exact:true}).click();
    await panel.getByRole('button',{name:'Send code',exact:true}).click();
    await expect(panel.getByLabel('6-digit code',{exact:true})).toBeVisible();
    await assertClearControls(page);
    await panel.getByLabel('6-digit code',{exact:true}).fill('123456');
    await panel.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(panel.getByRole('alert')).toContainText('could not be verified');
    await expect(panel.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
    await panel.getByRole('button',{name:'Use a different email',exact:true}).click();
    await panel.getByRole('button',{name:'Back to sign in',exact:true}).click();
    await panel.getByRole('button',{name:'continue with google',exact:true}).click();
    await expect(panel.getByRole('alert')).toContainText('cancelled');
    await expect(panel.getByRole('button',{name:'continue with google',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'Restore a backup',exact:true}).click();
    await expect(page.getByLabel('Paste an Oracle Birthday backup')).toBeVisible();
    await page.getByLabel('Paste an Oracle Birthday backup').fill(JSON.stringify({format:'oracle-birthday',version:1,inputs:{date:'2000-01-01',time:'09:30',place:{label:'A deliberately long place name for narrow phone layout verification',lat:27.7,lng:85.3,tzId:'Asia/Kathmandu'}}}));
    await page.getByRole('button',{name:'Preview restore',exact:true}).click();
    await expect(page.getByRole('button',{name:'Restore this chart',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeVisible();
    await assertClearControls(page);
    await page.screenshot({path:testInfo.outputPath('account.png'),fullPage:true,scale:'css'});
  });
}

// Exercise the iPhone-only reminder UI without requesting notification permission.
// Replace only the native bridge module served by the local test server.
for (const width of [320, 375, 430]) {
  for (const reminderState of ['off', 'on', 'denied']) {
    test(`native reminder controls stay separate at ${width}px when ${reminderState}`,async({page},testInfo)=>{
      await page.route('**/src/mobile/reminders/reminderBridge.ts',route=>route.fulfill({contentType:'application/javascript',body:`
        let state={authorization:${JSON.stringify(reminderState==='denied'?'denied':'authorized')},scheduled:${reminderState==='on'},enabled:${reminderState==='on'},hour:9,minute:0};
        window.reminderCalls=[];
        export function createReminderBridge(){return {available:true,
          status:async()=>({...state}),
          enable:async(hour,minute)=>{window.reminderCalls.push({action:'enable',hour,minute});state={...state,scheduled:true,enabled:true,hour,minute};return {...state};},
          disable:async()=>{window.reminderCalls.push({action:'disable'});state={...state,scheduled:false,enabled:false};return {...state};},
          openSettings:async()=>{window.reminderCalls.push({action:'settings'});}
        };}` }));
      await page.setViewportSize({width,height:844});
      await page.goto('/account');
      const section=page.locator('.oracle-reminder-settings');
      await expect(section.getByLabel('Local time')).toBeVisible();
      await section.scrollIntoViewIfNeeded();
      await assertClearControls(page);
      const time=section.getByLabel('Local time');
      // Actual iOS time-field painting also requires physical-device verification.
      await section.screenshot({path:testInfo.outputPath('reminders.png'),scale:'css'});
      expect(await page.evaluate(()=>(window as any).reminderCalls)).toEqual([]);
      if(reminderState==='denied') {
        await section.getByRole('button',{name:'Open iPhone Settings',exact:true}).click();
        expect(await page.evaluate(()=>(window as any).reminderCalls)).toEqual([{action:'settings'}]);
      } else {
        await time.fill('20:30');
        await section.getByRole('button',{name:reminderState==='on'?'Save time':'Enable reminder',exact:true}).click();
        await expect(section.getByRole('status')).toHaveText('Daily reminder saved.');
        expect(await page.evaluate(()=>(window as any).reminderCalls)).toEqual([{action:'enable',hour:20,minute:30}]);
        await assertClearControls(page);
        await section.getByRole('button',{name:'Turn off',exact:true}).click();
        await expect(section.getByRole('status')).toHaveText('Daily reminder turned off.');
      }
    });
  }
}


test('native saved session restores automatically after offline launch and foreground revalidation is single-flight',async({page})=>{
 await page.addInitScript(()=>{
  const w=window as any;w.accountCalls=[];w.accountAttempt=0;w.accountHold=false;w.accountRelease=undefined;w.expired=false;
  w.__nativeAccountFixture=async(path:string,options:any)=>{
   w.accountCalls.push(path);
   if(path==='/api/auth/get-session'){
    w.accountAttempt++;
    if(w.accountAttempt===1)throw new Error('Offline during startup');
    if(w.accountHold)await new Promise(resolve=>{w.accountRelease=resolve;});
    return {status:200,data:w.expired?null:{user:{id:'restored-native-test-user',email:'restored@example.test'}},url:options.url};
   }
   if(path==='/api/auth/sync-user')return {status:200,data:{ok:true},url:options.url};
   if(path==='/api/profile/get')return {status:200,data:null,url:options.url};
   if(path==='/api/collections/list')return {status:200,data:{collections:[]},url:options.url};
   return {status:401,data:{},url:options.url};
  };
 });
 await page.goto('/account');await expect(page.locator('.sign-in-panel')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>(window as any).accountAttempt)).toBe(1);
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.getByRole('region',{name:'Signed-in account'})).toContainText('restored@example.test');
 expect(await page.evaluate(()=>(window as any).accountCalls.filter((path:string)=>/sign-in|native\/exchange/.test(path)))).toEqual([]);
 await page.evaluate(()=>{const w=window as any;w.accountHold=true;for(let n=0;n<4;n++){window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));}});
 await expect.poll(()=>page.evaluate(()=>(window as any).accountAttempt)).toBe(3);
 await page.evaluate(()=>{const w=window as any;w.accountHold=false;w.accountRelease();});
 await expect(page.getByRole('region',{name:'Signed-in account'})).toContainText('restored@example.test');
 await page.evaluate(()=>{(window as any).expired=true;document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.locator('.sign-in-panel')).toBeVisible();
});

test('a native persistent session is revalidated on reopen without asking for credentials again',async({page})=>{
 await page.addInitScript(()=>{const w=window as any;w.accountCalls=[];w.__nativeAccountFixture=async(path:string,options:any)=>{w.accountCalls.push(path);return {status:200,data:path==='/api/auth/get-session'?{user:{id:'native-test-user',email:'saved@example.test'}}:path==='/api/collections/list'?{collections:[]}:null,url:options.url};};});
 await page.goto('/account');await expect(page.getByRole('region',{name:'Signed-in account'})).toContainText('saved@example.test');
 await page.reload();await expect(page.getByRole('region',{name:'Signed-in account'})).toContainText('saved@example.test');
 expect(await page.evaluate(()=>(window as any).accountCalls.filter((path:string)=>/sign-in|native\/exchange/.test(path)))).toEqual([]);
});

test('a delayed foreground session cannot sign the owner back in after explicit sign-out',async({page})=>{
 await page.addInitScript(()=>{
  const w=window as any;w.sessionCalls=0;w.signedIn=true;w.holdSession=false;
  w.__nativeAccountFixture=async(path:string,options:any)=>{
   if(path==='/api/auth/get-session'){
    w.sessionCalls++;const session=w.signedIn?{user:{id:'native-test-user',email:'signed-in@example.test'}}:null;
    if(w.holdSession&&w.sessionCalls===2)await new Promise(resolve=>{w.releaseSession=resolve;});
    return {status:200,data:session,url:options.url};
   }
   if(path==='/api/auth/sign-out')w.signedIn=false;
   return {status:200,data:path==='/api/collections/list'?{collections:[]}:null,url:options.url};
  };
 });
 await page.goto('/account');await expect(page.getByRole('region',{name:'Signed-in account'})).toContainText('signed-in@example.test');
 await page.evaluate(()=>{(window as any).holdSession=true;window.dispatchEvent(new Event('online'));});
 await expect.poll(()=>page.evaluate(()=>(window as any).sessionCalls)).toBe(2);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('.sign-in-panel')).toBeVisible();
 await page.evaluate(()=>{(window as any).releaseSession();});
 await expect(page.getByRole('region',{name:'Signed-in account'})).toHaveCount(0);await expect(page.locator('.sign-in-panel')).toBeVisible();
});

test('signing in from Studio resumes an auth-blocked saved take once without opening the microphone or applying words',async({page})=>{
 const words='These saved words are ready for my review.';
 await page.addInitScript(()=>{
  const w=window as any;w.recoverySignedIn=false;w.recoveryCalls=[];w.recoveryMicCalls=0;
  if(navigator.mediaDevices?.getUserMedia){const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{w.recoveryMicCalls++;return get(constraints);};}
  w.__nativeAccountFixture=async(path:string,options:any)=>{
   w.recoveryCalls.push({path,operation:options.data?.operation});
   const reply=(data:unknown,status=200)=>({status,data,url:options.url});
   if(path==='/api/auth/get-session')return reply(w.recoverySignedIn?{user:{id:'recovery-native-test-user',email:'recovery@example.test'}}:null);
   if(path==='/api/auth/native/exchange'){if(!options.data?.code||!options.data?.verifier||!options.data?.state)return reply({},400);w.recoverySignedIn=true;return reply({success:true});}
   if(path==='/api/auth/sync-user')return reply({ok:true});
   if(path==='/api/profile/get')return reply(null);
   if(path==='/api/collections/list')return reply({collections:[]});
   if(path==='/api/oracle/authoring/process'){
    if(!w.recoverySignedIn)return reply({},401);
    const spoken='These saved words are ready for my review.';
    if(options.data.operation==='transcribe')return reply({provider:'native-recovery-test-fixture',segments:[{text:spoken,startMs:0,endMs:1000,timing:'provider',sectionId:'CODE'}]});
    if(options.data.operation==='assimilate-sections')return reply({assimilation:{sections:[{sectionId:options.data.assimilation.startSectionId,text:spoken,evidenceQuotes:[spoken],changes:[],warnings:[]}],unassigned:[]}});
   }
   return reply({},401);
  };
 });
 await page.goto('/account');await expect(page.locator('.sign-in-panel')).toBeVisible();
 const saved=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const [{bundledSource},{cardSections},{createSession},{AuthoringStore},{SectionDraftStore,createSectionDraftSession}]=await Promise.all([load('/src/mobile/authoring/bundledSource.ts'),load('/lib/oracle/authoring/cardSections.ts'),load('/lib/oracle/authoring/workflow.ts'),load('/lib/oracle/authoring/storage.ts'),load('/lib/oracle/authoring/sectionDrafts.ts')]);
  const source=await bundledSource(2),sections=cardSections(source),destination=sections.find((section:any)=>section.id==='2/CODE/reading'),session=createSession(source),captureId='saved-auth-blocked-capture';
  session.captures=[{id:captureId,recordedAt:session.createdAt,mimeType:'audio/wav',durationMs:1000,status:'ready',origin:'microphone',visibleCardNumber:2}];
  const bytes=new Uint8Array(16044),view=new DataView(bytes.buffer),label=(at:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[at+i]=value.charCodeAt(i);};label(0,'RIFF');view.setUint32(4,16036,true);label(8,'WAVE');label(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);label(36,'data');view.setUint32(40,16000,true);
  const audio=new AuthoringStore();await audio.save(session,0);await audio.appendChunk(session.id,captureId,0,new Blob([bytes],{type:'audio/wav'}),1000);
  const blocked='Sign in to process on this phone. Your recording is saved.';
  const draft=await new SectionDraftStore().save({...createSectionDraftSession(source,sections,destination.id),captureSessionId:session.id,captureId,takes:[{id:'saved-auth-blocked-take',captureId,startSectionId:destination.id,markers:[],state:'failed',error:blocked,createdAt:session.createdAt}]},0);
  return {draftId:draft.id,audioId:session.id,captureId,bytes:Array.from(bytes)};
 });
 await page.goto('/authoring/2');const studio=page.getByRole('region',{name:'Voice recording',exact:true}),status=studio.getByRole('region',{name:'Recording and transcription status',exact:true});
 await expect(status).toContainText('1 recording saved on this device');await expect(status.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>(window as any).recoveryCalls.filter((call:any)=>call.operation==='transcribe'))).toHaveLength(0);
 // Stub only the OS browser result and native HTTP. The account provider, proof
 // creation/exchange, stores, take recovery and processing pipeline remain real.
 await page.evaluate(()=>{const w=window as any;w.webkit.messageHandlers.oracleGoogleAuth.postMessage=(body:any)=>{if(body.action==='start')window.dispatchEvent(new CustomEvent('oracle-google-result',{detail:{id:body.id,state:body.state,code:'c'.repeat(43)}}));};});
 await status.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect.poll(()=>page.evaluate(async id=>{const path='/lib/oracle/authoring/sectionDrafts.ts';const {SectionDraftStore}=await import(path);const draft=await new SectionDraftStore().get(id);return draft?.takes?.[0]?.state;},saved.draftId)).toBe('review');
 await studio.locator('.vs-section[data-section-id="2/CODE/reading"]').getByRole('button',{name:'Review your words',exact:true}).click();
 await expect(studio.getByRole('textbox',{name:'Your section words',exact:true})).toHaveValue(words);
 const retained=await page.evaluate(async({draftId,audioId,captureId})=>{const load=(path:string)=>import(path);const [{SectionDraftStore},{AuthoringStore},{WorkingCardStore}]=await Promise.all([load('/lib/oracle/authoring/sectionDrafts.ts'),load('/lib/oracle/authoring/storage.ts'),load('/lib/oracle/authoring/humanDrafts.ts')]);const draft=await new SectionDraftStore().get(draftId),audio=new AuthoringStore(),saved=await audio.load(audioId);return {takes:draft.takes.length,transcripts:saved.session.transcript.length,applied:!!draft.results[0].applied,checked:draft.results[0].checked,bytes:Array.from(new Uint8Array(await(await audio.audio(audioId,captureId)).arrayBuffer())),chunks:(await audio.chunks(audioId)).length,working:(await new WorkingCardStore().list(2)).length};},saved);
 expect(retained).toMatchObject({takes:1,transcripts:1,applied:false,checked:false,chunks:1,working:0});expect(retained.bytes).toEqual(saved.bytes);
 const calls=await page.evaluate(()=>(window as any).recoveryCalls);expect(calls.filter((call:any)=>call.operation==='transcribe')).toHaveLength(1);expect(calls.filter((call:any)=>call.operation==='assimilate-sections')).toHaveLength(1);expect(calls.filter((call:any)=>call.path==='/api/auth/native/exchange')).toHaveLength(1);expect(await page.evaluate(()=>(window as any).recoveryMicCalls)).toBe(0);
});
