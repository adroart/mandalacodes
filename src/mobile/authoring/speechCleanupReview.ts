import type {SectionDraftResult} from '../../../lib/oracle/authoring/sectionDrafts';
const tokens=(text:string)=>text.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
/** Restore literal speech from saved evidence, never generate a replacement for it. */
export function restoreDocumentedCleanup(result:SectionDraftResult,index:number):SectionDraftResult {
 if(!Number.isInteger(index)||index<0||index>=result.changes.length)throw Error('Choose an existing documented cleanup to restore.');
 if(!result.evidenceQuotes.length||result.evidenceQuotes.some(quote=>!quote.trim()))throw Error('The original spoken evidence is unavailable. Keep the current words and review the recording.');
 const source=result.evidenceQuotes.join(' ');
 const replay=(skip:number)=>{
  let text=source;
  for(const [changeIndex,change]of result.changes.entries()){
   const at=text.indexOf(change.before);
   if(!change.before||at<0||text.indexOf(change.before,at+1)>=0)throw Error('This cleanup cannot be located uniquely in the original speech. Review the exact words before restoring it.');
   if(changeIndex!==skip)text=text.slice(0,at)+change.after+text.slice(at+change.before.length);
  }
  return text;
 };
 const current=replay(-1);
 if(JSON.stringify(tokens(current))!==JSON.stringify(tokens(result.text)))throw Error('These words have newer edits that do not match the documented cleanup. Keep those edits and review the original recording.');
 const text=replay(index);
 return {...result,text,changes:result.changes.filter((_,changeIndex)=>changeIndex!==index),comparison:undefined,checked:false,applied:false};
}
