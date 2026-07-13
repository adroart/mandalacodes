import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { InvocationHistory } from './InvocationHistory';
import { InvocationSegmentList } from './InvocationSegmentList';
import { useInvocationComposer, type InvocationDraftConflict } from './useInvocationComposer';
import type { InvocationBlock, RecorderSegment } from '../../../lib/oracle/invocationTypes';
import './invocation-composer.css';

export function InvocationBlockEditor({ block, index, onEdit, onDelete }: {
  block: InvocationBlock; index: number; onEdit: (id: string, markdown: string) => void; onDelete: (id: string) => void;
}) {
  return <div className={`invocation-block invocation-block--${block.kind}`}>
    <div className="invocation-block__heading">
      <span>{block.kind === 'segment' ? `Linked segment ${index + 1}` : 'Invocation-only prose'}</span>
      {block.kind === 'prose' && <button type="button" onClick={() => onDelete(block.id)}>Delete prose</button>}
    </div>
    <label><span className="sr-only">Edit {block.kind === 'segment' ? `linked segment ${index + 1}` : `invocation prose ${index + 1}`}</span>
      <textarea value={block.markdown} rows={Math.max(3, block.markdown.split('\n').length + 1)} onChange={event => onEdit(block.id, event.target.value)} />
    </label>
  </div>;
}

export function getConflictFocusTarget(controls: HTMLElement[], activeElement: Element | null, shiftKey: boolean) {
  if (controls.length === 0) return null;
  if (shiftKey && activeElement === controls[0]) return controls[controls.length - 1];
  if (!shiftKey && activeElement === controls[controls.length - 1]) return controls[0];
  return null;
}

export function InvocationConflictPanel({ conflict, onUseServer, onKeepLocal }: {
  conflict: InvocationDraftConflict; onUseServer: () => void; onKeepLocal: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => firstActionRef.current?.focus());
    return () => { cancelAnimationFrame(frame); previous?.focus(); };
  }, []);
  const trapFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.key !== 'Tab' || !panelRef.current) return;
    const controls = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
    const target = getConflictFocusTarget(controls, document.activeElement, event.shiftKey);
    if (target) { event.preventDefault(); target.focus(); }
  };
  return <section ref={panelRef} className="invocation-conflict" role="alertdialog" aria-modal="true" aria-labelledby="invocation-conflict-title" onKeyDown={trapFocus}>
    <h2 id="invocation-conflict-title">Choose which draft to continue with</h2>
    <p>The server changed while you were editing. Your local work is still intact.</p>
    <div className="invocation-conflict__comparison">
      <div><strong>Your draft</strong><p>{conflict.localDraft.title}</p><small>{conflict.localDraft.blocks.length} blocks</small></div>
      <div><strong>Server draft</strong><p>{conflict.serverDraft.title}</p><small>{conflict.serverDraft.blocks.length} blocks</small></div>
    </div>
    <div className="invocation-conflict__actions">
      <button ref={firstActionRef} type="button" onClick={onUseServer}>Use server draft</button>
      <button type="button" className="invocation-primary" onClick={onKeepLocal}>Keep my draft</button>
    </div>
  </section>;
}

export function InvocationComposer({ hexagramNumber, sessionId, segments = [], onClose, onPublished }: {
  hexagramNumber: number; sessionId: string; segments?: RecorderSegment[]; onClose: () => void; onPublished?: () => void;
}) {
  const composer = useInvocationComposer(hexagramNumber, sessionId, { onPublished });
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);

  const requestClose = () => {
    if (!composer.dirty || window.confirm('Discard unsaved invocation changes?')) onClose();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (composer.conflict) return;
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, input, a[href], [tabindex]:not([tabindex="-1"])')];
    if (!controls.length) return;
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  };

  if (!composer.draft) return createPortal(<div className="invocation-shell invocation-loading" role="status">Loading invocation…</div>, document.body);
  return createPortal(
    <div ref={dialogRef} className="invocation-shell" role="dialog" aria-modal="true" aria-labelledby="invocation-title" onKeyDown={onKeyDown}>
      <header className="invocation-toolbar" aria-hidden={composer.conflict ? true : undefined}>
        <div><p className="invocation-kicker">Universal Language {hexagramNumber}</p><h1 id="invocation-title">Invocation composer</h1></div>
        <button ref={closeRef} type="button" className="invocation-close" onClick={requestClose} aria-label="Close invocation composer">×</button>
      </header>

      <div className="invocation-primary-surface" aria-hidden={composer.conflict ? true : undefined}>
      {composer.phase === 'arrange' ? (
        <InvocationSegmentList blocks={composer.draft.blocks} segments={segments} onEdit={composer.editSegment} onMove={composer.moveBlock} onCompose={() => composer.setPhase('compose')} />
      ) : (
        <main className="invocation-workspace">
          <div className="invocation-compose-heading">
            <button type="button" onClick={() => composer.setPhase('arrange')}>Arrange</button>
            <button type="button" onClick={composer.reviewHistory}>Review history</button>
          </div>
          <label className="invocation-title-field">Invocation title<input value={composer.draft.title} onChange={event => composer.editTitle(event.target.value)} /></label>
          <p className="invocation-guidance">Use paragraphs, line breaks, ## or ### headings, *emphasis*, **strong text**, and safe links.</p>
          <div className="invocation-blocks">
            {composer.draft.blocks.map((block, index) => <InvocationBlockEditor key={block.id} block={block} index={index} onEdit={composer.editBlock} onDelete={composer.deleteProse} />)}
          </div>
          <button type="button" className="invocation-add" onClick={composer.addProse}>Add prose</button>
          <footer className="invocation-savebar">
            <span role="status" aria-live="polite">{composer.status === 'saved_and_live' ? 'Saved and live' : ['error', 'conflict'].includes(composer.status) ? composer.error : ''}</span>
            {composer.status === 'error' && <button type="button" onClick={composer.retry}>Retry</button>}
            <button type="button" className="invocation-primary" disabled={composer.status === 'saving'} onClick={composer.publish}>{composer.status === 'saving' ? 'Saving…' : 'Save Invocation'}</button>
          </footer>
        </main>
      )}
      </div>
      {composer.conflict && <InvocationConflictPanel conflict={composer.conflict} onUseServer={composer.useServerDraft} onKeepLocal={composer.keepLocalDraft} />}
      {composer.historyOpen && !composer.conflict && <InvocationHistory versions={composer.versions} onClose={() => composer.setHistoryOpen(false)} onDownload={composer.download} onRollback={composer.rollback} />}
    </div>, document.body,
  );
}

export default InvocationComposer;
