import React, { lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../../hooks/useDialogFocus';
import './authoring-sheet.css';
const Page=lazy(()=>import('./OracleAuthoringPage'));
export default function OracleAuthoringSheet({cardNumber,sectionId,onClose}:{cardNumber:number;sectionId:string;onClose:()=>void}) {
 const panel=useRef<HTMLDivElement>(null);
 const close=useCallback(()=>{if(panel.current?.querySelector('[data-authoring-protected=true]'))return;onClose();},[onClose]);
 useDialogFocus(panel,true,close);
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[]);
 return createPortal(<div className="oracle-authoring-backdrop"><div className="oracle-authoring-sheet" ref={panel} role="dialog" aria-modal="true" aria-label="Record and edit Oracle cards" tabIndex={-1}><Suspense fallback={<p role="status">Opening recording…</p>}><Page cardNumber={cardNumber} initialSection={sectionId} onDismiss={close}/></Suspense></div></div>,document.body);
}
