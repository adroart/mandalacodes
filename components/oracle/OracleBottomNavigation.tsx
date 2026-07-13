import React from 'react';
import { Link } from 'react-router-dom';
import type { OracleCard } from '../../data/oracleData';
import { HexagramSVG } from './HexagramGlyph';
import './oracle-bottom-navigation.css';

interface Props { current:OracleCard; previous:OracleCard|null; next:OracleCard|null; palette:'daybook'|'nightfall'; }
const Neighbor:React.FC<{card:OracleCard;direction:'previous'|'next'}> = ({card,direction}) => (
  <Link className={`oracle-bottom-nav__neighbor oracle-bottom-nav__neighbor--${direction}`} data-neighbor={direction}
    to={`/universal-language/${card.number}`} state={{quiet:true}}
    aria-label={`${direction === 'previous' ? 'Previous' : 'Next'} hexagram: Code ${card.number}, ${card.card_name}`}>
    <span className="oracle-bottom-nav__neighbor-copy">
      <span className="oracle-bottom-nav__code">Code {card.number}</span>
      <span className="oracle-bottom-nav__name">{card.card_name}</span>
    </span>
  </Link>
);

const OracleBottomNavigation:React.FC<Props> = ({current,previous,next,palette}) => (
  <nav className="eb-reading oracle-bottom-nav" data-palette={palette} aria-label="Hexagram navigation">
    <div className="oracle-bottom-nav__inner">
      <div className="oracle-bottom-nav__edge">{previous && <Neighbor card={previous} direction="previous" />}</div>
      <div className="oracle-bottom-nav__constellation">
        {previous ? <Link className="oracle-bottom-nav__glyph-link" to={`/universal-language/${previous.number}`} state={{quiet:true}} aria-label={`Previous glyph: Code ${previous.number}, ${previous.card_name}`}><HexagramSVG upper={previous.iching.upper_trigram.symbol} lower={previous.iching.lower_trigram.symbol} color="var(--accent)" width={25} /></Link> : <span className="oracle-bottom-nav__glyph-link" />}
        <Link className="oracle-bottom-nav__current" data-current-hexagram to="/universal-language" aria-label="All 64 hexagrams"><span className="oracle-bottom-nav__number">{current.number}</span><span className="oracle-bottom-nav__all">All 64</span></Link>
        {next ? <Link className="oracle-bottom-nav__glyph-link" to={`/universal-language/${next.number}`} state={{quiet:true}} aria-label={`Next glyph: Code ${next.number}, ${next.card_name}`}><HexagramSVG upper={next.iching.upper_trigram.symbol} lower={next.iching.lower_trigram.symbol} color="var(--accent)" width={25} /></Link> : <span className="oracle-bottom-nav__glyph-link" />}
      </div>
      <div className="oracle-bottom-nav__edge oracle-bottom-nav__edge--next">{next && <Neighbor card={next} direction="next" />}</div>
    </div>
  </nav>
);
export default OracleBottomNavigation;
