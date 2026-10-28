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
