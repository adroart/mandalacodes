import {readingParagraphs} from './passageComparison';
/**
 * Small pure helpers for passage edits recorded one after another in the same section: whether two edits
 * touch the same words, and carrying a waiting edit onto a newer version of the section.
 */
export interface TextSpan {start:number;end:number;text:string}

/** Two edits of the same section text clash when their spans share a character. */
export function spansOverlap(a:{start:number;end:number},b:{start:number;end:number}):boolean{
 return a.start<b.end&&b.start<a.end;
}

/**
 * Carry a passage edit made against one version of the section onto a newer one. The focus must still be
 * there, word for word, exactly once; otherwise there is no safe place for it and the caller asks again.
 */
export function rebasePassageEdit<T extends {focus:TextSpan;sectionText:string}>(edit:T,currentText:string):T|undefined{
 if(edit.sectionText===currentText)return currentText.slice(edit.focus.start,edit.focus.end)===edit.focus.text?edit:undefined;
 const at=currentText.indexOf(edit.focus.text);
 if(at<0||currentText.indexOf(edit.focus.text,at+1)>=0)return;
 return {...edit,sectionText:currentText,focus:{start:at,end:at+edit.focus.text.length,text:edit.focus.text}};
}

/**
 * The paragraph after a recorded passage: the next one in its section, or the first of the next section
 * that has words. `texts` holds each section's current text where it differs from the card.
 */
export function followingParagraph(sections:{id:string;text:string}[],texts:Record<string,string>,sectionId:string,focus:TextSpan):(TextSpan&{sectionId:string})|undefined{
 const index=sections.findIndex(section=>section.id===sectionId);
 if(index<0)return;
 const textOf=(at:number)=>texts[sections[at].id]??sections[at].text;
 const here=textOf(index),found=here.indexOf(focus.text),end=found>=0&&here.indexOf(focus.text,found+1)<0?found+focus.text.length:focus.end;
 const next=readingParagraphs(here).find(paragraph=>paragraph.start>=end);
 if(next)return {sectionId,...next};
 for(let at=index+1;at<sections.length;at++){
  const first=readingParagraphs(textOf(at))[0];
  if(first)return {sectionId:sections[at].id,...first};
 }
}
