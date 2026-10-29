import {expect,it} from 'vitest';
import {restoreDocumentedCleanup} from '../../../src/mobile/authoring/speechCleanupReview';
import type {SectionDraftResult} from '../../../lib/oracle/authoring/sectionDrafts';
const result=():SectionDraftResult=>({sectionId:'2/CODE/reading',text:'I receive direction.',evidenceQuotes:['I give. No, I receive receive direction.'],changes:[{before:'I give. No, ',after:'',reason:'Abandoned attempt.'},{before:'receive receive',after:'receive',reason:'Accidental stutter.'}],warnings:[],checked:true,applied:true});
it('restores an abandoned start verbatim while retaining the other documented cleanup',()=>{
 const original=result(),restored=restoreDocumentedCleanup(original,0);
 expect(restored.text).toBe('I give. No, I receive direction.');expect(restored.changes).toEqual([original.changes[1]]);expect(restored.checked).toBe(false);expect(restored.applied).toBe(false);expect(restored.comparison).toBeUndefined();expect(original.text).toBe('I receive direction.');expect(restored.evidenceQuotes).toEqual(original.evidenceQuotes);
 expect(restoreDocumentedCleanup(restored,0).text).toBe('I give. No, I receive receive direction.');
});
it('restores a correction to the exact saved original human wording',()=>{
 const original={...result(),text:'The Siddhi opens.',evidenceQuotes:['The city opens.'],changes:[{before:'city',after:'Siddhi',reason:'Context-based correction.'}]};
 expect(restoreDocumentedCleanup(original,0).text).toBe('The city opens.');
});
it('refuses ambiguous occurrences, unknown changes, newer writing, and invalid selections',()=>{
 expect(()=>restoreDocumentedCleanup({...result(),evidenceQuotes:['I give. I give.'],text:'I give.',changes:[{before:'I give.',after:'',reason:'Restart'}]},0)).toThrow('uniquely');
 expect(()=>restoreDocumentedCleanup({...result(),changes:[{before:'Unknown words',after:'',reason:'Unknown'}]},0)).toThrow('uniquely');
 expect(()=>restoreDocumentedCleanup({...result(),text:'Later human writing.'},0)).toThrow('newer edits');
 expect(()=>restoreDocumentedCleanup(result(),4)).toThrow('existing');
});
