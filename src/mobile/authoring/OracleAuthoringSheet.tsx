import React, { lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../../hooks/useDialogFocus';
import './authoring-sheet.css';
import type {PassageAnchor} from '../../../lib/oracle/authoring/passageContext';
const Page=lazy(()=>import('./OracleAuthoringPage'));
export default function OracleAuthoringSheet({cardNumber,sectionId,onClose,anchors}:{cardNumber:number;sectionId:string;onClose:()=>void;anchors?:PassageAnchor[]}) {
 const isolated=!!anchors?.length||new URLSearchParams(window.location.search).get('authoring')==='review';
 const panel=useRef<HTMLDivElement>(null);
 const close=useCallback(()=>{if(panel.current?.querySelector('[data-authoring-protected=true]'))return;onClose();},[onClose]);
 useDialogFocus(panel,isolated,close);
 useEffect(()=>{if(!isolated)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[isolated]);
 return createPortal(<div className={`oracle-authoring-backdrop${isolated?'':' oracle-authoring-backdrop--inline'}`}><div className="oracle-authoring-sheet" ref={panel} role="dialog" aria-modal={isolated?true:undefined} aria-label="Record and edit Oracle cards" tabIndex={-1}><Suspense fallback={<p role="status">Opening recording…</p>}><Page cardNumber={cardNumber} initialSection={sectionId} anchors={anchors} onDismiss={onClose}/></Suspense></div></div>,document.body);
}
