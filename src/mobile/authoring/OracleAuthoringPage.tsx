import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import OracleAuthoring from '../../../components/oracle/authoring/OracleAuthoring';
import { manuscriptSource } from '../../../lib/oracle/authoring/source';
import { sha256 } from '../../../lib/oracle/authoring/workflow';
import type { SourceSnapshot } from '../../../lib/oracle/authoring/types';
import { exportAuthoringFile } from './nativeExport';
import './authoring-app.css';
const manuscripts = import.meta.glob('../../../oracle/cards/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
async function bundledSource(number: number) {
  const loader = manuscripts[`../../../oracle/cards/${String(number).padStart(2, '0')}.md`];
  if (!loader || !Number.isInteger(number) || number < 1 || number > 64) throw new Error('Choose a card from the Oracle index.');
  const markdown = await loader();
  return manuscriptSource(number, `app-manuscript:${await sha256(markdown)}`, markdown);
}
const services = { loadSource: bundledSource };
export default function OracleAuthoringPage() {
  const { number } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [source, setSource] = useState<SourceSnapshot | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let alive = true; setSource(null); setError(''); bundledSource(Number(number)).then(s => { if (alive) setSource(s); }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [number]);
  return <div className="oracle-authoring-page">
    {error ? <div role="alert"><p>{error}</p><Link to="/universal-language">Open the index</Link></div> : source ? <OracleAuthoring key={source.cardNumber} source={source} services={services} autoOpen visibleSectionId={params.get('section') ?? 'CODE'} exportFile={exportAuthoringFile} onClose={() => navigate(`/universal-language/${source.cardNumber}`)} /> : <p role="status">Opening your card draft…</p>}
  </div>;
}
