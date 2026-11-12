import {useLayoutEffect,type RefObject} from 'react';

/** A keyboard is at least this tall; smaller differences are browser chrome settling, not a keyboard. */
const KEYBOARD_MIN=120;

/**
 * Keeps the workspace inside the part of the screen the software keyboard leaves visible.
 *
 * On iOS the keyboard overlays the web view: the layout stays full height and only the visual
 * viewport shrinks, so a full-height workspace would keep its dock under the keyboard. This writes
 * the visible height and its offset as `--vs-vv-height` and `--vs-vv-top` on the workspace root and
 * marks it `data-keyboard` while a keyboard is open; the stylesheet then pins the workspace to that
 * area, so the bar stays at the top and the dock sits directly above the keyboard. Where
 * `visualViewport` is missing nothing is written and the workspace keeps its normal size.
 * A pinch zoom also shrinks the visual viewport; it is not a keyboard and is left alone.
 */
export function useVisualViewport(root:RefObject<HTMLElement>){
 useLayoutEffect(()=>{
  const el=root.current,vv=window.visualViewport;
  if(!el||!vv)return;
  let frame=0;
  const apply=()=>{
   frame=0;
   const height=vv.height,top=vv.offsetTop,open=vv.scale<1.05&&window.innerHeight-height>=KEYBOARD_MIN;
   if(open){
    el.style.setProperty('--vs-vv-height',`${Math.round(height)}px`);
    el.style.setProperty('--vs-vv-top',`${Math.round(top)}px`);
    el.setAttribute('data-keyboard','');
   }else if(el.hasAttribute('data-keyboard')){
    el.removeAttribute('data-keyboard');
    el.style.removeProperty('--vs-vv-height');
    el.style.removeProperty('--vs-vv-top');
   }
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(apply);};
  apply();
  vv.addEventListener('resize',schedule);
  vv.addEventListener('scroll',schedule);
  window.addEventListener('resize',schedule);
  return()=>{
   cancelAnimationFrame(frame);
   vv.removeEventListener('resize',schedule);
   vv.removeEventListener('scroll',schedule);
   window.removeEventListener('resize',schedule);
  };
 },[root]);
}
