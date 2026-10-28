import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { useDialogFocus } from '../../../hooks/useDialogFocus';
import OracleAudioPlayer from '../listening/OracleAudioPlayer';
import './reader-preferences.css';
const KEY = 'oracle.reader.preferences.v1';
type Preferences = { size: number; spacious: boolean };
export function readPreferences(): Preferences {
  try { const value = JSON.parse(localStorage.getItem(KEY) || '{}'); return {size:[17,19,21,24].includes(value.size) ? value.size : 17, spacious:value.spacious === true}; } catch { return {size:17,spacious:false}; }
}
export default function ReaderPreferences({cardNumber}:{cardNumber:number}) {
  const [open,setOpen] = useState(false);
  const [focused,setFocused] = useState(false);
  const [prefs,setPrefs] = useState(readPreferences);
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref,open,()=>setOpen(false));
  useEffect(()=>{
    document.documentElement.style.setProperty('--oracle-reading-size',`${prefs.size}px`);
    document.documentElement.style.setProperty('--oracle-reading-leading',prefs.spacious ? '1.9':'1.65');
    try { localStorage.setItem(KEY,JSON.stringify(prefs)); } catch {}
  },[prefs]);
  useEffect(()=>{
    document.body.classList.toggle('oracle-reading-focus',focused);
    return ()=>document.body.classList.remove('oracle-reading-focus');
  },[focused]);
  return <>
    <button aria-label="Reading preferences" onClick={()=>setOpen(true)}><span aria-hidden="true">Aa</span></button>
    {focused && <button className="oracle-exit-focus" onClick={()=>setFocused(false)}><X size={18} aria-hidden="true"/>Exit focus</button>}
    {open && <div className="oracle-reader-settings-backdrop" onClick={()=>setOpen(false)}>
      <div className="oracle-reader-settings" ref={ref} role="dialog" aria-modal="true" aria-label="Reading preferences" tabIndex={-1} onClick={e=>e.stopPropagation()}>
        <header><h2>Make room to read</h2><button aria-label="Close reading preferences" onClick={()=>setOpen(false)}><X size={22}/></button></header>
        <fieldset><legend>Text size</legend><div className="oracle-reader-sizes">{[17,19,21,24].map(size=><button key={size} aria-pressed={prefs.size===size} aria-label={`${size} point text`} onClick={()=>setPrefs(p=>({...p,size}))} style={{fontSize:size}}>Aa</button>)}</div></fieldset>
        <label><input type="checkbox" checked={prefs.spacious} onChange={e=>setPrefs(p=>({...p,spacious:e.target.checked}))}/>More space between lines</label>
        <button className="oracle-reader-focus-action" onClick={()=>{setFocused(true);setOpen(false);}}><BookOpen size={20}/>Focus on this reading</button>
        <OracleAudioPlayer cardNumber={cardNumber} />
        <p>Your text settings and reading position stay on this phone.</p>
      </div>
    </div>}
  </>;
}
/** Restore each reading's own scroll container after the lazy reader mounts. */
export function useReadingPosition(pathname:string) {
  useEffect(()=>{
    if (!/^\/universal-language\/\d+$/.test(pathname)) return;
    const key=`oracle.reader.position.v1:${pathname.split('/').pop()}`;
    let cleanup:undefined|(()=>void);
    let attempts=0;
    const timer=window.setInterval(()=>{
      const scroller=document.querySelector<HTMLElement>('.card-reading [data-scroll]');
      if (!scroller || !scroller.querySelector('[data-sec]')) { if(++attempts>100) window.clearInterval(timer); return; }
      window.clearInterval(timer);
      let saved=0;
      try { saved=Number(localStorage.getItem(key)) || 0; } catch {}
      let frame=0, ready=false;
      const restore=window.setTimeout(()=>{scroller.scrollTop=Math.max(0,saved);ready=true;},250);
      const save=()=>{if(!ready)return; try{localStorage.setItem(key,String(Math.round(scroller.scrollTop)));}catch{}};
      const onScroll=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(save);};
      scroller.addEventListener('scroll',onScroll,{passive:true});
      document.addEventListener('visibilitychange',save);
      cleanup=()=>{save();window.clearTimeout(restore);cancelAnimationFrame(frame);scroller.removeEventListener('scroll',onScroll);document.removeEventListener('visibilitychange',save);};
    },50);
    return ()=>{window.clearInterval(timer);cleanup?.();};
  },[pathname]);
}
