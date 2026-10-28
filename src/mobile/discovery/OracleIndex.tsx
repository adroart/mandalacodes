import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { ALL_CARDS } from '../../../data/oracleData';
import { PROFILE_POSITIONS } from '../../../data/profilePositions';
import { useProfile } from '../../../lib/profile/context';
import { useJournal } from '../../../lib/oracle/journal';
import HexagramGlyph from '../../../components/oracle/HexagramGlyph';
import { searchCards } from './search';
import './discovery.css';

export default function OracleIndex() {
  const [query, setQuery] = useState('');
  const [personalOnly, setPersonalOnly] = useState(false);
  const { profile } = useProfile();
  const { record } = useJournal();
  const yourCodes = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const position of PROFILE_POSITIONS) {
      const gate = profile?.computed[position.key]?.gate;
      if (gate) map.set(gate, [...(map.get(gate) ?? []), position.label]);
    }
    return map;
  }, [profile]);
  const cards = useMemo(() => searchCards(ALL_CARDS, query).filter(card => !personalOnly || !profile || yourCodes.has(card.number)), [query, personalOnly, profile, yourCodes]);
  return <section className="od-page od-index" aria-labelledby="oracle-index-title">
    <header className="od-heading"><div><p className="od-eyebrow">The Universal Language</p><h1 id="oracle-index-title">Find a code</h1></div><Link className="od-text-link" to="/home">Today</Link></header>
    <div className="od-index-controls">
      <div className="od-search"><Search size={19} aria-hidden="true" /><input type="search" aria-label="Search Oracle cards" placeholder="Number, name, or keyword" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={18} aria-hidden="true" /></button>}</div>
      <div className="od-index-options">
        {profile ? <button type="button" className="od-personal-filter" aria-pressed={personalOnly} onClick={() => setPersonalOnly(!personalOnly)}>My Birthday codes</button> : <Link className="od-text-link" to="/profile">Find my codes</Link>}

      </div>
    </div>
    <p className="od-count" role="status">{cards.length} {cards.length === 1 ? 'code' : 'codes'}{personalOnly && profile ? ' in your Birthday chart' : ''}</p>
    {cards.length === 0 ? <div className="od-empty"><h2>No codes found</h2><p>Try a card number, a name, or a word such as “creativity”.</p><button type="button" onClick={() => {setQuery(''); setPersonalOnly(false);}}>Show all 64</button></div> : <div className="od-card-grid od-card-grid--symbols">
      {cards.map(card => {
        const positions = yourCodes.get(card.number);
        return <Link key={card.number} className="od-card" data-personal={positions ? 'true' : undefined} to={`/universal-language/${card.number}`} state={{entrance:true}} onClick={() => record(card.number, card.card_name)} aria-label={`Hexagram ${card.number}${positions ? `, ${positions.join(', ')}` : ''}`}>
          <div className="od-card-glyph"><HexagramGlyph gate={card.number} width={36} /><span>{card.number}</span></div>

        </Link>;
      })}
    </div>}
  </section>;
}
