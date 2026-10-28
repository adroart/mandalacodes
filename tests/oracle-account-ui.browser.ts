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
