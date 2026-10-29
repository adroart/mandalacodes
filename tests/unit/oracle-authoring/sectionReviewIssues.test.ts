import {expect,it} from 'vitest';
import {prepareSectionEdit,sectionComparisonOriginal,transcriptionReviewIssues} from '../../../lib/oracle/authoring/sectionDrafts';
import {explicitDestinationCards} from '../../../src/mobile/authoring/sectionTakes';
it('anchors low provider probabilities to precise repeated words and times without inventing certainty',()=>{
 const raw='direction direction follows.';
 const issues=transcriptionReviewIssues(raw,[{raw,captureId:'take',words:[{text:'direction',startMs:0,endMs:100,probability:.9},{text:'direction',startMs:150,endMs:300,probability:.2},{text:'follows',startMs:350,endMs:500}]}],[raw]);
 expect(issues).toHaveLength(1);expect(issues[0]).toMatchObject({quote:'direction',start:10,end:19,startMs:150,endMs:300,probability:.2});expect(raw.slice(issues[0].start,issues[0].end)).toBe(issues[0].quote);
 expect(transcriptionReviewIssues(raw,[{raw,captureId:'take',words:[{text:'direction',startMs:0,endMs:100,probability:.1}]}],['follows.'])).toEqual([]);
});
it('uses comparison baseline independently of preserved undo text',()=>{
 expect(sectionComparisonOriginal({sectionId:'section',text:'Third',evidenceQuotes:[],changes:[],warnings:[],checked:false,beforeText:'First',appliedText:'Second',comparisonOriginal:'Second'},'Published')).toBe('Second');
});
it('requires exact selected revision scope and constructs a complete reviewable candidate',()=>{
 const original='First paragraph.\n\nSecond paragraph.';
 expect(prepareSectionEdit(original,'New second.','revise',{start:18,end:35,text:'Second paragraph.'})).toBe('First paragraph.\n\nNew second.');
 expect(prepareSectionEdit(original,'Third.','add')).toBe(original+'\n\nThird.');
 expect(()=>prepareSectionEdit(original,'Changed.','revise')).toThrow('Select');
 expect(()=>prepareSectionEdit(original,'Changed.','revise',{start:18,end:35,text:'Stale words'})).toThrow('changed');
});
it('detects explicit navigation numbers without incidental card mentions',()=>{
 expect(explicitDestinationCards('Gate 14 relates to gate 2. Next card fourteen. Move to code sixty-four. Next gate 0. Next card 65.',2)).toEqual([14,64]);
 expect(explicitDestinationCards('For card fourteen the same holds. The next card has a relation to gate 14.',2)).toEqual([]);
});
it('recognizes conservative opening add and replace instructions without interpreting personal prose',async()=>{
 const {inferSpokenEditIntent}=await import('../../../src/mobile/authoring/sectionTakes');
 for(const words of ['Add this. Another thought.','Please add to this section: Further words.','Append another paragraph.','Okay, add these words.'])expect(inferSpokenEditIntent(words,true)).toBe('add');
 for(const words of ['Replace this section.','Rewrite the whole section.','Start over.','I add love to my work.','When I append meaning, I change it.','The words say add this.','My paragraph. Add this later.','Additional meaning comes.'])expect(inferSpokenEditIntent(words,true)).toBe('replace');
 expect(inferSpokenEditIntent('My words override the earlier reading.',false)).toBe('replace');
});
