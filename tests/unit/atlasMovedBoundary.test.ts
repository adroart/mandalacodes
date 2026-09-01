import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ATLAS_BOUNDARY_DESTINATION,
  ATLAS_BOUNDARY_SENTENCE,
  atlasBoundaryFrom,
  atlasFailureMessage,
  readAtlasBoundary,
} from '../../lib/atlas/boundary';
import AtlasMovedNotice from '../../components/atlas/AtlasMovedNotice';
import { claimBeatForFailure } from '../../components/atlas/StewardClaim';

/* The middleware's own bodies, copied from functions/api/atlas/_middleware.ts.
   If those change, this test should be the thing that notices. */
const MOVED_BODY = {
  ok: false,
  error: 'atlas_moved',
  message:
    'The Atlas collector record moved to Adrian-Website and is read-only on Mandala Codes.',
  readOnly: true,
  movedAt: '2026-08-09',
  destination: 'https://adrianrasmussen.com/api/atlas',
};

const READER_MOVED_BODY = {
  ...MOVED_BODY,
  error: 'atlas_reader_moved',
  message:
    'This Atlas reader depended on Mandala Codes historical holder records and is retired until its canonical reader is available.',
};

describe('recognising the moved boundary', () => {
  it('reads a 410 carrying atlas_moved', () => {
    const boundary = atlasBoundaryFrom(410, MOVED_BODY);
    expect(boundary).not.toBeNull();
    expect(boundary?.code).toBe('atlas_moved');
    expect(boundary?.serverMessage).toBe(MOVED_BODY.message);
  });

  it('reads a 410 carrying atlas_reader_moved', () => {
    expect(atlasBoundaryFrom(410, READER_MOVED_BODY)?.code).toBe(
      'atlas_reader_moved',
    );
  });

  it('ignores a genuinely transient failure', () => {
    expect(atlasBoundaryFrom(500, { ok: false, error: 'boom' })).toBeNull();
    expect(atlasBoundaryFrom(404, { ok: false })).toBeNull();
    expect(atlasBoundaryFrom(410, { ok: false, error: 'gone_for_other_reasons' })).toBeNull();
  });

  it('turns the API destination into a page a person can open', () => {
    expect(atlasBoundaryFrom(410, MOVED_BODY)?.destination).toBe(
      'https://adrianrasmussen.com/atlas',
    );
  });

  it('falls back to the canonical door when the server names nothing usable', () => {
    for (const destination of [undefined, '', 'javascript:alert(1)', 'not a url']) {
      const boundary = atlasBoundaryFrom(410, { ...MOVED_BODY, destination });
      expect(boundary?.destination, String(destination)).toBe(
        ATLAS_BOUNDARY_DESTINATION,
      );
    }
  });

  it('reads the boundary off a real Response without consuming it', async () => {
    const res = new Response(JSON.stringify(MOVED_BODY), {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    });
    const boundary = await readAtlasBoundary(res);
    expect(boundary?.code).toBe('atlas_moved');
    await expect(res.json()).resolves.toMatchObject({ error: 'atlas_moved' });
  });
});

describe('no raw error code reaches a human', () => {
  it('speaks the house sentence on a moved boundary', () => {
    expect(atlasFailureMessage(410, MOVED_BODY, 'Something went wrong.')).toBe(
      ATLAS_BOUNDARY_SENTENCE,
    );
    expect(ATLAS_BOUNDARY_SENTENCE).not.toContain('atlas_moved');
  });

  it('never passes a bare code through as copy', () => {
    expect(atlasFailureMessage(400, { error: 'piece_not_found' }, 'Fallback.')).toBe(
      'Fallback.',
    );
    expect(atlasFailureMessage(400, { error: 'atlas_moved' }, 'Fallback.')).toBe(
      'Fallback.',
    );
  });

  it('still passes a real sentence from the server through', () => {
    expect(
      atlasFailureMessage(400, { error: 'Choose a size, or describe your own' }, 'Fallback.'),
    ).toBe('Choose a size, or describe your own');
  });
});

describe('the boundary surface', () => {
  const boundary = atlasBoundaryFrom(410, MOVED_BODY)!;

  it('renders one sentence and one working door', () => {
    const html = renderToStaticMarkup(createElement(AtlasMovedNotice, { boundary }));
    expect(html).toContain('https://adrianrasmussen.com/atlas');
    expect(html).toContain('href=');
    expect(html).toContain(ATLAS_BOUNDARY_SENTENCE);
  });

  it('offers no retry, because retrying a 410 cannot succeed', () => {
    const html = renderToStaticMarkup(createElement(AtlasMovedNotice, { boundary }));
    expect(html).not.toContain('<button');
    expect(html.toLowerCase()).not.toContain('try again');
    expect(html.toLowerCase()).not.toContain('retry');
  });

  it('shows no code, no apology, no em dash, no italics', () => {
    const html = renderToStaticMarkup(createElement(AtlasMovedNotice, { boundary }));
    expect(html).not.toContain('atlas_moved');
    expect(html).not.toContain('atlas_reader_moved');
    expect(html).not.toContain('—');
    expect(html).not.toContain('<em');
    expect(html).not.toContain('italic');
    expect(html.toLowerCase()).not.toContain('error');
    expect(html.toLowerCase()).not.toContain('sorry');
  });
});

describe('the claim ceremony at the boundary', () => {
  it('sends a 410 to the moved beat, not the retryable error beat', () => {
    expect(claimBeatForFailure(410, MOVED_BODY)).toBe('moved');
    expect(claimBeatForFailure(410, READER_MOVED_BODY)).toBe('moved');
  });

  it('never offers a retry for a 410 whose body will not read back', () => {
    expect(claimBeatForFailure(410, null)).toBe('moved');
  });

  it('keeps the no-record and transient beats exactly as they were', () => {
    expect(claimBeatForFailure(404, { ok: false })).toBe('no-record');
    expect(claimBeatForFailure(500, { ok: false })).toBe('error');
  });

  it('renders the moved beat through the shared surface, with no try again', async () => {
    const source = await readFile(
      resolve('components/atlas/StewardClaim.tsx'),
      'utf8',
    );
    const moved = source.slice(
      source.indexOf("{beat === 'moved' &&"),
      source.indexOf("{beat === 'arrival' &&"),
    );
    expect(moved).toContain('AtlasMovedNotice');
    expect(moved.toLowerCase()).not.toContain('try again');
    expect(moved).not.toContain('retryPhaseA');
  });
});
