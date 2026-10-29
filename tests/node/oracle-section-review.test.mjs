import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeAssimilation,validateAssimilation} from '../../tools/oracle-section-assimilation.mjs';
const section=(id,text='Original')=>({id,title:'Reading',path:['Universal Language','Reading'],text});
test('preserves real related destinations, rejects mismatched cards, and returns exact comparison baseline',()=>{
 const input=safeAssimilation({words:'Human words.',sections:[section('2/CODE/reading')],startSectionId:'2/CODE/reading',intent:'revise',relatedSources:[{cardNumber:14,sections:[section('14/CODE/reading','Latest human reading.')]}]});
 const result=validateAssimilation({sections:[{sectionId:'14/CODE/reading',text:'Human words.',evidenceQuotes:['Human words.'],changes:[],warnings:[]}],unassigned:[]},input);
 assert.equal(result.sections[0].comparisonOriginal,'Latest human reading.');assert.equal(input.intent,'revise');
 assert.throws(()=>safeAssimilation({...input,relatedSources:[{cardNumber:14,sections:[section('12/CODE/reading')]}]}),/match its card/);
});
test('accepts only exact quoted ambiguity and strips fabricated probability fields',()=>{
 const input=safeAssimilation({words:'Human words.',sections:[section('2/CODE/reading')],startSectionId:'2/CODE/reading'});
 const issue={kind:'ambiguity',scope:'rawTranscript',quote:'words',start:6,end:11,message:'Which sense of words?',probability:.1};
 const output={sections:[{sectionId:'2/CODE/reading',text:input.words,evidenceQuotes:[input.words],changes:[],warnings:[],reviewIssues:[issue]}],unassigned:[]};
 assert.equal(validateAssimilation(output,input).sections[0].reviewIssues[0].probability,undefined);
 assert.throws(()=>validateAssimilation({...output,sections:[{...output.sections[0],reviewIssues:[{...issue,start:0}]}]},input),/exact speech/);
});
test('documents abandoned attempts without losing their immutable spoken evidence',()=>{
 const input=safeAssimilation({words:'I give. No, I receive.',sections:[section('2/CODE/reading')],startSectionId:'2/CODE/reading'});
 const sectionResult={sectionId:'2/CODE/reading',text:'I receive.',evidenceQuotes:[input.words],changes:[{before:'I give. No, ',after:'',reason:'Speaker abandoned this attempt.'}],warnings:[]};
 assert.equal(validateAssimilation({sections:[sectionResult],unassigned:[]},input).sections[0].changes[0].before,'I give. No, ');
 assert.throws(()=>validateAssimilation({sections:[{...sectionResult,changes:[]}],unassigned:[]},input),/omitted/);
});
