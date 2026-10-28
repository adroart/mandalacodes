import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, Copy } from 'lucide-react';
import { CARD_BY_NUMBER } from '../../../data/oracleData';
import { addFollowUp, exportJournalBackup, journalMarkdown, saveReflection, type ReadingEntry } from './store';
import { useReadingJournal } from './useReadingJournal';
import './journal.css';

const dateLabel = (timestamp: number) => new Date(timestamp).toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'});
const nameFor = (number: number) => CARD_BY_NUMBER.get(number)?.card_name ?? `Card ${number}`;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Your writing could not be saved.';
function ReadingDetail({ entry }: { entry: ReadingEntry }) {
  const [reflection, setReflection] = useState(entry.reflection);
  const [followUp, setFollowUp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const persist = (text: string) => {
    try { saveReflection(entry.id, text); setMessage('Saved on this phone'); setError(''); }
    catch (failure) { setError(errorText(failure)); setMessage(''); }
  };
  return <article className="oracle-journal-detail">
    <Link to="/journal" className="oracle-journal-back"><ArrowLeft size={18} aria-hidden="true" /> All readings</Link>
    <header className="oracle-journal-reading-header">
      <img src={`/oracle-art/${entry.cardNumber}.webp`} alt="" />
      <div><p className="oracle-journal-kicker">{dateLabel(entry.createdAt)} · Card {entry.cardNumber}</p><h1>{nameFor(entry.cardNumber)}</h1>
        <Link to={`/universal-language/${entry.cardNumber}`} state={{oracleCast:entry.cast}}>Read the card <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
    </header>
    {entry.question && <section className="oracle-journal-question"><h2>Your question</h2><p>{entry.question}</p></section>}
    {entry.cast && <div className="oracle-journal-cast">
      <span>{entry.cast.movingPositions.length ? `Changing ${entry.cast.movingPositions.length === 1 ? 'line' : 'lines'} ${entry.cast.movingPositions.join(', ')}` : 'No changing lines'}</span>
      {entry.cast.changedNumber && <Link to={`/universal-language/${entry.cast.changedNumber}`}>Becoming {entry.cast.changedNumber} <ArrowUpRight size={15} aria-hidden="true" /></Link>}
    </div>}
    <section className="oracle-journal-writing">
      <label htmlFor="journal-reflection">Your reflection</label>
      <p>What stands out? What does this bring into focus?</p>
      <textarea id="journal-reflection" value={reflection} rows={6} placeholder="Begin with what you notice…" onChange={event => { const text = event.target.value; setReflection(text); persist(text); }} />
      {error && <div className="oracle-journal-error" role="alert"><p>{error}</p><button onClick={() => persist(reflection)}>Try saving again</button></div>}
      <p className="oracle-journal-status" role="status">{message || 'Your reflection saves as you write.'}</p>
    </section>
    <section className="oracle-journal-followups">
      <h2>Looking back</h2><p className="oracle-journal-secondary">Return later to note what unfolded.</p>
      {entry.followUps.map(item => <article key={item.id}><time dateTime={new Date(item.createdAt).toISOString()}>{dateLabel(item.createdAt)}</time><p>{item.text}</p></article>)}
      <label htmlFor="journal-followup" className="oracle-journal-sr">Add a follow-up</label>
      <textarea id="journal-followup" value={followUp} rows={3} placeholder="What happened since this reading?" onChange={event => setFollowUp(event.target.value)} />
      <button className="oracle-journal-primary" disabled={!followUp.trim()} onClick={() => {
        try { addFollowUp(entry.id, followUp); setFollowUp(''); setMessage('Follow-up saved on this phone'); setError(''); }
        catch (failure) { setError(errorText(failure)); }
      }}>Add follow-up</button>
    </section>
  </article>;
}
export default function OracleJournal() {
  const { entries, error, refresh } = useReadingJournal();
  const [params] = useSearchParams();
  const selected = params.get('entry');
  const entry = entries.find(item => item.id === selected);
  const [query, setQuery] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const matches = entries.filter(item => `${item.cardNumber} ${nameFor(item.cardNumber)} ${item.question} ${item.reflection} ${item.followUps.map(f => f.text).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const copyExport = async (format: 'markdown' | 'json') => {
    try {
      const contents = format === 'json' ? exportJournalBackup() : journalMarkdown(entries, nameFor);
      await navigator.clipboard.writeText(contents);
      setExportMessage(format === 'json' ? 'Journal backup copied. Paste it into a file to keep a separate copy.' : 'Journal copied as Markdown. Paste it into Notes or a document.');
    } catch (failure) { setExportMessage(failure instanceof Error ? failure.message : 'Could not copy your journal. Try again.'); }
  };
  return <div className="oracle-journal-page">
    {entry ? <ReadingDetail key={entry.id} entry={entry} /> : <>
      <header className="oracle-journal-title"><div><p className="oracle-journal-kicker">Your practice</p><h1>Reading journal</h1></div><BookOpen size={27} aria-hidden="true" /></header>
      <Link className="oracle-journal-back" to="/authoring/1">Voice drafts</Link>
      <p className="oracle-journal-intro">Your questions, reflections, and what unfolds.</p>
      {selected && !error && <p role="status">This reading is no longer available here. Choose one below.</p>}
      {error && <div className="oracle-journal-error" role="alert"><p>{error}</p><button onClick={refresh}>Try again</button><button onClick={() => void copyExport('json')}>Copy existing backup</button></div>}
      {!error && entries.length === 0 && <div className="oracle-journal-empty"><h2>A place to return to</h2><p>Open a card from a new draw to begin your journal. Add what you notice, then come back to see what has changed.</p><Link className="oracle-journal-primary" to="/draw" state={{returnTo:'/journal'}}>Draw a card</Link></div>}
      {entries.length > 0 && <>
        <label className="oracle-journal-sr" htmlFor="journal-search">Search your journal</label>
        <input id="journal-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a card, question, or reflection" />
        <div className="oracle-journal-list">
          {matches.map(item => <Link key={item.id} to={`/journal?entry=${encodeURIComponent(item.id)}`} className="oracle-journal-row">
            <img src={`/oracle-art/${item.cardNumber}.webp`} alt="" loading="lazy" />
            <div><p className="oracle-journal-kicker">{dateLabel(item.createdAt)} · {item.cardNumber}</p><h2>{nameFor(item.cardNumber)}</h2><p>{item.question || item.reflection || 'Add your reflection'}</p></div><ChevronRight size={19} aria-hidden="true" />
          </Link>)}
          {matches.length === 0 && <p>No readings match this search.</p>}
        </div>
        <details className="oracle-journal-export"><summary>Keep a copy</summary><p>These readings are saved on this phone. Copy them before changing devices.</p><button onClick={() => void copyExport('markdown')}><Copy size={16} aria-hidden="true" /> Copy as Markdown</button><button onClick={() => void copyExport('json')}><Copy size={16} aria-hidden="true" /> Copy full backup</button></details>
      </>}
    </>}
    {exportMessage && <p className="oracle-journal-status" role="status">{exportMessage}</p>}
  </div>;
}
