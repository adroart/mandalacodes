import React from 'react';
import type {CardSection} from '../../../../lib/oracle/authoring/cardSections';
import type {VoiceStudio} from './types';

export type SectionIndexProps=Pick<VoiceStudio,'nodes'|'chip'|'view'|'focusId'|'targetId'|'shownTitle'>&{
 onPick:(node:CardSection)=>void;
 mode:'rail'|'screen';
};

/** The list of card sections: the rail beside the manuscript and review, and the Sections screen. */
export default function SectionIndex({nodes,chip,view,focusId,targetId,shownTitle,onPick,mode}:SectionIndexProps){
 return <nav className={mode==='rail'?'vs-rail':'vs-index'} aria-label={mode==='rail'?'Card sections':'Choose a card section'}>
  {nodes.map((node,i)=>{
   const state=chip(node);
   return <React.Fragment key={node.id}>
    {node.lensId!==nodes[i-1]?.lensId&&node.path.length>1&&<h3>{node.path[0]}</h3>}
    <button data-section-id={node.id} aria-current={(view==='review'?focusId:targetId)===node.id?'step':undefined} onClick={()=>onPick(node)}>
     <span>{shownTitle(node)}</span>
     {state&&<i data-tone={state.tone} aria-label={state.label}/>}
    </button>
   </React.Fragment>;
  })}
 </nav>;
}
