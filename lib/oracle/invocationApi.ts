import type { InvocationDraft, InvocationVersion, LiveInvocation } from './invocationTypes';

export class InvocationConflictError extends Error {
  readonly serverDraft: InvocationDraft;
  constructor(serverDraft: InvocationDraft) {
    super('This invocation changed elsewhere. Compare the local and server drafts before continuing.');
    this.name = 'InvocationConflictError';
    this.serverDraft = serverDraft;
  }
}

export function invocationRoutes(hexagramNumber: number, sessionId: string) {
  const base = `/api/oracle/invocations/${hexagramNumber}`;
  return {
    draft: `${base}/draft?sessionId=${encodeURIComponent(sessionId)}`,
    publish: `${base}/publish`,
    versions: `${base}/versions`,
    live: `${base}/live`,
  };
}

export function invocationDownloadUrl(hexagramNumber: number, versionId: string) {
  return `/api/oracle/invocations/${hexagramNumber}/download?versionId=${encodeURIComponent(versionId)}`;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; draft?: InvocationDraft };
    if (response.status === 409 && payload.error === 'draft_changed' && payload.draft) throw new InvocationConflictError(payload.draft);
    throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function loadInvocationDraft(hexagramNumber: number, sessionId: string, signal?: AbortSignal) {
  return json<InvocationDraft>(await fetch(invocationRoutes(hexagramNumber, sessionId).draft, { credentials: 'same-origin', signal }));
}

export async function putInvocationDraft(draft: InvocationDraft) {
  return json<InvocationDraft>(await fetch(invocationRoutes(draft.hexagramNumber, draft.sessionId).draft, {
    method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
  }));
}

export async function publishInvocation(draft: InvocationDraft, idempotencyKey: string) {
  return json<{ status: 'saved_and_live'; version: InvocationVersion; liveUpdatedAt: string }>(await fetch(invocationRoutes(draft.hexagramNumber, draft.sessionId).publish, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(draft),
  }));
}

export async function loadInvocationVersions(hexagramNumber: number, sessionId: string) {
  return json<InvocationVersion[]>(await fetch(invocationRoutes(hexagramNumber, sessionId).versions, { credentials: 'same-origin' }));
}

export async function rollbackInvocation(hexagramNumber: number, sessionId: string, versionId: string) {
  return json<InvocationVersion>(await fetch(invocationRoutes(hexagramNumber, sessionId).versions, {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'rollback', versionId }),
  }));
}

export async function loadLiveInvocation(hexagramNumber: number, options?: { fresh?: boolean; signal?: AbortSignal }): Promise<LiveInvocation | null> {
  const response = await fetch(`/api/oracle/invocations/${hexagramNumber}/live`, {
    cache: options?.fresh ? 'no-store' : 'default', signal: options?.signal,
  });
  if (response.status === 204) return null;
  return json<LiveInvocation>(response);
}
