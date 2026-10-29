import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {PassageAnchor} from '../../../lib/oracle/authoring/passageContext';
import SectionVoiceStudio from '../../../components/oracle/authoring/SectionVoiceStudio';
import HumanCardAuthoring from '../../../components/oracle/authoring/HumanCardAuthoring';
import OracleVoiceFlow from '../../../components/oracle/authoring/OracleVoiceFlow';
import { automaticTranscription, automaticProposals } from './processing';
import { bundledSource } from './bundledSource';
import type { SourceSnapshot } from '../../../lib/oracle/authoring/types';
import { exportAuthoringFile } from './nativeExport';
import './authoring-app.css';
const services = { loadSource: bundledSource, transcribe: automaticTranscription, propose: automaticProposals };
export default function OracleAuthoringPage({ cardNumber, initialSection, onDismiss, anchors, startImmediately,namedSectionId }: { cardNumber?: number; initialSection?: string; onDismiss?: () => void; anchors?: PassageAnchor[]; startImmediately?:boolean;namedSectionId?:string } = {}) {
  const { number: routeNumber } = useParams();
  const number = String(cardNumber ?? routeNumber ?? "");
  const [params] = useSearchParams();
  const [earlier,setEarlier]=useState(params.get('authoring')==='legacy');
  const navigate = useNavigate();
  const [source, setSource] = useState<SourceSnapshot | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let alive = true; setSource(null); setError(''); bundledSource(Number(number)).then(s => { if (alive) setSource(s); }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [number]);
  const Editor=params.get('authoring')==='review'?OracleVoiceFlow:HumanCardAuthoring;
  return <div className="oracle-authoring-page">
    {error ? <div role="alert"><p>{error}</p><Link to="/universal-language">Open the index</Link></div> : source ? !earlier&&params.get('authoring')!=='review'?<SectionVoiceStudio initialSessionId={anchors?.length?undefined:params.get('voiceSession')??undefined} initialAnchors={anchors} onNavigateCard={(card,sessionId)=>{navigate(`/universal-language/${card}${sessionId?`?voiceSession=${encodeURIComponent(sessionId)}`:''}`);requestAnimationFrame(()=>requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('oracle:open-recording',{detail:{sectionId:'CODE',cardNumber:card,review:true}}))));}} namedSectionId={namedSectionId} source={source} services={services} sectionId={initialSection??params.get('section')??'CODE'} onClose={onDismiss??(()=>navigate(`/universal-language/${source.cardNumber}`))} onEarlier={()=>setEarlier(true)}/> : <Editor {...(params.get('authoring')==='review'?{}:{startImmediately})} key={source.cardNumber} source={source} services={services} sectionId={initialSection ?? params.get('section') ?? 'CODE'} exportFile={exportAuthoringFile} onClose={onDismiss ?? (() => navigate(`/universal-language/${source.cardNumber}`))} /> : <p role="status">Opening your card draft…</p>}
  </div>;
}
