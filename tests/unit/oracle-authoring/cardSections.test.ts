import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {cardSections} from '../../../lib/oracle/authoring/cardSections';
import {manuscriptSource} from '../../../lib/oracle/authoring/source';
import {plainSection} from '../../../src/mobile/authoring/passageActions';
import type {SourceSnapshot} from '../../../lib/oracle/authoring/types';
const load=async(number:number)=>{const markdown=readFileSync(new URL(`../../../oracle/cards/${String(number).padStart(2,'0')}.md`,import.meta.url),'utf8');return manuscriptSource(number,'fixture',markdown);};
describe('named card sections',()=>{
 it('keeps the full Gate 2 drive together and distinguishes its centre and channel',async()=>{
  const source=await load(2),sections=cardSections(source,'An independently authored entrance.');
  const design=sections.filter(s=>s.lensId==='DESIGN');expect(design).toHaveLength(3);
  expect(design[0].id).toBe('2/DESIGN/the-drive');expect(design[0].path).toEqual(['Human Design','The drive — Gate 2, Direction of the Self']);
  expect(design[0].text).toContain('You feel where your life is heading');expect(design[0].text).toContain('To anyone watching');expect(design[0].text).not.toContain('The Identity centre');
  expect(design[1].title).toContain('Identity Center');expect(design[2].title).toContain('Channel of the Beat');
  expect(sections[0]).toMatchObject({id:'2/INTRO',lensId:'INTRO',kind:'intro',title:'Intro',start:0,text:'An independently authored entrance.'});
  expect(sections.find(s=>s.lensId==='CODE')?.id).toBe('2/CODE/reading');
 });
 it('maps every I Ching component, each moving line, and the Gene Keys natures',async()=>{
  const sections=cardSections(await load(64));
  expect(sections.filter(s=>s.lensId==='ICHING').map(s=>s.title)).toEqual(expect.arrayContaining(['Combination','Reading','Judgement','Image','Line 1','Line 2','Line 3','Line 4','Line 5','Line 6']));
  expect(sections.find(s=>s.id==='64/ICHING/moving-lines/line-1')?.text).toContain('Line 1');
  expect(sections.find(s=>s.id==='64/KEYS/repressive-nature')?.title).toBe('Repressive nature — Imitating');
  expect(sections.find(s=>s.id==='64/KEYS/reactive-nature')?.title).toBe('Reactive nature — Confused');
  expect(sections.find(s=>s.id==='64/KEYS/siddhi')?.title).toContain('Siddhi');
 });
 it('covers all meaningful flattened reading text exactly once across all 64 cards',async()=>{
  for(let number=1;number<=64;number++){
   const source=await load(number),sections=cardSections(source);expect(new Set(sections.map(s=>s.id)).size).toBe(sections.length);
   for(const lens of source.sections){const text=plainSection(source,lens.id),nodes=sections.filter(s=>s.lensId===lens.id);let cursor=0;
    expect(nodes.length,`${number}/${lens.id}`).toBeGreaterThan(0);
    for(const node of nodes){expect(node.sectionText).toBe(text);expect(text.slice(node.start,node.end)).toBe(node.text);expect(text.slice(cursor,node.start).trim()).toBe('');expect(node.sourceHash).toBe(source.hash);cursor=node.end;}
    expect(text.slice(cursor).trim()).toBe('');
   }
  }
 });
 it('preserves IDs when prose, lengths or heading detail changes',async()=>{
  const source=await load(2),original=cardSections(source),markdown=source.markdown.replace('You feel where your life is heading','You can feel the way your whole life is heading').replace('The drive — Gate 2, Direction of the Self','The drive — Gate 2, Another title');
  const revised=cardSections(await manuscriptSource(2,'changed',markdown));expect(revised.map(s=>s.id)).toEqual(original.map(s=>s.id));expect(revised.find(s=>s.id==='2/DESIGN/the-drive')?.text).not.toBe(original.find(s=>s.id==='2/DESIGN/the-drive')?.text);
 });
 it('handles CRLF, repeated paragraphs, nested headings and unheaded lens introductions',()=>{
  const markdown='A shared opening.\r\n\r\n### Shadow — Example\r\nRepeated text.\r\n\r\n#### Detail\r\nRepeated text.\r\n\r\n### Gift — Example\r\nFinal thought.';
  const source:SourceSnapshot={cardNumber:1,revision:'one',hash:'hash',markdown,sections:[{id:'KEYS',title:'Gene Keys',start:0,end:markdown.length}]};
  const sections=cardSections(source);expect(sections.map(s=>s.id)).toEqual(['1/KEYS/introduction','1/KEYS/shadow','1/KEYS/shadow/detail','1/KEYS/gift']);expect(sections.map(s=>s.text)).toEqual(['A shared opening.','Repeated text.','Repeated text.','Final thought.']);
  expect(sections[2].path).toEqual(['Gene Keys','Shadow — Example','Detail']);expect(sections[2].start).toBeGreaterThan(sections[1].end);
 });
});
