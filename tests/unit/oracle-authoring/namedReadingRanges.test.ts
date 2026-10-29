import {expect,it} from 'vitest';
import {namedReadingRanges} from '../../../components/oracle/authoring/namedReadingRanges';
import {cardSections,type CardSection} from '../../../lib/oracle/authoring/cardSections';
import {createSectionDraftSession,type SectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {createWorkingText,type WorkingSection} from '../../../lib/oracle/authoring/humanDrafts';
import {sourceSnapshot} from '../../../lib/oracle/authoring/workflow';
async function fixture(){
 const markdown='### The drive — Gate 2\nFirst sentence. A middle phrase. Last sentence.\n\nAnother drive paragraph.\n\n### Where it lives\nThe centre stays here.\n\n### The channel\nThe channel stays here.';
 const source=await sourceSnapshot(2,'original',markdown,[{id:'DESIGN',title:'Human Design',start:0,end:markdown.length}]);const nodes=cardSections(source),text=nodes[0].sectionText;
 const baseline=createWorkingText(source,'DESIGN',text);baseline.blocks[0].origin='ai';return {source,nodes,baseline};
}
function edit(before:WorkingSection,node:CardSection,old:string,words:string,source=before.source){
 const start=before.text.indexOf(old),end=start+old.length,text=before.text.slice(0,start)+words+before.text.slice(end);
 const after={...before,text,revision:before.revision+1,blocks:[{id:'prefix',text:before.text.slice(0,start),origin:'ai' as const,evidence:[]},{id:'edit',text:words,origin:'human' as const,evidence:[],replacedText:old},{id:'suffix',text:before.text.slice(end),origin:'ai' as const,evidence:[]}]};
 const selection={...node,id:`2/DESIGN/selection-${start}-${end}`,text:old,sectionText:before.text,start,end};
 const draft:SectionDraftSession={...createSectionDraftSession(source,[selection]),results:[{sectionId:selection.id,text:words,evidenceQuotes:[words],changes:[],warnings:[],checked:true,applied:true,appliedText:words,beforeText:old,beforeWorking:before,appliedAt:'2026-10-29T10:00:00Z'}]};
 return {after,draft};
}
it('keeps canonical headings and identities after an exact middle-span replacement',async()=>{
 const {nodes,baseline}=await fixture(),{after,draft}=edit(baseline,nodes[0],'A middle phrase.','My selected words.');
 const ranges=namedReadingRanges(after,[draft]);expect(ranges.map(range=>range.section.id)).toEqual(nodes.map(node=>node.id));expect(ranges[0].section.title).toBe(nodes[0].title);
 expect(after.text.slice(ranges[0].start,ranges[0].end)).toBe(nodes[0].text.replace('A middle phrase.','My selected words.'));expect(after.text.slice(ranges[1].start,ranges[1].end)).toBe(nodes[1].text);
});
it('follows repeated selected revisions when only the newest receipt remains',async()=>{
 const {nodes,baseline}=await fixture(),first=edit(baseline,nodes[0],'A middle phrase.','My selected words.'),second=edit(first.after,nodes[0],'My selected words.','My final words.');
 const ranges=namedReadingRanges(second.after,[second.draft]);expect(ranges.map(range=>range.section.id)).toEqual(nodes.map(node=>node.id));expect(second.after.text.slice(ranges[0].start,ranges[0].end)).toContain('My final words.');
});
it('replays separate section edits and retains neighboring headings',async()=>{
 const {nodes,baseline}=await fixture(),first=edit(baseline,nodes[0],'A middle phrase.','My selected words.'),second=edit(first.after,nodes[1],'The centre stays here.','My centre receives.');
 const ranges=namedReadingRanges(second.after,[first.draft,second.draft]);expect(ranges.map(range=>range.section.id)).toEqual(nodes.map(node=>node.id));expect(second.after.text.slice(ranges[2].start,ranges[2].end)).toBe(nodes[2].text);
});
it('selection title edits do not rename the containing canonical section',async()=>{
 const {nodes,baseline}=await fixture(),{after,draft}=edit(baseline,nodes[0],'A middle phrase.','My selected words.');
 draft.titleEdits={[draft.sections[0].id]:{text:'My tiny selection',updatedAt:'2026-10-29T11:00:00Z'}};
 const ranges=namedReadingRanges(after,[draft]);expect(ranges[0].section.title).toBe(nodes[0].title);
});
it('omits labels for cross-heading spans and leaves untouched headings available',async()=>{
 const {nodes,baseline}=await fixture(),old=baseline.text.slice(nodes[0].end-10,nodes[1].start+10),{after,draft}=edit(baseline,nodes[0],old,'One combined passage.');
 expect(namedReadingRanges(after,[draft]).map(range=>range.section.id)).toEqual([nodes[2].id]);
});
it('does not guess from ambiguous displaced provenance',async()=>{
 const {nodes,baseline}=await fixture();const after={...baseline,text:baseline.text.replace('A middle phrase.','New words.'),blocks:[{id:'one',text:'New',origin:'human' as const,evidence:[],replacedText:'A middle phrase.'},{id:'two',text:' words.',origin:'human' as const,evidence:[],replacedText:'A middle phrase.'}]};
 const ranges=namedReadingRanges(after,[]);expect(ranges.map(range=>range.section.id)).toEqual(nodes.slice(1).map(node=>node.id));
});
