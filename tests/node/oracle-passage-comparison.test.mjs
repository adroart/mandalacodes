import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePassageComparison,validateAssimilation,assimilationInstructions} from '../../tools/oracle-section-assimilation.mjs';
const original='Old first.\n\nOld second.';
const spoken='New first.\n\nNew second.';
const links=[{original:'Old first.',spoken:'New first.'},{original:'Old second.',spoken:'New second.'}];
const input={words:spoken,sections:[{id:'2/CODE/reading',text:original}],startSectionId:'2/CODE/reading'};
const result={sections:[{sectionId:'2/CODE/reading',text:spoken,evidenceQuotes:[spoken],changes:[],warnings:[],comparison:links}],unassigned:[]};
test('passage comparison creates exact ranges and binds both baseline strings',()=>{
 const comparison=normalizePassageComparison(original,spoken,links);assert.deepEqual(comparison,{originalText:original,spokenText:spoken,pairs:[{originalStart:0,originalEnd:10,textStart:0,textEnd:10},{originalStart:12,originalEnd:23,textStart:12,textEnd:23}]});
 assert.deepEqual(validateAssimilation(result,input).sections[0].comparison,comparison);
 assert.ok(assimilationInstructions.includes('do not assume paragraph counts'));
});
test('invalid optional paragraph alignment never loses otherwise valid saved speech',()=>{
 for(const comparison of [undefined,[],[{original:'Invented original.',spoken}],links.slice(0,1),[...links].reverse(),[{original,spoken:'Invented speech.'}],{pairs:[]}]){
  const safe=validateAssimilation({...result,sections:[{...result.sections[0],comparison}]},input);assert.equal(safe.sections[0].text,spoken);assert.equal(safe.sections[0].comparison,undefined);
 }
});
test('repeated quotes and hidden original gaps do not create false links',()=>{
 assert.equal(normalizePassageComparison('Same. Same.','One. Two.',[{original:'Same.',spoken:'One.'},{original:'Same.',spoken:'Two.'}]),undefined);
 assert.equal(normalizePassageComparison(original,spoken,[{original:'first.',spoken:'New first.'},links[1]]),undefined);
});
test('empty sides represent explicit additions and omissions',()=>{
 const comparison=normalizePassageComparison(original,spoken,[links[0],{original:'Old second.',spoken:''},{original:'',spoken:'New second.'}]);assert.equal(comparison.pairs.length,3);assert.equal(comparison.pairs[1].textStart,comparison.pairs[1].textEnd);assert.equal(comparison.pairs[2].originalStart,comparison.pairs[2].originalEnd);
});
