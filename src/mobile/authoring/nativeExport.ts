/** Native uses the iOS share sheet; ordinary browser builds keep download behavior. */
export async function exportAuthoringFile(name: string, text: string, type: string): Promise<void> {
  const handler = (window as unknown as { webkit?: { messageHandlers?: { oracleAuthoringExport?: { postMessage(value: unknown): void } } } }).webkit?.messageHandlers?.oracleAuthoringExport;
  if (handler) {
    const id = crypto.randomUUID();
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => { cleanup(); reject(new Error('The share sheet did not open. Your draft is still saved.')); }, 15000);
      const cleanup = () => { clearTimeout(timer); window.removeEventListener('oracle-authoring-export-result', listener); };
      const listener = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail?.id !== id) return; cleanup(); detail.ok ? resolve() : reject(new Error('Could not open sharing. Your draft is still saved.')); };
      window.addEventListener('oracle-authoring-export-result', listener);
      handler.postMessage({ id, name, text });
    });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** How a hand-off ended: the share sheet finished, was cancelled, opened with no word on how it ended, or a browser download started. */
export type AuthoringHandOff = 'shared' | 'cancelled' | 'opened' | 'downloaded';

/**
 * Like exportAuthoringFile, but reports how the hand-off ended. The native side may answer
 * `{ id, ok, stage: 'presented' }` while the sheet is up and then `{ id, ok, completed }` when it
 * closes; an answer with neither (older builds, which answer once the sheet is shown) means 'opened'.
 */
export async function handOffAuthoringFile(name: string, text: string, type: string): Promise<AuthoringHandOff> {
  const handler = (window as unknown as { webkit?: { messageHandlers?: { oracleAuthoringExport?: { postMessage(value: unknown): void } } } }).webkit?.messageHandlers?.oracleAuthoringExport;
  if (handler) {
    const id = crypto.randomUUID();
    return new Promise<AuthoringHandOff>((resolve, reject) => {
      let timer = window.setTimeout(() => { cleanup(); reject(new Error('The share sheet did not open. Nothing was sent.')); }, 15000);
      const cleanup = () => { clearTimeout(timer); window.removeEventListener('oracle-authoring-export-result', listener); };
      const listener = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail?.id !== id) return;
        if (!detail.ok) { cleanup(); reject(new Error('Could not open sharing. Nothing was sent.')); return; }
        if (detail.stage === 'presented' && typeof detail.completed !== 'boolean') { clearTimeout(timer); timer = 0; return; }
        cleanup();
        resolve(typeof detail.completed === 'boolean' ? (detail.completed ? 'shared' : 'cancelled') : 'opened');
      };
      window.addEventListener('oracle-authoring-export-result', listener);
      handler.postMessage({ id, name, text });
    });
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}
