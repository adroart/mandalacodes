import {describe,it,expect} from 'vitest';
import {placeReviewChecks,initialReviewOrder} from '../../../lib/oracle/authoring/reviewPresentation';
import {buildPassageComparison,comparisonRows,normalizePassageComparison} from '../../../lib/oracle/authoring/passageComparison';

describe('review presentation without changing evidence or source order',()=>{
 it('leads with the changed passage while preserving its original edit index',()=>{
  const original='First original.\n\nMiddle original.\n\nLast original.',text='My middle words.';
  const comparison=normalizePassageComparison(original,text,[{original:'First original.',spoken:''},{original:'Middle original.',spoken:text},{original:'Last original.',spoken:''}]);
  const rows=comparisonRows(buildPassageComparison(original,text,comparison));
  expect(initialReviewOrder(rows)).toEqual([rows[1].key,rows[0].key,rows[2].key]);
  expect(rows.map(row=>row.original)).toEqual(['First original.','Middle original.','Last original.']);
 });
 it('maps a uniquely displayed word rather than reusing raw transcript offsets',()=>{
  const checks=[{key:'raw/18',quote:'chess',message:'Possible mishearing',done:false,canHear:true}];
  expect(placeReviewChecks('I feel it in my chess.',checks)[0]).toMatchObject({from:16,to:21});
 });
 it('keeps repeated phrases unanchored rather than confirming the wrong occurrence',()=>{
  const checks=[{key:'raw/18',quote:'chess',message:'Possible mishearing',done:false,canHear:true}];
  expect(placeReviewChecks('chess and chess',checks)[0].from).toBeUndefined();
 });
 it('keeps a section-level ambiguity unanchored even in a locally unique passage',()=>{
  const check={key:'a',quote:'chess',message:'Possible mishearing',done:false,canHear:true,unanchored:true};
  expect(placeReviewChecks('Only this chess.',[check])).toEqual([check]);
 });
 it('does not mark part of another word',()=>{
  const checks=[{key:'a',quote:'chess',message:'Check this word',done:false,canHear:false}];
  expect(placeReviewChecks('A chessboard and chess.',checks)[0]).toMatchObject({from:17,to:22});
 });
 it('removes the resolved annotation after its quote is edited away, retaining general checks',()=>{
  const checks=[{key:'a',quote:'chess',message:'Check this word',done:true,canHear:true},{key:'b',message:'Check the destination.',done:false,canHear:false}];
  expect(placeReviewChecks('I feel it in my chest.',checks)).toEqual([{...checks[1]}]);
 });
});

// Rendering proves the source edit index survives the changed-first DOM order.
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import SectionPassageReview from '../../../components/oracle/authoring/SectionPassageReview';
it('renders human words ahead of their original and keeps unchanged passages in the document',()=>{
 const original='First original.\n\nMiddle original.\n\nLast original.',text='My middle words.';
 const comparison=normalizePassageComparison(original,text,[{original:'First original.',spoken:''},{original:'Middle original.',spoken:text},{original:'Last original.',spoken:''}]);
 const html=renderToStaticMarkup(React.createElement(SectionPassageReview,{original,text,comparison,sessionKey:'render',disabled:false,replayDisabled:false,replay:{text,words:[],captureId:'render-fixture'},activeWord:-1,onReplay:()=>{},onSeek:()=>{},onEdit:async()=>{}}));
 expect(html.indexOf('data-passage-index="1"')).toBeLessThan(html.indexOf('data-passage-index="0"'));
 expect(html.indexOf('My middle words.')).toBeLessThan(html.indexOf('Middle original.'));
 expect(html).toContain('First original.');expect(html).toContain('Last original.');
 expect(html).not.toContain('You spoke about');expect(html).not.toContain('position:sticky');
});
