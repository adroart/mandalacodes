import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WorkingCardStore, sectionHumanPercent, type WorkingSection } from '../../../lib/oracle/authoring/humanDrafts';
import './WorkingCardReading.css';

const LENSES = [
  { section: 'CODE', chapter: 'ul', label: 'Universal Language' },
  { section: 'ICHING', chapter: 'iching', label: 'I Ching' },
  { section: 'KEYS', chapter: 'genekeys', label: 'Gene Keys' },
  { section: 'DESIGN', chapter: 'humandesign', label: 'Human Design' },
  { section: 'BODY', chapter: 'body', label: 'Body' },
  { section: 'RELATIONS', chapter: 'relations', label: 'Relations' },
] as const;
const store = new WorkingCardStore();

/** A private reading layer around the generated host. Published children stay
 * owned by that host; React portals own only their own independent content. */
export default function WorkingCardReading({ cardNumber, children }: { cardNumber: number; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<Record<string, HTMLElement>>({});
  const [loaded, setLoaded] = useState<{ card: number; sections: WorkingSection[] }>({ card: cardNumber, sections: [] });

  useLayoutEffect(() => {
    const found: Record<string, HTMLElement> = {};
    for (const lens of LENSES) {
      const element = root.current?.querySelector<HTMLElement>(`section[data-chapter="${lens.chapter}"]`);
      if (element) found[lens.section] = element;
    }
    setTargets(found);
  }, [cardNumber]);

  useEffect(() => {
    let active = true;
    let request = 0;
    const refresh = async () => {
      const sequence = ++request;
      try {
        const sections = await store.list(cardNumber);
        if (active && sequence === request) setLoaded({ card: cardNumber, sections });
      } catch {
        // A failed local read must always leave the published reading available.
        if (active && sequence === request) setLoaded({ card: cardNumber, sections: [] });
      }
    };
    void refresh();
    const unsubscribe = store.subscribe(() => void refresh());
    window.addEventListener('focus', refresh);
    return () => { active = false; unsubscribe(); window.removeEventListener('focus', refresh); };
  }, [cardNumber]);

  const sections = loaded.card === cardNumber ? loaded.sections : [];
  return <div ref={root} className="working-card-reading">
    {children}
    {LENSES.map(lens => {
      const section = sections.find(s => s.sectionId === lens.section && s.text.trim());
      const target = targets[lens.section];
      return section && target ? createPortal(
        <WorkingLens key={`${cardNumber}/${lens.section}`} section={section} target={target} label={lens.label} />,
        target, `${cardNumber}/${lens.section}`,
      ) : null;
    })}
  </div>;
}

function WorkingLens({ section, target, label }: { section: WorkingSection; target: HTMLElement; label: string }) {
  const [published, setPublished] = useState(false);
  const percent = sectionHumanPercent(section);
  useLayoutEffect(() => {
    if (!published) target.setAttribute('data-working-card-view', '');
    else target.removeAttribute('data-working-card-view');
    return () => target.removeAttribute('data-working-card-view');
  }, [target, published]);
  return <div className={`working-card-reading__panel${published ? ' working-card-reading__panel--published' : ''}`} data-working-section={section.sectionId}>
    <div className="working-card-reading__toolbar">
      <span>{published ? 'Published reading' : `Human words · ${percent}%`}<span className="working-card-reading__privacy">{published ? ' · Your words saved' : ' · This device'}</span></span>
      <button type="button" aria-pressed={published} onClick={() => setPublished(value => !value)}>{published ? 'Your words' : 'Published text'}</button>
    </div>
    {!published && <>
      <h2>{label}</h2>
      <div className="working-card-reading__words">{section.text}</div>
    </>}
  </div>;
}
