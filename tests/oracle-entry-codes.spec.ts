import { test, expect } from '@playwright/test';
import { buildHologeneticProfile } from '../lib/astrology/profile';
import { placeToUtc } from '../lib/astrology/places';
import { POSITION_KEYS } from '../data/profilePositions';

/* Build a real, valid StoredProfile the same way the app does, so the seeded
   localStorage entry passes loadProfile()'s validity gate (needs place.tzId +
   computed.lifesWork). Inject before navigation, per the auth-in-tests rule. */
function makeProfile() {
  const inputs = {
    date: '1990-06-15',
    time: '14:30',
    place: { label: 'Jakarta, Indonesia', lat: -6.2146, lng: 106.8451, tzId: 'Asia/Jakarta' },
  };
  const utcBirth = placeToUtc(inputs.date, inputs.time, inputs.place.tzId);
  const computed = buildHologeneticProfile({ utcBirth } as any);
  return { inputs, computed, updatedAt: new Date().toISOString() };
}

const KEY = 'ul.profile.v1';

test('no birth moment: rail invites, no card glows', async ({ page }) => {
  await page.goto('/universal-language');
  await expect(page.getByText('Your codes', { exact: false })).toBeVisible();
  await expect(page.locator('[data-oe-yours="1"]')).toHaveCount(0);
});

test('birth moment set: rail confirms, the profile cards glow', async ({ page }) => {
  const profile = makeProfile();
  const yourGates = new Set(POSITION_KEYS.map((k) => (profile.computed as any)[k]?.gate).filter(Boolean));

  await page.addInitScript(([key, val]) => {
    window.localStorage.setItem(key as string, val as string);
  }, [KEY, JSON.stringify(profile)] as const);

  await page.goto('/universal-language');

  // Rail switched to confirmation.
  await expect(page.getByText('Your codes are linked', { exact: false })).toBeVisible();

  // The deck glows exactly the profile's distinct gates (I Ching view default).
  const glowing = page.locator('[data-oe="ichgrid"] [data-oe-yours="1"]');
  await expect(glowing).toHaveCount(yourGates.size);
  expect(yourGates.size).toBeGreaterThan(0);

  await page.screenshot({ path: 'test-results/oracle-entry-codes-glow.png', fullPage: false });
});

test('linked "Your codes" tile routes to the Atlas', async ({ page }) => {
  const profile = makeProfile();
  await page.addInitScript(([key, val]) => {
    window.localStorage.setItem(key as string, val as string);
  }, [KEY, JSON.stringify(profile)] as const);

  await page.goto('/universal-language');
  await page.getByText('Your codes are linked', { exact: false }).click();
  await expect(page).toHaveURL(/\/atlas$/);
});
