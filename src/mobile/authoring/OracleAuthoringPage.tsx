import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PassageRecorder from '../../../components/oracle/authoring/PassageRecorder';
import type {PassageAnchor} from '../../../lib/oracle/authoring/passageContext';
import HumanCardAuthoring from '../../../components/oracle/authoring/HumanCardAuthoring';
import OracleVoiceFlow from '../../../components/oracle/authoring/OracleVoiceFlow';
import { automaticTranscription, automaticProposals } from './processing';
import { bundledSource } from './bundledSource';
import type { SourceSnapshot } from '../../../lib/oracle/authoring/types';
import { exportAuthoringFile } from './nativeExport';
import './authoring-app.css';
import { resumeHumanJobs } from './humanCaptureJobs';
const services = { loadSource: bundledSource, transcribe: automaticTranscription, propose: automaticProposals };
export function resumePendingHumanAuthoring(){resumeHumanJobs(services);}
export default function OracleAuthoringPage({ cardNumber, initialSection, onDismiss, anchors, startImmediately }: { cardNumber?: number; initialSection?: string; onDismiss?: () => void; anchors?: PassageAnchor[]; startImmediately?:boolean } = {}) {
  const { number: routeNumber } = useParams();
  const number = String(cardNumber ?? routeNumber ?? "");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [source, setSource] = useState<SourceSnapshot | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let alive = true; setSource(null); setError(''); bundledSource(Number(number)).then(s => { if (alive) setSource(s); }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [number]);
  const Editor=params.get('authoring')==='review'?OracleVoiceFlow:HumanCardAuthoring;
  return <div className="oracle-authoring-page">
    {error ? <div role="alert"><p>{error}</p><Link to="/universal-language">Open the index</Link></div> : source ? anchors?.length ? <PassageRecorder anchors={anchors} source={source} services={services} onApplied={anchor=>{if(Number(routeNumber)!==anchor.cardNumber)navigate(`/universal-language/${anchor.cardNumber}`);}} onClose={onDismiss ?? (()=>navigate(`/universal-language/${source.cardNumber}`))}/> : <Editor {...(params.get('authoring')==='review'?{}:{startImmediately})} key={source.cardNumber} source={source} services={services} sectionId={initialSection ?? params.get('section') ?? 'CODE'} exportFile={exportAuthoringFile} onClose={onDismiss ?? (() => navigate(`/universal-language/${source.cardNumber}`))} /> : <p role="status">Opening your card draft…</p>}
  </div>;
}
