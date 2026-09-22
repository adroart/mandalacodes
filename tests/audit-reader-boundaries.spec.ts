import { test, expect } from './fixtures';
import { POSITION_KEYS } from '../data/profilePositions';
const profile = {
  inputs: {date:'1990-06-15',time:'14:30',place:{label:'Synthetic guest city',lat:1,lng:2,tzId:'Asia/Makassar'}},
  computed:Object.fromEntries(POSITION_KEYS.map(key=>[key,{gate:64,line:6}])),updatedAt:'2026-09-22T00:00:00.000Z',
};
test.beforeEach(async ({ context }) => {
  await context.route('**/api/**', route => route.fulfill({status:200,contentType:'application/json',body:'null'}));
  await context.route(/^https:\/\//, route => route.abort());
});
test('guest chart survives a signed-out reload', async ({page}) => {
  await page.goto('/profile');
  await page.evaluate(value=>localStorage.setItem('ul.profile.v1',JSON.stringify(value)),profile);
  await page.reload();
  await expect(page.getByRole('button',{name:'Share',exact:true})).toBeVisible();
  await expect(page.getByText(/Synthetic guest city/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Share',exact:true})).toBeVisible();
});
test('first account 204 uploads guest and exposes rejected cloud sync', async ({page}) => {
  let signedIn=false;
  let puts=0;
  await page.route('**/api/auth/get-session', route=>route.fulfill({json:signedIn?{session:{id:'synthetic-session',userId:'synthetic-a',expiresAt:'2099-01-01T00:00:00.000Z'},user:{id:'synthetic-a',email:'synthetic@example.test',emailVerified:true}}:null}));
  await page.route('**/api/profile/get', route=>route.fulfill({status:204}));
  await page.route('**/api/profile/put', route=>{puts++;return route.fulfill({status:503,json:{error:'unavailable'}});});
  await page.goto('/profile');
  await page.evaluate(value=>localStorage.setItem('ul.profile.v1',JSON.stringify(value)),profile);
  signedIn=true;
  await page.reload();
  await expect.poll(()=>puts).toBe(1);
  await expect(page.getByRole('alert')).toContainText('saved on this device');
  await expect(page.getByRole('button',{name:'Share',exact:true})).toBeVisible();
  signedIn=false;
  await page.reload();
  await expect(page.getByRole('button',{name:'Share',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('ul.profile.v1'))).toBeNull();
});
for(const route of ['/atlas/claim?piece=UL-122:2','/atlas/homecoming?piece=UL-122','/make?piece=UL-122','/atlas/edit']) {
  test(`retired entrance ${route} discloses boundary before inputs`, async ({page})=>{
    const retired:string[]=[];
    page.on('request',r=>{if(r.url().includes('/api/atlas/'))retired.push(r.url());});
    await page.goto(route);
    await expect(page.getByText(/handled on the artist site|Collector registration is not open/)).toBeVisible();
    await expect(page.locator('input,textarea')).toHaveCount(0);
    expect(retired).toEqual([]);
    if(route.includes('UL-122'))await expect(page.getByRole('link',{name:'View this artwork on the artist site'})).toHaveAttribute('href','https://adrianrasmussen.com/creations/UL-122?from=mandalacodes&card=1');
  });
}
test('generic catalogue design is not an issued certificate; unknown edition stays missing', async ({page})=>{
  await page.goto('/piece/UL-122');
  await expect(page.getByText(/This page describes the artwork design/)).toBeVisible();
  await expect(page.getByRole('link',{name:'View the sculpture and inquire'})).toHaveAttribute('href','https://adrianrasmussen.com/creations/UL-122?from=mandalacodes&card=1');
  await page.route('**/api/atlas', route=>route.fulfill({json:{ok:true,state:{schemaVersion:2,pieces:[],cities:[]}}}));
  await page.goto('/piece/UL-122/999');
  await expect(page.getByText(/not.*record|not.*found|not.*arrived/i).first()).toBeVisible();
  await expect(page.getByText(/This page describes the artwork design/)).toHaveCount(0);
});

test('city download failure is explicit and the same query can retry', async ({page})=>{
  let attempts=0;
  await page.route('**/data/cities-index.json', route=>++attempts===1
    ? route.fulfill({status:503,body:''})
    : route.fulfill({json:[{name:'Denpasar',country:'Indonesia',cc:'ID',lat:-8,lng:115,tz:'Asia/Makassar'}]}));
  await page.goto('/profile');
  await page.getByRole('combobox',{name:'Birth place'}).fill('Denpasar');
  await expect(page.getByText('City search is unavailable.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Retry city search'}).click();
  await expect(page.getByRole('option')).toContainText('Denpasar');
});
