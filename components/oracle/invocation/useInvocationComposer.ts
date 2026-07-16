import { useCallback, useEffect, useRef, useState } from 'react';
import type { InvocationBlock, InvocationDraft, InvocationVersion } from '../../../lib/oracle/invocationTypes';
import { InvocationConflictError, loadInvocationDraft, loadInvocationVersions, publishInvocation, putInvocationDraft, rollbackInvocation } from '../../../lib/oracle/invocationApi';
import { applyBlockEdit, removeProseBlock } from '../../../lib/oracle/invocationSync';

export type ComposerPhase = 'arrange' | 'compose';
export type ComposerStatus = 'idle' | 'saving' | 'saved_and_live' | 'error' | 'conflict';
export type InvocationDraftConflict = { localDraft: InvocationDraft; serverDraft: InvocationDraft };

function ordered(blocks: InvocationBlock[]) {
  return blocks.map((block, sortOrder) => ({ ...block, sortOrder }));
}

export function useInvocationComposer(hexagramNumber: number, sessionId: string, options?: { onPublished?: () => void }) {
  const [draft, setDraft] = useState<InvocationDraft | null>(null);
  const [phase, setPhase] = useState<ComposerPhase>('arrange');
  const [status, setStatus] = useState<ComposerStatus>('idle');
  const [error, setError] = useState('');
  const [versions, setVersions] = useState<InvocationVersion[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conflict, setConflict] = useState<InvocationDraftConflict | null>(null);
  const dirtyRef = useRef(false);
  const saveQueue = useRef<Promise<InvocationDraft | null>>(Promise.resolve(null));

  useEffect(() => {
    const controller = new AbortController();
    loadInvocationDraft(hexagramNumber, sessionId, controller.signal)
      .then(value => { setDraft(value); dirtyRef.current = false; })
      .catch(reason => { if (reason?.name !== 'AbortError') { setError(reason instanceof Error ? reason.message : 'Unable to load invocation'); setStatus('error'); } });
    return () => controller.abort();
  }, [hexagramNumber, sessionId]);

  const mutate = useCallback((update: (value: InvocationDraft) => InvocationDraft) => {
    dirtyRef.current = true;
    setStatus('idle'); setError('');
    setDraft(current => current ? update(current) : current);
  }, []);

  const editBlock = useCallback((blockId: string, markdown: string) => mutate(value => ({
    ...value, blocks: applyBlockEdit(value.blocks, blockId, markdown).blocks,
  })), [mutate]);

  const editSegment = useCallback((segmentId: string, transcript: string) => mutate(value => ({
    ...value, blocks: value.blocks.map(block => block.segmentId === segmentId ? { ...block, markdown: transcript } : block),
  })), [mutate]);

  const editTitle = useCallback((title: string) => mutate(value => ({ ...value, title })), [mutate]);

  const moveBlock = useCallback((blockId: string, toIndex: number) => mutate(value => {
    const from = value.blocks.findIndex(block => block.id === blockId);
    if (from < 0) return value;
    const blocks = [...value.blocks];
    const [block] = blocks.splice(from, 1);
    blocks.splice(Math.max(0, Math.min(toIndex, blocks.length)), 0, block);
    return { ...value, blocks: ordered(blocks) };
  }), [mutate]);

  const addProse = useCallback(() => mutate(value => ({ ...value, blocks: ordered([...value.blocks, {
    id: `prose:${crypto.randomUUID()}`, kind: 'prose', segmentId: null, markdown: '', sortOrder: value.blocks.length,
  }]) })), [mutate]);

  const deleteProse = useCallback((blockId: string) => mutate(value => ({ ...value, blocks: removeProseBlock(value.blocks, blockId) })), [mutate]);

  const saveDraft = useCallback(async () => {
    if (!draft) return null;
    const snapshot = draft;
    const task = saveQueue.current.then(previous => putInvocationDraft(
      previous?.id === snapshot.id ? { ...snapshot, updatedAt: previous.updatedAt } : snapshot,
    ));
    saveQueue.current = task.catch(() => null);
    try {
      const saved = await task;
      setDraft(current => {
        if (current !== snapshot) return current;
        dirtyRef.current = false;
        return saved;
      });
      setConflict(null);
      return saved;
    } catch (reason) {
      if (reason instanceof InvocationConflictError) {
        setConflict({ localDraft: snapshot, serverDraft: reason.serverDraft });
        setError(reason.message); setStatus('conflict');
      } else {
        setError(reason instanceof Error ? reason.message : 'Draft could not be saved'); setStatus('error');
      }
      throw reason;
    }
  }, [draft]);

  useEffect(() => {
    if (!draft || !dirtyRef.current || status === 'saving' || status === 'conflict' || conflict) return;
    const timeout = window.setTimeout(() => { void saveDraft().catch(() => undefined); }, 700);
    return () => window.clearTimeout(timeout);
  }, [conflict, draft, saveDraft, status]);

  const publish = useCallback(async () => {
    if (!draft) return false;
    setStatus('saving'); setError('');
    try {
      const saved = dirtyRef.current ? await saveDraft() : draft;
      if (!saved) return false;
      const result = await publishInvocation(saved, crypto.randomUUID());
      dirtyRef.current = false;
      setStatus('saved_and_live');
      setVersions(current => [result.version, ...current.filter(version => version.id !== result.version.id)]);
      options?.onPublished?.();
      return true;
    } catch (reason) {
      if (reason instanceof InvocationConflictError) return false;
      setError(reason instanceof Error ? reason.message : 'Save failed. Your work is still here.'); setStatus('error');
      return false;
    }
  }, [draft, options, saveDraft]);

  const reviewHistory = useCallback(async () => {
    setHistoryOpen(true);
    try { setVersions((await loadInvocationVersions(hexagramNumber, sessionId)).sort((a, b) => b.versionNumber - a.versionNumber)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'History could not be loaded'); }
  }, [hexagramNumber, sessionId]);

  const rollback = useCallback(async (versionId: string) => {
    setStatus('saving');
    try {
      const version = await rollbackInvocation(hexagramNumber, sessionId, versionId);
      setVersions(current => [version, ...current]); setStatus('saved_and_live'); options?.onPublished?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Rollback failed'); setStatus('error'); }
  }, [hexagramNumber, sessionId, options]);

  return {
    draft, phase, status, error, versions, historyOpen, conflict, dirty: dirtyRef.current,
    setPhase, setHistoryOpen, editBlock, editSegment, editTitle, moveBlock, addProse, deleteProse, saveDraft, publish,
    retry: publish, reviewHistory, rollback,
    useServerDraft: () => {
      if (!conflict) return;
      setDraft(conflict.serverDraft); dirtyRef.current = false; setConflict(null); setError(''); setStatus('idle');
    },
    keepLocalDraft: () => {
      if (!conflict) return;
      setDraft({ ...conflict.localDraft, updatedAt: conflict.serverDraft.updatedAt });
      dirtyRef.current = true; setConflict(null); setError(''); setStatus('idle');
    },
    download: (versionId: string) => window.location.assign(`/api/oracle/invocations/${hexagramNumber}/download?versionId=${encodeURIComponent(versionId)}`),
  };
}
