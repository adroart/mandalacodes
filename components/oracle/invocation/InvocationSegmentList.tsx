import React, { useState } from 'react';
import type { InvocationBlock, RecorderSegment } from '../../../lib/oracle/invocationTypes';

export function InvocationSegmentList({ blocks, segments = [], onEdit, onMove, onCompose }: {
  blocks: InvocationBlock[]; segments?: RecorderSegment[];
  onEdit: (segmentId: string, transcript: string) => void;
  onMove: (blockId: string, toIndex: number) => void; onCompose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const times = new Map(segments.map(segment => [segment.id, segment.createdAt]));
  const linked = blocks.filter(block => block.kind === 'segment');
  const moveLinked = (blockId: string, linkedIndex: number) => onMove(blockId, linked[Math.max(0, Math.min(linkedIndex, linked.length - 1))]?.sortOrder ?? 0);
  return (
    <section className="invocation-arrange" aria-labelledby="invocation-arrange-title">
      <div className="invocation-arrange__intro">
        <div><p className="invocation-kicker">Journal arrangement</p><h2 id="invocation-arrange-title">Shape the source</h2></div>
        <button type="button" className="invocation-primary" onClick={onCompose}>Shift to Invocation</button>
      </div>
      <ol className="invocation-segments">
        {linked.map((block, index) => (
          <li key={block.id} draggable onDragStart={() => setDragging(block.id)} onDragOver={event => event.preventDefault()}
            onDrop={() => { if (dragging) moveLinked(dragging, index); setDragging(null); }}>
            <div className="invocation-segment__header">
              <span className="invocation-drag" aria-hidden="true">⠿</span>
              <strong>Segment {index + 1}</strong>
              {block.segmentId && times.get(block.segmentId) && <time dateTime={times.get(block.segmentId)}>{new Date(times.get(block.segmentId)!).toLocaleString()}</time>}
              <button type="button" className="invocation-edit" onClick={() => setEditing(editing === block.id ? null : block.id)}>{editing === block.id ? 'Done' : 'Edit'}</button>
            </div>
            {editing === block.id ? <textarea aria-label={`Edit segment ${index + 1}`} value={block.markdown} onChange={event => block.segmentId && onEdit(block.segmentId, event.target.value)} /> : <p>{block.markdown}</p>}
            <div className="invocation-move-controls">
              <button type="button" disabled={index === 0} onClick={() => moveLinked(block.id, index - 1)}>Move up</button>
              <button type="button" disabled={index === linked.length - 1} onClick={() => moveLinked(block.id, index + 1)}>Move down</button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
