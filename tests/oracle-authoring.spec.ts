import { test, expect } from '@playwright/test';

test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } });
const preview = '/components/oracle/authoring/preview.html';
function silence() {
  const data = Buffer.alloc(32044);
  data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24); data.writeUInt32LE(16000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(32000, 40);
  return data;
}

test('imports, corrects, approves and transfers a private review without changing the manuscript', async ({ page }, testInfo) => {
  await page.goto(preview);
  await page.getByRole('button', { name: 'New card review' }).click();
  await page.getByLabel('Duration, seconds').fill('2');
  await page.locator('input[type=file]').setInputFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: silence() });
  await expect(page.getByRole('button', { name: 'Recording 1 · 0:02', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check speech', exact: true }).click();
  await page.getByLabel('Original words', { exact: true }).fill('Original spoken phrase.');
  await page.getByRole('button', { name: 'Save excerpt', exact: true }).click();
  await page.getByLabel('Corrected words').fill('Corrected spoken phrase.');
  await page.getByRole('button', { name: 'Compare & approve', exact: true }).click();
  if (testInfo.project.name.startsWith('Mobile')) await page.getByRole('button', { name: 'Spoken', exact: true }).click();
  await page.getByRole('button', { name: 'Play cited audio', exact: true }).click();
  await expect(page.locator('audio')).toHaveJSProperty('paused', false);
  if (testInfo.project.name.startsWith('Mobile')) await page.getByRole('button', { name: 'Proposed', exact: true }).click();
  await page.getByRole('button', { name: 'Use corrected words', exact: true }).click();
  await page.getByRole('button', { name: 'Save proposed section', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Approve exact changes', exact: true }).click();
  await expect(page.getByText('Approved receipt saved. Canonical manuscript has not been changed.', { exact: true })).toBeVisible();
  const manuscriptDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export approved manuscript', exact: true }).click();
  const approvedFile = await manuscriptDownload;
  const approvedText = await (await import('node:fs/promises')).readFile((await approvedFile.path())!, 'utf8');
  expect(approvedText).toContain('Corrected spoken phrase.');
  expect(approvedText).toContain('## BODY');
  const bundleDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export review', exact: true }).click();
  const bundle = await bundleDownload;
  const bundlePath = (await bundle.path())!;
  const parsed = JSON.parse(await (await import('node:fs/promises')).readFile(bundlePath, 'utf8'));
  expect(parsed.session.transcript[0].raw).toBe('Original spoken phrase.');
  expect(parsed.session.transcript[0].corrected).toBe('Corrected spoken phrase.');
  expect(parsed.receipts).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles(bundlePath);
  await expect(page.getByLabel('Corrected words')).toHaveValue('Corrected spoken phrase.');
  await page.getByRole('button', { name: 'Compare & approve', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export approved manuscript', exact: true })).toHaveCount(0);
});

test('records microphone chunks and section hints, then recovers the session after reload', async ({ page, context, browserName, baseURL }) => {
  test.skip(browserName !== 'chromium', 'Chromium fake microphone fixture');
  await context.grantPermissions(['microphone'], { origin: baseURL! });
  await page.goto(preview);
  await page.getByRole('button', { name: 'New card review' }).click();
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(page.locator('.oa-status')).toContainText('Recording 0:01');
  await page.locator('.oa-toolbar select').selectOption('BODY');
  await page.getByRole('button', { name: 'Finish recording', exact: true }).click();
  await expect(page.locator('.oa-clips')).toContainText('ready');
  await expect(page.locator('audio')).toHaveJSProperty('readyState', 4);
  await page.reload();
  await page.getByRole('button', { name: /Card 1 ·/ }).click();
  await expect(page.locator('.oa-clips')).toContainText('ready');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export review', exact: true }).click();
  const file = await downloadPromise;
  const parsed = JSON.parse(await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8'));
  expect(parsed.session.markers.map((m: {sectionId: string}) => m.sectionId)).toEqual(['CODE', 'BODY']);
  expect(parsed.audio[0].base64.length).toBeGreaterThan(100);
});
