import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WorkingCardStore, sectionHumanPercent, type WorkingSection } from '../../../lib/oracle/authoring/humanDrafts';
import './WorkingCardReading.css';
import {recordingAudioSession} from '../../../lib/oracle/authoring/audioEvidence';
import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {passagesFromText} from '../../../lib/oracle/authoring/passageContext';
import PassageReadingControls from './PassageReadingControls';
import {cardSections,type CardSection} from '../../../lib/oracle/authoring/cardSections';
import {SectionDraftStore,sectionTitleEdits,type SectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {namedReadingRanges} from './namedReadingRanges';
import {bundledSource} from '../../../src/mobile/authoring/bundledSource';

const LENSES = [
  { section: 'CODE', chapter: 'ul', label: 'Universal Language' },
  { section: 'ICHING', chapter: 'iching', label: 'I Ching' },
  { section: 'KEYS', chapter: 'genekeys', label: 'Gene Keys' },
  { section: 'DESIGN', chapter: 'humandesign', label: 'Human Design' },
  { section: 'BODY', chapter: 'body', label: 'Body' },
  { section: 'RELATIONS', chapter: 'relations', label: 'Relations' },
] as const;
const store = new WorkingCardStore(),draftStore=new SectionDraftStore();

/** A private reading layer around the generated host. Published children stay
 * owned by that host; React portals own only their own independent content. */
export default function WorkingCardReading({ cardNumber, children }: { cardNumber: number; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [targets, setTargets] = useState<Record<string, HTMLElement>>({});
  const [loaded, setLoaded] = useState<{ card: number; sections: WorkingSection[];drafts:SectionDraftSession[];named:CardSection[] }>({ card: cardNumber, sections: [],drafts:[],named:[] });

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
        const [sections,drafts,source] = await Promise.all([store.list(cardNumber),draftStore.list(cardNumber),bundledSource(cardNumber)]);
        if (active && sequence === request) setLoaded({ card: cardNumber, sections,drafts,named:cardSections(source) });
      } catch {
        // A failed local read must always leave the published reading available.
        if (active && sequence === request) setLoaded({ card: cardNumber, sections: [],drafts:[],named:[] });
      }
    };
    void refresh();
    const unsubscribe = store.subscribe(() => void refresh());
    const unsubscribeDrafts=draftStore.subscribe(()=>void refresh());
    window.addEventListener('focus', refresh);
    return () => { active = false; unsubscribe();unsubscribeDrafts(); window.removeEventListener('focus', refresh); };
  }, [cardNumber]);

  const sections = loaded.card === cardNumber ? loaded.sections : [];
  useLayoutEffect(()=>{
    const element=root.current;if(!element||loaded.card!==cardNumber)return;
    const tagged:HTMLElement[]=[],retitled:{element:HTMLElement;html:string}[]=[];
    const edits=sectionTitleEdits(loaded.drafts,loaded.named[0]?.sourceHash??'');
    // Add identities to existing published paragraphs without moving host-owned nodes.
    for(const lens of LENSES){const target=targets[lens.section];if(!target)continue;
      const nodes=loaded.named.filter(node=>node.lensId===lens.section);
      for(const heading of target.querySelectorAll<HTMLElement>('h3,h4,h5,h6')){if(heading.closest('.working-card-reading__panel'))continue;const node=nodes.find(node=>normalizedReadingText(node.title)===normalizedReadingText(heading.textContent??''));if(node&&edits[node.id]){retitled.push({element:heading,html:heading.innerHTML});heading.textContent=edits[node.id];}}
      for(const paragraph of target.querySelectorAll<HTMLElement>('p')){
        if(paragraph.closest('.working-card-reading__panel'))continue;
        const text=normalizedReadingText(paragraph.textContent??'');if(text.length<15)continue;
        const matches=nodes.filter(node=>normalizedReadingText(node.text).includes(text));
        if(matches.length===1){paragraph.dataset.cardSectionId=matches[0].id;tagged.push(paragraph);}
      }
    }
    return()=>{for(const node of tagged)delete node.dataset.cardSectionId;for(const {element,html}of retitled)element.innerHTML=html;};
  },[loaded,targets,cardNumber]);
  return <div ref={root} className="working-card-reading">
    {children}
    <PassageReadingControls cardNumber={cardNumber} root={root}/>
    {LENSES.map(lens => {
      const section = sections.find(s => s.sectionId === lens.section && s.text.trim());
      const target = targets[lens.section];
      return section && target ? createPortal(
        <WorkingLens key={`${cardNumber}/${lens.section}`} section={section} target={target} label={lens.label} drafts={loaded.drafts} />,
        target, `${cardNumber}/${lens.section}`,
      ) : null;
    })}
  </div>;
}

function WorkingLens({ section, target, label,drafts }: { section: WorkingSection; target: HTMLElement; label: string;drafts:SectionDraftSession[] }) {
  const [published, setPublished] = useState(false);
  const percent = sectionHumanPercent(section);
  const [audio,setAudio]=useState(''),[error,setError]=useState('');
  useEffect(()=>()=>{if(audio)URL.revokeObjectURL(audio);},[audio]);
  const listen=async(sessionId:string,captureId:string)=>{try{const draft=await draftStore.get(sessionId);const audioId=recordingAudioSession(draft as (SectionDraftSession&{takes?:{captureId:string;captureSessionId?:string}[]})|undefined,sessionId,captureId);const blob=await new AuthoringStore().audio(audioId,captureId);setAudio(URL.createObjectURL(blob));}catch{setError('The original recording is unavailable on this device.');}};
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
      <div className="working-card-reading__words">{renderWorkingParagraphs(section,drafts)}</div>
      <details className="working-card-reading__evidence"><summary>Passage history & recordings</summary>{section.blocks.filter(b=>b.origin==='human').map(block=><div key={block.id}><p>Your words · {block.text.slice(0,140)}</p>{block.replacedText&&<details><summary>Original passage</summary><p>{block.replacedText}</p></details>}{block.evidence[0]&&<button onClick={()=>void listen(block.evidence[0].sessionId,block.evidence[0].captureId)}>Listen to original recording</button>}</div>)}{audio&&<audio src={audio} controls aria-label="Passage recording"/>}{error&&<p role="alert">{error}</p>}</details>
    </>}
  </div>;
}

const normalizedReadingText=(text:string)=>text.replace(/[_*]/g,'').replace(/\s+/g,' ').trim();
function renderWorkingParagraphs(section:WorkingSection,drafts:SectionDraftSession[]){
 let cursor=0;const human:{start:number;end:number}[]=[];for(const block of section.blocks){const at=section.text.indexOf(block.text,cursor);if(at<0)continue;if(block.origin==='human')human.push({start:at,end:at+block.text.length});cursor=at+block.text.length;}
 const paragraphs=passagesFromText(section.cardNumber,section.sectionId,section.text,section.revision,section.sourceHash);
 const named=namedReadingRanges(section,drafts),shown=new Set<string>(),titles=sectionTitleEdits(drafts,section.sourceHash);
 return paragraphs.map((paragraph,index)=>{const node=named.find(range=>range.start<=paragraph.start&&range.end>=paragraph.end);const heading=node&&!shown.has(node.section.id)&&(section.sectionId!=='CODE'||!!titles[node.section.id]);if(node)shown.add(node.section.id);const boundaries=[...new Set([paragraph.start,paragraph.end,...human.flatMap(r=>[Math.max(paragraph.start,r.start),Math.min(paragraph.end,r.end)]).filter(n=>n>paragraph.start&&n<paragraph.end)])].sort((a,b)=>a-b);return <React.Fragment key={paragraph.id}>{section.text.slice(index?paragraphs[index-1].end:0,paragraph.start)}{heading&&<h3 className="working-card-reading__section-heading" data-card-section-id={node!.section.id}>{node!.section.title}</h3>}<p data-card-section-id={node?.section.id}>{boundaries.slice(0,-1).map((from,i)=>{const to=boundaries[i+1],isHuman=human.some(r=>r.start<=from&&r.end>=to);return <span key={from} data-human-origin={isHuman?true:undefined} title={isHuman?'Your words':undefined}>{section.text.slice(from,to)}</span>;})}</p></React.Fragment>;});
}
