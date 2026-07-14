import { expect, test, type Page } from '@playwright/test';

const CARD = '/universal-language/22';
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

async function dismissEntrance(page: Page) {
  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  await entrance.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  if (await entrance.isVisible()) await entrance.click();
}

async function mockAdminRecorder(page: Page, segment: { transcript?: string; transcriptionStatus?: string } = {}) {
  await page.addInitScript(() => {
    const track = { stop() {} };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
    class FakeMediaRecorder {
      static isTypeSupported(type: string) { return type === 'audio/webm;codecs=opus'; }
      state = 'inactive'; mimeType = 'audio/webm;codecs=opus'; ondataavailable: ((event: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
      constructor(_stream: unknown, options?: { mimeType?: string }) { if (options?.mimeType) this.mimeType = options.mimeType; }
      start() { this.state = 'recording'; }
      stop() { this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) }); this.state = 'inactive'; this.onstop?.(); }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });
  });
  await page.route('**/api/oracle/reflections/capability', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, admin: true }) }));
  await page.route('**/api/oracle/reflections/sessions**', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'session-22', hexagramNumber: 22, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), finishedAt: null }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { id: 'session-22', hexagramNumber: 22, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), finishedAt: null }, history: [] }) });
  });
  await page.route('**/api/oracle/reflections/segments**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ segments: [{ id: 'segment-1', sessionId: 'session-22', sequence: 0, recordedAt: new Date().toISOString(), durationMs: 12_000, mimeType: 'audio/webm;codecs=opus', byteSize: 5, transcript: segment.transcript ?? 'Let beauty arise.', transcriptionStatus: segment.transcriptionStatus ?? 'transcribed', transcriptionError: null, updatedAt: new Date().toISOString() }] }) }));
}

test('administrator hold replaces only the sticky footer with the compact recorder', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);
  await expect(page.getByRole('navigation', { name: 'Private reflection recorder' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hexagram navigation' })).toBeHidden();
  await expect(page.getByText('The work is small', { exact: false })).toBeVisible();
});

test('recorder uses the same compact rail as the ordinary Oracle bottom navigation', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);

  const recorder = page.getByRole('navigation', { name: 'Private reflection recorder' });
  await expect(recorder).toHaveClass(/oracle-bottom-nav/);
  await expect(recorder.locator('.reflection-recorder-bar__inner')).toHaveClass(/oracle-bottom-nav__inner/);
  await expect(recorder.locator('.reflection-recorder-bar__control')).toHaveCount(2);
  await expect(recorder.locator('.reflection-recorder-bar__control').first()).toHaveClass(/oracle-bottom-nav__slot/);
  expect(await recorder.locator('.reflection-recorder-bar__inner').evaluate((element) => getComputedStyle(element).maxWidth)).toBe('480px');
  expect((await recorder.boundingBox())!.height).toBeLessThanOrEqual(54);
  await expect(recorder.locator('.reflection-recorder-bar__control-icon, .reflection-recorder-bar__journal-icon')).toHaveCount(0);
});

test('a short tap remains ordinary All 64 navigation', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  await page.locator('[data-current-hexagram]').click();
  await expect(page).toHaveURL(/\/universal-language$/);
});

test('administrator center is not a previewable link and suppresses the native mobile menu', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');

  await expect(center).toHaveJSProperty('tagName', 'BUTTON');
  await expect(center).not.toHaveAttribute('href');

  const contextMenuPrevented = await center.evaluate((element) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });

  await expect(center).toHaveCSS('user-select', 'none');
  expect(contextMenuPrevented).toBe(true);
});

test('signed-in non-admin visitors receive no recorder disclosure', async ({ page }) => {
  await page.route('**/api/oracle/reflections/capability', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'forbidden' }) }));
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  await expect(page.locator('[data-admin-recorder]')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Reading actions' })).toBeVisible();
});

test('journal shifts arranged segments into the full-screen invocation composer', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.route('**/api/oracle/invocations/22/draft**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'draft-22', hexagramNumber: 22, sessionId: 'session-22', title: 'Grace', blocks: [{ id: 'segment:segment-1', kind: 'segment', segmentId: 'segment-1', markdown: 'Let beauty arise.', sortOrder: 0 }], updatedAt: new Date().toISOString() }) }));
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Journal' }).click();
  await page.getByRole('button', { name: 'Shift to invocation' }).click();
  const composer = page.getByRole('dialog', { name: 'Invocation composer' });
  await expect(composer).toBeVisible();
  await composer.getByRole('button', { name: 'Shift to Invocation' }).click();
  await expect(page.locator('.invocation-block textarea')).toHaveValue('Let beauty arise.');
});

test('journal is a contained full-screen surface that closes back to the recorder', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);

  const recorder = page.getByRole('navigation', { name: 'Private reflection recorder' });
  await recorder.getByRole('button', { name: 'Journal' }).click();
  const journal = page.getByRole('dialog', { name: 'Journal · 22' });
  await expect(journal).toBeVisible();
  await expect(recorder).toBeHidden();
  expect(await journal.evaluate((element) => element.parentElement?.tagName)).toBe('BODY');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

  const close = journal.getByRole('button', { name: 'Close journal' });
  await expect(close).toBeInViewport();
  await close.click();
  await expect(journal).toHaveCount(0);
  await expect(recorder).toBeVisible();
  await expect(recorder.getByRole('button', { name: 'Journal' })).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  await recorder.getByRole('button', { name: 'Journal' }).click();
  await expect(journal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(journal).toHaveCount(0);
  await expect(recorder).toBeVisible();
  await expect(recorder.getByRole('button', { name: 'Journal' })).toBeFocused();
});

test('journal automatically transcribes pending saved audio without requiring Retry', async ({ page }) => {
  await mockAdminRecorder(page, { transcript: '', transcriptionStatus: 'transcription_pending' });
  let transcriptionRequests = 0;
  await page.route('**/api/oracle/reflections/segments/segment-1/transcribe', route => {
    transcriptionRequests += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ segment: { id: 'segment-1', sessionId: 'session-22', sequence: 0, recordedAt: new Date().toISOString(), durationMs: 12_000, mimeType: 'audio/webm;codecs=opus', byteSize: 5, transcript: 'The journal wrote this automatically.', transcriptionStatus: 'transcribed', transcriptionError: null, updatedAt: new Date().toISOString() } }) });
  });
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Journal' }).click();

  await expect(page.getByText('The journal wrote this automatically.')).toBeVisible();
  expect(transcriptionRequests).toBe(1);
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
});
