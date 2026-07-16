import { expect, test, type Page } from '@playwright/test';

const CARD = '/universal-language/22';
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

async function dismissEntrance(page: Page) {
  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  await entrance.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  if (await entrance.isVisible()) await entrance.click();
}

async function mockAdminRecorder(page: Page, segment: { transcript?: string; transcriptionStatus?: string; transcriptionError?: string | null; transcriptionStartedAt?: string | null } = {}) {
  await page.addInitScript(() => {
    const track = { stop() {} };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
    class FakeMediaRecorder {
      static isTypeSupported(type: string) { return type === 'audio/mp4;codecs=mp4a.40.2' || type === 'audio/mp4' || type === 'audio/webm;codecs=opus'; }
      state = 'inactive'; mimeType = 'audio/mp4;codecs=mp4a.40.2'; ondataavailable: ((event: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
      constructor(_stream: unknown, options?: { mimeType?: string }) { if (options?.mimeType) this.mimeType = options.mimeType; }
      start() { this.state = 'recording'; }
      requestData() {}
      stop() { this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) }); this.state = 'inactive'; this.onstop?.(); }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });
  });
  await page.route('**/api/oracle/reflections/capability', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, admin: true }) }));
  await page.route('**/api/oracle/reflections/sessions**', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'session-22', hexagramNumber: 22, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), finishedAt: null }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { id: 'session-22', hexagramNumber: 22, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), finishedAt: null }, history: [] }) });
  });
  await page.route('**/api/oracle/reflections/segments**', route => {
    const row = { id: 'segment-1', sessionId: 'session-22', sequence: 0, recordedAt: new Date().toISOString(), durationMs: 12_000, mimeType: 'audio/webm;codecs=opus', byteSize: 5, transcript: segment.transcript ?? 'Let beauty arise.', transcriptionStatus: segment.transcriptionStatus ?? 'transcribed', transcriptionError: segment.transcriptionError ?? null, transcriptionStartedAt: segment.transcriptionStartedAt ?? null, updatedAt: new Date().toISOString() };
    const transcribing = new URL(route.request().url()).pathname.endsWith('/transcribe');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(transcribing ? { segment: row } : { segments: [row] }) });
  });
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
  await expect(recorder.locator('.reflection-recorder-bar__slot')).toHaveCount(5);
  await expect(recorder.locator('.reflection-recorder-bar__control')).toHaveCount(3);
  await expect(recorder.locator('.reflection-recorder-bar__control').first()).toHaveClass(/oracle-bottom-nav__slot/);
  expect(await recorder.locator('.reflection-recorder-bar__inner').evaluate((element) => getComputedStyle(element).maxWidth)).toBe('480px');
  expect((await recorder.boundingBox())!.height).toBeLessThanOrEqual(54);
  await expect(recorder).toHaveCSS('backdrop-filter', 'none');
  await expect(recorder).toHaveCSS('background-color', 'rgb(20, 16, 11)');
  await expect(recorder.getByRole('button', { name: 'Finish private reflection' })).toBeVisible();
  await expect(recorder.locator('.reflection-recorder-bar__meter')).toBeVisible();
  await expect(recorder.locator('.reflection-recorder-bar__meter-bar')).toHaveCount(3);
});

test('saved feedback, Resume emphasis, and Journal count come from local persistence', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);

  const recorder = page.getByRole('navigation', { name: 'Private reflection recorder' });
  await recorder.getByRole('button', { name: 'Pause and save this segment' }).click();
  await expect(recorder.locator('.reflection-recorder-bar__state').getByText('Saved privately', { exact: true })).toBeVisible();
  await expect(recorder.getByRole('button', { name: 'Resume recording a new segment' })).toHaveClass(/is-primary/);
  await expect(recorder.getByRole('button', { name: 'Journal, 1 saved segment' })).toBeVisible();
  await expect(recorder.locator('.reflection-recorder-bar__badge')).toHaveText('1');
  await expect(recorder.locator('.reflection-recorder-bar__meter')).toHaveCount(0);
});

test('saved recorder surfaces a non-final transcription response without losing the audio', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.route('**/api/oracle/reflections/segments/**/transcribe', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Groq rate limit reached; retry later' }) }));
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);

  const recorder = page.getByRole('navigation', { name: 'Private reflection recorder' });
  await recorder.getByRole('button', { name: 'Pause and save this segment' }).click();
  await expect(recorder.locator('.reflection-recorder-bar__announcement')).toHaveText('Groq rate limit reached; retry later');
  await expect(recorder.locator('.reflection-recorder-bar__state')).toContainText('Transcript retry');
  const notice = recorder.locator('.reflection-recorder-bar__transcription-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Audio saved privately');
  await expect(notice).toContainText('Groq rate limit reached; retry later');
  await expect(recorder.getByRole('button', { name: 'Journal, 1 saved segment' })).toBeVisible();
});

test('reduced motion keeps recorder activity static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockAdminRecorder(page);
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);

  const recorder = page.getByRole('navigation', { name: 'Private reflection recorder' });
  await expect(recorder.locator('.reflection-recorder-bar__state > i')).toHaveCSS('animation-name', 'none');
  const transitionSeconds = Number.parseFloat(await recorder.locator('.reflection-recorder-bar__meter-bar').first().evaluate((element) => getComputedStyle(element).transitionDuration));
  expect(transitionSeconds).toBeLessThan(.001);
});

test('Finish cannot strand the recorder while microphone permission is pending', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => new Promise(() => undefined) },
    });
  });
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);

  const recorder = page.getByRole('navigation', { name: 'Private reflection recorder' });
  await expect(recorder.getByRole('button', { name: 'Finish private reflection' })).toBeDisabled();
  await expect(recorder.locator('.reflection-recorder-bar__state')).toContainText('Requesting mic');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(recorder).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Reading actions' })).toBeVisible();
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

  expect(await center.evaluate((element) => {
    const styles = getComputedStyle(element);
    return styles.userSelect || styles.getPropertyValue('-webkit-user-select');
  })).toBe('none');
  await expect(center).toHaveCSS('touch-action', 'none');
  expect(contextMenuPrevented).toBe(true);
});

test('administrator hold captures the touch pointer and survives pointer leave', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.evaluate((element) => {
    (element as HTMLElement & { capturedPointer?: number }).setPointerCapture = (pointerId: number) => {
      (element as HTMLElement & { capturedPointer?: number }).capturedPointer = pointerId;
    };
  });
  await center.dispatchEvent('pointerdown', { pointerId: 17, pointerType: 'touch', isPrimary: true, button: 0 });
  await expect.poll(() => center.evaluate((element) => (element as HTMLElement & { capturedPointer?: number }).capturedPointer)).toBe(17);
  await center.dispatchEvent('pointerleave', { pointerId: 17, pointerType: 'touch', isPrimary: true, button: 0 });
  await page.waitForTimeout(700);
  await expect(page.getByRole('navigation', { name: 'Private reflection recorder' })).toBeVisible();
});

test('signed-in non-admin visitors receive no recorder disclosure', async ({ page }) => {
  await page.route('**/api/oracle/reflections/capability', route => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'forbidden' }) }));
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  await expect(page.locator('[data-admin-recorder]')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Reading actions' })).toBeVisible();
});

test('invocation Back returns to the same Journal', async ({ page }) => {
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
  await composer.getByRole('button', { name: 'Back to journal' }).click();
  await expect(composer).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Journal · 22' })).toBeVisible();
});

test('journal is a contained full-screen surface whose Close exits reflection', async ({ page }) => {
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
  await expect(journal.locator('.reflection-segment').first()).toHaveClass(/is-newest/);
  await expect(journal.locator('audio.reflection-segment__audio')).toHaveAttribute('src', /\/api\/oracle\/reflections\/segments\/segment-1\/audio/);
  await expect(journal.getByRole('button', { name: 'Play recording for segment 1' })).toBeVisible();
  await expect(journal.getByRole('button', { name: 'Record more' })).toBeVisible();
  await journal.getByRole('slider', { name: 'Recording position for segment 1' }).focus();
  await page.keyboard.press('Tab');
  await expect(journal.getByRole('button', { name: 'Record more' })).toBeFocused();
  expect(await journal.evaluate((element) => element.parentElement?.tagName)).toBe('BODY');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

  const close = journal.getByRole('button', { name: 'Close journal' });
  await expect(close).toBeInViewport();
  await close.click();
  await expect(journal).toHaveCount(0);
  await expect(recorder).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Reading actions' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('Finish saves the segment and opens Journal', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);

  const recorder = page.getByRole('navigation', { name: 'Private reflection recorder' });
  await recorder.getByRole('button', { name: 'Finish private reflection' }).click();
  await expect(page.getByRole('dialog', { name: 'Journal · 22' })).toBeVisible();
  await expect(recorder).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Reading actions' })).toBeHidden();
});

test('Done exits Journal and restores the ordinary reading rail', async ({ page }) => {
  await mockAdminRecorder(page);
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);

  const recorder = page.getByRole('navigation', { name: 'Private reflection recorder' });
  await recorder.getByRole('button', { name: 'Finish private reflection' }).click();
  const journal = page.getByRole('dialog', { name: 'Journal · 22' });
  await journal.getByRole('button', { name: 'Done with reflection' }).click();
  await expect(journal).toHaveCount(0);
  await expect(recorder).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Reading actions' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' })).toHaveCount(0);
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

test('journal shows terminal transcription errors without automatically retrying them', async ({ page }) => {
  await mockAdminRecorder(page, { transcript: '', transcriptionStatus: 'failed', transcriptionError: 'Groq transcription failed; retry later' });
  let transcriptionRequests = 0;
  await page.route('**/api/oracle/reflections/segments/segment-1/transcribe', route => {
    transcriptionRequests += 1;
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Groq unavailable for this recording' }) });
  });
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Journal' }).click();

  await expect(page.getByText('Groq transcription failed; retry later')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  expect(transcriptionRequests).toBe(0);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.reflection-journal__announce')).toHaveText('Groq unavailable for this recording');
  expect(transcriptionRequests).toBe(1);
});

test('journal preserves a rejected automatic transcription response', async ({ page }) => {
  await mockAdminRecorder(page, { transcript: '', transcriptionStatus: 'transcription_pending' });
  await page.route('**/api/oracle/reflections/segments/segment-1/transcribe', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Groq allocation exhausted; retry later' }) }));
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Journal' }).click();

  await expect(page.locator('.reflection-journal__announce')).toHaveText('Groq allocation exhausted; retry later');
});

test('journal automatically reclaims an expired transcription lease', async ({ page }) => {
  await mockAdminRecorder(page, { transcript: '', transcriptionStatus: 'transcribing', transcriptionStartedAt: new Date(Date.now() - 6 * 60_000).toISOString() });
  let transcriptionRequests = 0;
  await page.route('**/api/oracle/reflections/segments/segment-1/transcribe', route => {
    transcriptionRequests += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ segment: { id: 'segment-1', sessionId: 'session-22', sequence: 0, recordedAt: new Date().toISOString(), durationMs: 12_000, mimeType: 'audio/webm;codecs=opus', byteSize: 5, transcript: 'Recovered after the expired lease.', transcriptionStatus: 'transcribed', transcriptionError: null, transcriptionStartedAt: null, updatedAt: new Date().toISOString() } }) });
  });
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const center = page.locator('[data-current-hexagram]');
  await center.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Journal' }).click();

  await expect(page.getByText('Recovered after the expired lease.')).toBeVisible();
  expect(transcriptionRequests).toBe(1);
});
