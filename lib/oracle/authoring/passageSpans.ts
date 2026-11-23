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
