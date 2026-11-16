import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeAssimilation,validateAssimilation,splitAssimilationWords,assimilationPart,mergeAssimilationParts} from '../../tools/oracle-section-assimilation.mjs';
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
test('splits long words at sentence starts into contiguous parts that keep every character',()=>{
 const words='One thought here. Another thought there. A third one now. And the last.';
 const parts=splitAssimilationWords(words,0,words.length,2);
 assert.equal(parts.length,2);assert.equal(parts.map(([from,to])=>words.slice(from,to)).join(''),words);
 assert.match(words.slice(...parts[0]),/\. $/);assert.deepEqual(splitAssimilationWords(words,0,words.length,1),[[0,words.length]]);
 assert.equal(splitAssimilationWords('Just one sentence',0,17,2).length,2);assert.deepEqual(splitAssimilationWords('Word',0,4,2),[[0,4]]);
});
test('gives each part its own segments, the markers inside it and the focus the last earlier marker set',()=>{
 const a='2/CODE/reading',b='2/CODE/gift';
 const input=safeAssimilation({words:'First part words. Second part words.',sections:[section(a),section(b)],startSectionId:a,markers:[{atMs:500,sectionId:b},{atMs:1500,sectionId:a}],segments:[{text:'First part words.',startMs:0,endMs:1000},{text:' Second part words.',startMs:1000,endMs:2000}]});
 const [first,second]=splitAssimilationWords(input.words,0,input.words.length,2).map(([from,to])=>assimilationPart(input,from,to));
 assert.equal(first.words,'First part words. ');assert.deepEqual(first.segments.map(s=>s.startMs),[0]);assert.deepEqual(first.markers.map(m=>m.atMs),[500]);assert.equal(first.startSectionId,a);
 assert.equal(second.words,'Second part words.');assert.deepEqual(second.segments.map(s=>s.startMs),[1000]);assert.deepEqual(second.markers.map(m=>m.atMs),[1500]);assert.equal(second.startSectionId,b);
 assert.equal(assimilationPart(input,0,input.words.length),input);
});
test('merges parts into one review that passes whole-words validation, moving review issues into the whole words',()=>{
 const id='2/CODE/reading',input=safeAssimilation({words:'First part words. Second part words.',sections:[section(id)],startSectionId:id});
 const firstWords='First part words. ',secondWords='Second part words.',from=firstWords.length;
 const parts=[
  {from:0,to:from,candidate:{sections:[{sectionId:id,text:'First part words.',evidenceQuotes:[firstWords],changes:[],warnings:[],comparison:[{original:'Original',spoken:'First part words.'}]}],unassigned:[]}},
  {from,to:input.words.length,candidate:{sections:[{sectionId:id,text:secondWords,evidenceQuotes:[secondWords],changes:[],warnings:[],reviewIssues:[{kind:'ambiguity',scope:'rawTranscript',quote:'Second',start:0,end:6,message:'Which second?'}]}],unassigned:[]}},
 ];
 const result=validateAssimilation(mergeAssimilationParts(input,parts,'unsure'),input);
 assert.equal(result.sections.length,1);assert.equal(result.sections[0].text,'First part words.\n\nSecond part words.');
 assert.deepEqual(result.sections[0].reviewIssues.map(i=>[i.start,i.end]),[[from,from+6]]);assert.equal(result.sections[0].comparison,undefined);
 const lost=validateAssimilation(mergeAssimilationParts(input,[parts[0],{from,to:input.words.length}],'unsure'),input);
 assert.deepEqual(lost.unassigned,[{text:secondWords,reason:'unsure'}]);
});
