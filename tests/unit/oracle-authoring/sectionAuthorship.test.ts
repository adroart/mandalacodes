import {describe,it,expect} from 'vitest';
import {cardSectionAuthorship,namedSectionOriginSpans,readingOriginSpans} from '../../../lib/oracle/authoring/sectionAuthorship';
import {cardSections,type CardSection} from '../../../lib/oracle/authoring/cardSections';
import {createWorkingText,type WorkingSection,type HumanBlock} from '../../../lib/oracle/authoring/humanDrafts';
import {createSectionDraftSession,type SectionDraftSession,type SectionDraftResult} from '../../../lib/oracle/authoring/sectionDrafts';
import {sourceSnapshot} from '../../../lib/oracle/authoring/workflow';
import {normalizePassageComparison} from '../../../lib/oracle/authoring/passageComparison';
import {namedReadingRanges} from '../../../components/oracle/authoring/namedReadingRanges';

async function fixture(){
 const markdown='### Reading\nFirst AI paragraph.\n\nSecond AI paragraph.\n\n### The body\nBody AI words.';
 const source=await sourceSnapshot(2,'original',markdown,[{id:'CODE',title:'Universal Language',start:0,end:markdown.length}]);
 const nodes=cardSections(source),baseline=createWorkingText(source,'CODE',nodes[0].sectionText);baseline.blocks[0].origin='ai';
 return {source,nodes,baseline};
}
function crop(blocks:HumanBlock[],from:number,to:number){let cursor=0;return blocks.flatMap(block=>{const start=Math.max(0,from-cursor),end=Math.min(block.text.length,to-cursor);cursor+=block.text.length;return end>start?[{...block,text:block.text.slice(start,end)}]:[];});}
function change(before:WorkingSection,node:CardSection,old:string,words:string,sessions:SectionDraftSession[]=[]){
 const range=namedReadingRanges(before,sessions).find(range=>range.section.id===node.id)!;
 const beforeText=before.text.slice(range.start,range.end),start=before.text.indexOf(old,range.start),end=start+old.length;
 const blocks=[...crop(before.blocks,0,start),...(words?[{id:'spoken',text:words,origin:'human' as const,evidence:[],replacedText:old}]:[]),...crop(before.blocks,end,before.text.length)];
 const after={...before,revision:before.revision+1,text:blocks.map(block=>block.text).join(''),blocks};
 const appliedText=beforeText.replace(old,words),draft=createSectionDraftSession(before.source,[node]);
 draft.results=[{sectionId:node.id,text:appliedText,evidenceQuotes:[],changes:[],warnings:[],checked:true,applied:true,beforeWorking:before,beforeText,appliedText,appliedAt:`2026-10-31T10:00:${String(before.revision).padStart(2,'0')}Z`,integrationId:'receipt'}];
 return {after,draft};
}
function introSession(source:Awaited<ReturnType<typeof fixture>>['source'],node:CardSection,result:Partial<SectionDraftResult>){
 const session=createSectionDraftSession(source,[node]);session.results=[{sectionId:node.id,text:'My introduction.',evidenceQuotes:[],changes:[],warnings:[],checked:true,applied:true,appliedAt:'2026-10-31T12:00:00Z',integrationId:'intro-receipt',beforeText:node.text,appliedText:'My introduction.',...result}];return session;
}

describe('named-section authorship progress',()=>{
 it('counts the complete parsed card, not selections or an incomplete review list',async()=>{
  const {source,nodes}=await fixture(),selection={...nodes[0],id:'2/CODE/selection-0-10'};
  expect(cardSectionAuthorship(source,[selection,nodes[0],nodes[0]],[],[])).toEqual({human:0,total:2,sections:{[nodes[0].id]:'ai',[nodes[1].id]:'ai'}});
 });
 it('keeps a partial replacement mixed and does not count untouched AI paragraphs',async()=>{
  const {source,nodes,baseline}=await fixture(),{after,draft}=change(baseline,nodes[0],'First AI paragraph.','My first paragraph.');
  const progress=cardSectionAuthorship(source,nodes,[after],[draft]);expect(progress.human).toBe(0);expect(progress.sections[nodes[0].id]).toBe('mixed');expect(progress.sections[nodes[1].id]).toBe('ai');
 });
 it('does not grant completion for a human addition after retained AI',async()=>{
  const {source,nodes,baseline}=await fixture(),{after,draft}=change(baseline,nodes[0],nodes[0].text,nodes[0].text+'\n\nMy addition.');
  // The retained original keeps its AI block; only the appended text is new.
  const at=nodes[0].end;after.blocks=[...crop(baseline.blocks,0,at),{id:'add',text:'\n\nMy addition.',origin:'human',evidence:[]},...crop(baseline.blocks,at,baseline.text.length)];
  draft.results[0].editIntent='add';expect(cardSectionAuthorship(source,nodes,[after],[draft]).sections[nodes[0].id]).toBe('mixed');
 });
 it('completes a section cumulatively while preserving neighboring section attribution',async()=>{
  const {source,nodes,baseline}=await fixture(),first=change(baseline,nodes[0],'First AI paragraph.','My first paragraph.'),second=change(first.after,nodes[0],'Second AI paragraph.','My second paragraph.',[first.draft]);
  const progress=cardSectionAuthorship(source,nodes,[second.after],[first.draft,second.draft]);expect(progress.human).toBe(1);expect(progress.sections[nodes[0].id]).toBe('human');expect(progress.sections[nodes[1].id]).toBe('ai');
 });
 it('counts surviving human prose after removal of the remaining AI',async()=>{
  const {source,nodes,baseline}=await fixture(),first=change(baseline,nodes[0],'First AI paragraph.','My first paragraph.'),second=change(first.after,nodes[0],'Second AI paragraph.','',[first.draft]);
  expect(cardSectionAuthorship(source,nodes,[second.after],[first.draft,second.draft]).human).toBe(1);
 });
 it('uses applied provenance during pending edits, then recomputes after undo',async()=>{
  const {source,nodes,baseline}=await fixture(),first=change(baseline,nodes[0],'First AI paragraph.','My first paragraph.'),second=change(first.after,nodes[0],'Second AI paragraph.','My second paragraph.',[first.draft]);
  second.draft.results[0]={...second.draft.results[0],text:'Pending revision.',checked:false,applied:false};
  expect(cardSectionAuthorship(source,nodes,[second.after],[first.draft,second.draft]).human).toBe(1);
  second.draft.results[0].appliedText=second.draft.results[0].beforeText;second.draft.results[0].integrationId=undefined;
  expect(cardSectionAuthorship(source,nodes,[{...first.after,revision:3}],[first.draft,second.draft]).human).toBe(0);
 });
 it('does not count an empty removed section or ambiguous/mismatched provenance',async()=>{
  const {source,nodes,baseline}=await fixture(),removed=change(baseline,nodes[0],nodes[0].text,'');
  expect(cardSectionAuthorship(source,nodes,[removed.after],[removed.draft]).human).toBe(0);
  const mismatched={...baseline,sourceHash:'older-source'};expect(cardSectionAuthorship(source,nodes,[mismatched],[]).sections[nodes[0].id]).toBe('unknown');
  const corrupt={...baseline,blocks:[{id:'unlocated',text:'Unrelated human words.',origin:'human' as const,evidence:[]}]};expect(cardSectionAuthorship(source,nodes,[corrupt],[]).human).toBe(0);
 });
 it('includes Intro and proves whole replacement and undo without counting pending words',async()=>{
  const {source,nodes}=await fixture(),all=cardSections(source,'AI introduction.'),intro=all[0],draft=introSession(source,intro,{});
  expect(cardSectionAuthorship(source,all,[],[draft]).human).toBe(1);expect(cardSectionAuthorship(source,all,[],[draft]).total).toBe(nodes.length+1);
  draft.results[0].applied=false;expect(cardSectionAuthorship(source,all,[],[draft]).human).toBe(1);
  draft.results[0].text='Unapplied different words.';expect(cardSectionAuthorship(source,all,[],[draft]).sections[intro.id]).toBe('unknown');
  draft.results[0].appliedText=intro.text;expect(cardSectionAuthorship(source,all,[],[draft]).sections[intro.id]).toBe('ai');
 });
 it('reconstructs Intro additions and rejects broken receipt chains',async()=>{
  const {source}=await fixture(),all=cardSections(source,'AI introduction.'),intro=all[0];
  const add=introSession(source,intro,{editIntent:'add',text:'My addition.',appliedText:intro.text+'\n\nMy addition.'});expect(cardSectionAuthorship(source,all,[],[add]).sections[intro.id]).toBe('mixed');
  const first=introSession(source,intro,{}),second=introSession(source,intro,{editIntent:'add',beforeText:'My introduction.',text:'My addition.',appliedText:'My introduction.\n\nMy addition.',appliedAt:'2026-10-31T12:01:00Z'});
  expect(cardSectionAuthorship(source,all,[],[first,second]).sections[intro.id]).toBe('human');
  second.results[0].beforeText='Missing earlier version.';expect(cardSectionAuthorship(source,all,[],[second]).sections[intro.id]).toBe('unknown');
 });
 it('follows matched Intro replacement choices through cumulative applications',async()=>{
  const {source}=await fixture(),all=cardSections(source,'First AI.\n\nSecond AI.'),intro=all[0];
  const firstText='My first.\n\nSecond AI.',first=introSession(source,intro,{text:'My first.',appliedText:firstText,comparison:normalizePassageComparison(intro.text,'My first.',[{original:'First AI.',spoken:'My first.'},{original:'Second AI.',spoken:''}])});
  expect(cardSectionAuthorship(source,all,[],[first]).sections[intro.id]).toBe('mixed');
  const second=introSession(source,intro,{beforeText:firstText,text:'My second.',appliedText:'My first.\n\nMy second.',appliedAt:'2026-10-31T12:01:00Z',comparison:normalizePassageComparison(firstText,'My second.',[{original:'My first.',spoken:''},{original:'Second AI.',spoken:'My second.'}])});
  expect(cardSectionAuthorship(source,all,[],[first,second]).sections[intro.id]).toBe('human');
 });
 it('does not use other-source receipts as evidence and returns exact origin spans',async()=>{
  const {source,nodes,baseline}=await fixture(),full=change(baseline,nodes[0],nodes[0].text,'My complete reading.');full.draft.sourceHash='older-source';
  // The literal displaced span is independently valid; a foreign receipt adds no credit.
  expect(cardSectionAuthorship(source,nodes,[full.after],[full.draft])).toEqual(cardSectionAuthorship(source,nodes,[full.after],[]));
  const all=cardSections(source,'AI introduction.'),intro=all[0],foreign=introSession(source,intro,{});foreign.sourceHash='older-source';
  expect(cardSectionAuthorship(source,all,[],[foreign]).sections[intro.id]).toBe('ai');
  foreign.sourceHash=source.hash;foreign.cardNumber=3;expect(cardSectionAuthorship(source,all,[],[foreign]).sections[intro.id]).toBe('ai');
  const spans=readingOriginSpans(full.after,0,'My complete reading.'.length);expect(spans).toEqual([{text:'My complete reading.',origin:'human'}]);
  expect(readingOriginSpans({...baseline,blocks:[]})[0].origin).toBe('unknown');
 });
 it('exposes only the human spans in a mixed applied section, including Intro',async()=>{
  const {source,nodes,baseline}=await fixture(),part=change(baseline,nodes[0],'First AI paragraph.','My first paragraph.');
  const spans=namedSectionOriginSpans(source,nodes[0],[part.after],[part.draft])!;expect(spans.map(span=>span.text).join('')).toBe(part.draft.results[0].appliedText);expect(spans.filter(span=>span.origin==='human').map(span=>span.text)).toEqual(['My first paragraph.']);
  const all=cardSections(source,'AI introduction.'),intro=all[0],add=introSession(source,intro,{editIntent:'add',text:'My addition.',appliedText:intro.text+'\n\nMy addition.'});
  expect(namedSectionOriginSpans(source,intro,[],[add])).toEqual([{text:intro.text,origin:'ai'},{text:'\n\nMy addition.',origin:'human'}]);
 });
});
