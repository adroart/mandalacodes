import type { InvocationBlock, RecorderSegment } from './invocationTypes';

const ordered = (blocks: InvocationBlock[]) => blocks.map((block, sortOrder) => ({ ...block, sortOrder }));

export function blocksFromSegments(segments: RecorderSegment[]): InvocationBlock[] {
  return [...segments].sort((a, b) => a.sortOrder - b.sortOrder).map((segment, sortOrder) => ({
    id: `segment:${segment.id}`, kind: 'segment', segmentId: segment.id, markdown: segment.transcript.trim(), sortOrder,
  }));
}
export function applyBlockEdit(blocks: InvocationBlock[], blockId: string, markdown: string) {
  const target = blocks.find((block) => block.id === blockId);
  if (!target) throw new Error('invocation block not found');
  const value = markdown.trim();
  const next = target.kind === 'prose' && !value ? blocks.filter((block) => block.id !== blockId) : blocks.map((block) => block.id === blockId ? { ...block, markdown: value } : block);
  return { blocks: ordered(next), segmentUpdate: target.segmentId ? { segmentId: target.segmentId, transcript: value } : null };
}
export function applySegmentEdit(blocks: InvocationBlock[], segmentId: string, transcript: string): InvocationBlock[] {
  return blocks.map((block) => block.segmentId === segmentId ? { ...block, markdown: transcript.trim() } : block);
}
export function addProseBlock(blocks: InvocationBlock[], id: string, markdown: string, at: number): InvocationBlock[] {
  if (blocks.some((block) => block.id === id)) throw new Error('invocation block id already exists');
  const next = [...blocks];
  next.splice(Math.max(0, Math.min(at, next.length)), 0, { id, kind: 'prose', segmentId: null, markdown: markdown.trim(), sortOrder: 0 });
  return ordered(next);
}
export function moveBlock(blocks: InvocationBlock[], blockId: string, toIndex: number): InvocationBlock[] {
  const from = blocks.findIndex((block) => block.id === blockId);
  if (from < 0) throw new Error('invocation block not found');
  const next = [...blocks];
  const [block] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, block);
  return ordered(next);
}
export function removeProseBlock(blocks: InvocationBlock[], blockId: string): InvocationBlock[] {
  const target = blocks.find((block) => block.id === blockId);
  if (!target) throw new Error('invocation block not found');
  if (target.kind !== 'prose') throw new Error('linked segment blocks cannot be removed');
  return ordered(blocks.filter((block) => block.id !== blockId));
}
