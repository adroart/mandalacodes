const lenses: Record<string, string> = { ul: 'CODE', iching: 'ICHING', genekeys: 'KEYS', humandesign: 'DESIGN', body: 'BODY', relations: 'RELATIONS' };
export function visibleAuthoringSection(sections: { id: string; top: number; bottom: number }[], readingTop: number): string {
  const visible = sections.find(s => s.top <= readingTop && s.bottom > readingTop) ?? sections.find(s => s.bottom > readingTop);
  return lenses[visible?.id ?? ''] ?? 'CODE';
}
export function currentReaderSection(): string {
  const top = document.querySelector('.oracle-app-nav')?.getBoundingClientRect().bottom ?? 60;
  return visibleAuthoringSection(Array.from(document.querySelectorAll<HTMLElement>('.card-reading [data-sec]')).map(s => ({ id: s.dataset.sec ?? '', top: s.getBoundingClientRect().top, bottom: s.getBoundingClientRect().bottom })), top + 40);
}

/** Named editorial focus from the visible reading, without activating authoring. */
export function currentNamedReaderSection(known?:{id:string;lensId:string}[]):string|undefined {
 const allowed=known?new Set(known.map(s=>s.id)):null;
 const top=(document.querySelector('.oracle-app-nav')?.getBoundingClientRect().bottom??60)+24;
 const visible=Array.from(document.querySelectorAll<HTMLElement>('.working-card-reading [data-card-section-id]')).map(node=>({id:node.dataset.cardSectionId!,rect:node.getBoundingClientRect()})).filter(({id,rect})=>(!allowed||allowed.has(id))&&rect.width>0&&rect.height>0&&rect.right>0&&rect.left<innerWidth&&rect.bottom>top&&rect.top<innerHeight-80).filter(({id,rect})=>{const x=(Math.max(0,rect.left)+Math.min(innerWidth,rect.right))/2,y=Math.max(top,rect.top)+Math.min(12,(Math.min(innerHeight-80,rect.bottom)-Math.max(top,rect.top))/2);return document.elementsFromPoint(x,y).some(element=>element.closest<HTMLElement>('[data-card-section-id]')?.dataset.cardSectionId===id);}).sort((a,b)=>a.rect.top-b.rect.top);
 return (visible.find(v=>v.rect.top<=top&&v.rect.bottom>top)??visible[0])?.id;
}
