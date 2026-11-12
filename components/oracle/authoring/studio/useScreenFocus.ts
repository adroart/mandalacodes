import {useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';

/** True while the person is typing: focus is never taken from a field they are writing in. */
function typing(){
 const el=document.activeElement as HTMLElement|null;
 return !!el&&(el.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),textarea,select')||el.isContentEditable);
}

/**
 * When the workspace changes screen, focus moves to that screen's title in the top bar (the element
 * marked `data-screen-title`), so a keyboard or VoiceOver user lands at the top of the new screen.
 * The first screen is left to the sheet's own focus handling. Focus never scrolls the page and is
 * never taken from a text field.
 */
export function useScreenFocus(root:RefObject<HTMLElement>,screen:string){
 const first=useRef(true);
 useEffect(()=>{
  if(first.current){first.current=false;return;}
  if(typing())return;
  root.current?.querySelector<HTMLElement>('[data-screen-title]')?.focus({preventScroll:true});
 },[screen]);
}

/**
 * Remembers where the manuscript was scrolled when another screen replaces it, and puts it back
 * when the manuscript returns. It is restored only when nothing has moved the destination in the
 * meantime (choosing a section scrolls to that section instead) and no recording is running (a
 * recording scrolls to its own section).
 */
export function useManuscriptScroll(root:RefObject<HTMLElement>,manuscript:RefObject<HTMLElement>,view:string,targetId:string,sessionId:string|undefined,recording:boolean){
 const saved=useRef<{top:number;targetId:string;sessionId?:string}|null>(null);
 const latest=useRef({targetId,sessionId});
 latest.current={targetId,sessionId};
 useEffect(()=>{
  const el=root.current;
  if(!el)return;
  const remember=(e:Event)=>{if(e.target===manuscript.current)saved.current={top:manuscript.current.scrollTop,...latest.current};};
  el.addEventListener('scroll',remember,{capture:true,passive:true});
  return()=>el.removeEventListener('scroll',remember,{capture:true});
 },[root,manuscript]);
 const restore=()=>{
  const s=saved.current,el=manuscript.current;
  if(view!=='work'||recording||!s||!el||s.targetId!==targetId||s.sessionId!==sessionId)return;
  el.scrollTop=s.top;
 };
 // Before paint, so the manuscript never shows at the top first; again after the studio's own
 // effects, which reveal the destination section when the manuscript opens.
 useLayoutEffect(restore,[view]);
 useEffect(restore,[view]);
}

/**
 * One polite announcement per change of recording state: "Recording", "Paused", then "Saved" when
 * the recording ends. The clock is never announced.
 */
export function useRecordingAnnouncement(recording:boolean,paused:boolean){
 const [message,setMessage]=useState('');
 const was=useRef(false);
 useEffect(()=>{
  if(recording)setMessage(paused?'Paused':'Recording');
  else if(was.current)setMessage('Saved');
  was.current=recording;
 },[recording,paused]);
 return message;
}
