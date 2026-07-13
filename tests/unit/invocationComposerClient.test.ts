import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicInvocation } from '../../components/oracle/invocation/PublicInvocation';
import { InvocationHistory } from '../../components/oracle/invocation/InvocationHistory';
import { getConflictFocusTarget, InvocationBlockEditor, InvocationConflictPanel } from '../../components/oracle/invocation/InvocationComposer';
import { InvocationConflictError, invocationDownloadUrl, invocationRoutes, loadInvocationDraft, loadInvocationVersions, putInvocationDraft, rollbackInvocation } from '../../lib/oracle/invocationApi';
import { applyBlockEdit, removeProseBlock } from '../../lib/oracle/invocationSync';

afterEach(() => vi.unstubAllGlobals());

const draft = { id: 'draft-1', hexagramNumber: 22, sessionId: 'session-1', title: 'Grace', updatedAt: '2026-07-13T00:00:00Z', blocks: [] };
const fullVersion = { id: 'version-2', hexagramNumber: 22, versionNumber: 2, title: 'Grace', markdownBody: 'Newest body', artifactKey: 'invocations/22/v2.md', authorUserId: 'admin-1', createdAt: '2026-07-13T01:00:00Z' };

describe('invocation client contracts', () => {
  it('builds encoded, hexagram-scoped API routes', () => {
    expect(invocationRoutes(22, 'session/a')).toEqual({
      draft: '/api/oracle/invocations/22/draft?sessionId=session%2Fa',
      publish: '/api/oracle/invocations/22/publish',
      versions: '/api/oracle/invocations/22/versions',
      live: '/api/oracle/invocations/22/live',
    });
    expect(invocationDownloadUrl(22, 'version/a')).toBe('/api/oracle/invocations/22/download?versionId=version%2Fa');
  });

  it('parses direct draft, version-list, and rollback response contracts', async () => {
    const responses = [draft, draft, [fullVersion], fullVersion];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(loadInvocationDraft(22, 'session-1')).resolves.toEqual(draft);
    await expect(putInvocationDraft(draft)).resolves.toEqual(draft);
    await expect(loadInvocationVersions(22, 'session-1')).resolves.toEqual([fullVersion]);
    await expect(rollbackInvocation(22, 'session-1', 'version-1')).resolves.toEqual(fullVersion);
  });

  it('retains the server draft on a 409 for explicit reconciliation', async () => {
    const serverDraft = { ...draft, title: 'Server title', updatedAt: '2026-07-13T02:00:00Z' };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'draft_changed', draft: serverDraft }), { status: 409, headers: { 'Content-Type': 'application/json' } })));
    const error = await putInvocationDraft({ ...draft, title: 'Local title' }).catch(reason => reason);
    expect(error).toBeInstanceOf(InvocationConflictError);
    expect(error.serverDraft).toEqual(serverDraft);
    expect(error.message).toContain('changed elsewhere');
  });

  it('renders only typed safe invocation nodes and rechecks link protocols', () => {
    const html = renderToStaticMarkup(
      createElement(PublicInvocation, { invocation: {
        id: 'v-1', hexagramNumber: 22, versionNumber: 1, title: 'Grace', createdAt: '2026-07-13T00:00:00Z',
        blocks: [
          { type: 'heading', level: 2, children: [{ type: 'text', value: 'An Invocation' }] },
          { type: 'paragraph', children: [
            { type: 'emphasis', children: [{ type: 'text', value: 'Be still' }] },
            { type: 'text', value: '. ' },
            { type: 'link', href: 'javascript:alert(1)', children: [{ type: 'text', value: 'Unsafe' }] },
            { type: 'link', href: 'https://example.com/read', children: [{ type: 'text', value: 'Read' }] },
          ] },
        ],
      } }),
    );
    expect(html).toContain('<h2>An Invocation</h2>');
    expect(html).toContain('<em>Be still</em>');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).not.toContain('segment');
  });

  it('renders no wrapper or empty state without a live invocation', () => {
    expect(renderToStaticMarkup(createElement(PublicInvocation, { invocation: null }))).toBe('');
  });

  it('orders history newest-first and exposes body preview, download, and rollback controls', () => {
    const version = (id: string, versionNumber: number, markdownBody: string) => ({
      id, versionNumber, markdownBody, hexagramNumber: 22, title: 'Grace', artifactKey: `${id}.md`, authorUserId: 'admin', createdAt: `2026-07-${String(versionNumber).padStart(2, '0')}T00:00:00Z`,
    });
    const html = renderToStaticMarkup(createElement(InvocationHistory, {
      versions: [version('old', 1, 'Earlier body'), version('new', 2, 'Newest body')],
      onClose() {}, onDownload() {}, onRollback() {},
    }));
    expect(html.indexOf('Version 2')).toBeLessThan(html.indexOf('Version 1'));
    expect(html).toContain('Newest body');
    expect(html).toContain('Download Markdown');
    expect(html).toContain('Restore as new version');
  });

  it('offers deletion only for invocation-only prose', () => {
    const prose = renderToStaticMarkup(createElement(InvocationBlockEditor, {
      block: { id: 'prose-1', kind: 'prose', segmentId: null, markdown: 'Bridge', sortOrder: 0 }, index: 0, onEdit() {}, onDelete() {},
    }));
    const linked = renderToStaticMarkup(createElement(InvocationBlockEditor, {
      block: { id: 'segment:one', kind: 'segment', segmentId: 'one', markdown: 'Source', sortOrder: 0 }, index: 0, onEdit() {}, onDelete() {},
    }));
    expect(prose).toContain('Delete prose');
    expect(linked).not.toContain('Delete');
  });

  it('preserves linked segment identity and removes empty prose through shared edit semantics', () => {
    const linked = { id: 'segment:one', kind: 'segment' as const, segmentId: 'one', markdown: 'Source', sortOrder: 0 };
    const prose = { id: 'prose-1', kind: 'prose' as const, segmentId: null, markdown: 'Bridge', sortOrder: 1 };
    const linkedResult = applyBlockEdit([linked, prose], linked.id, 'Changed');
    expect(linkedResult.blocks[0]).toMatchObject({ id: linked.id, segmentId: 'one', markdown: 'Changed' });
    expect(linkedResult.segmentUpdate).toEqual({ segmentId: 'one', transcript: 'Changed' });
    expect(applyBlockEdit([linked, prose], prose.id, ' ').blocks).toEqual([{ ...linked, sortOrder: 0 }]);
    expect(() => removeProseBlock([linked], linked.id)).toThrow('cannot be removed');
  });

  it('shows both local and server drafts for explicit conflict reconciliation', () => {
    const html = renderToStaticMarkup(createElement(InvocationConflictPanel, {
      conflict: { localDraft: { ...draft, title: 'Local title' }, serverDraft: { ...draft, title: 'Server title' } },
      onUseServer() {}, onKeepLocal() {},
    }));
    expect(html).toContain('Local title');
    expect(html).toContain('Server title');
    expect(html).toContain('Use server draft');
    expect(html).toContain('Keep my draft');
  });

  it('cycles focus only between conflict reconciliation actions', () => {
    const useServer = {} as HTMLElement;
    const keepLocal = {} as HTMLElement;
    const controls = [useServer, keepLocal];
    expect(getConflictFocusTarget(controls, keepLocal, false)).toBe(useServer);
    expect(getConflictFocusTarget(controls, useServer, true)).toBe(keepLocal);
    expect(getConflictFocusTarget(controls, useServer, false)).toBeNull();
  });
});
