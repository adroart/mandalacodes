import type {PassageAnchor} from '../../../lib/oracle/authoring/passageContext';
import type {CardSection} from '../../../lib/oracle/authoring/cardSections';
import type {SourceSnapshot} from '../../../lib/oracle/authoring/types';
import {snapshotVoiceTargets} from './voiceTargets';
/** Selection is an exact source span, never a topic inferred from a heading. */
export function focusedVoiceSections(source:SourceSnapshot,nodes:CardSection[],anchors:PassageAnchor[]):CardSection[]{
 const selected=snapshotVoiceTargets(anchors.filter(anchor=>anchor.cardNumber===source.cardNumber));
 return selected.map((anchor,index)=>{
  if(anchor.sourceHash&&anchor.sourceHash!==source.hash)throw Error('This selection belongs to an older card. Select the passage again.');
  const parent=nodes.find(node=>node.lensId===anchor.sectionId&&node.text.includes(anchor.text))??nodes.find(node=>node.lensId===anchor.sectionId);
  if(!parent)throw Error('This selected passage has no matching card section.');
  return {...parent,id:`${source.cardNumber}/${anchor.sectionId}/selection-${anchor.start}-${anchor.end}`,title:selected.length===1?parent.title:`${parent.title} · selection ${index+1}`,path:[...parent.path,'Selected passage'],text:anchor.text,sectionText:anchor.sectionText,start:anchor.start,end:anchor.end};
 });
}
