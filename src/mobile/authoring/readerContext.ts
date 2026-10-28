const lenses: Record<string, string> = { ul: 'CODE', iching: 'ICHING', genekeys: 'KEYS', humandesign: 'DESIGN', body: 'BODY', relations: 'RELATIONS' };
export function visibleAuthoringSection(sections: { id: string; top: number; bottom: number }[], readingTop: number): string {
  const visible = sections.find(s => s.top <= readingTop && s.bottom > readingTop) ?? sections.find(s => s.bottom > readingTop);
  return lenses[visible?.id ?? ''] ?? 'CODE';
}
export function currentReaderSection(): string {
  const top = document.querySelector('.oracle-app-nav')?.getBoundingClientRect().bottom ?? 60;
  return visibleAuthoringSection(Array.from(document.querySelectorAll<HTMLElement>('.card-reading [data-sec]')).map(s => ({ id: s.dataset.sec ?? '', top: s.getBoundingClientRect().top, bottom: s.getBoundingClientRect().bottom })), top + 40);
}
