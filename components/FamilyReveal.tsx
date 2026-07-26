import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDarkMode } from '../DarkModeContext';
import './oracle/eb/eb-template.css';
import './oracle/eb/oracle-foundation.css';

/* The Family reveal. Reached from the "Family" slot on the reading's bottom
   bar. This is the one page whose whole job is to explain what Mandala Codes
   IS to a visitor who arrived thinking it is only a free oracle: a circle of
   resonance, one language across many lineages, real art living in the world.
   The atlas globe is one step deeper, reached from the foot of this page.

   First-pass copy — meant to be felt and edited, not final. No em dashes, no
   italics, per house style. */

const FamilyReveal: React.FC = () => {
  const { isDarkMode } = useDarkMode();
  const palette = isDarkMode ? 'nightfall' : 'daybook';

  useEffect(() => {
    document.documentElement.classList.add('oracle-card-page');
    return () => document.documentElement.classList.remove('oracle-card-page');
  }, []);

  return (
    <div className="eb-reading family-reveal" data-palette={palette}>
      <div className="family-reveal__inner">
        <p className="family-reveal__eyebrow">One movement · Many lineages</p>
        <h1 className="family-reveal__title">The Family</h1>

        <div className="family-reveal__body">
          <p>
            Every code in this oracle is a doorway other people have walked
            through before you. Some drew it on an ordinary morning. Some carry
            it as the shape of a whole life. You are not reading alone.
          </p>
          <p>
            Mandala Codes is a circle of resonance. One universal language,
            spoken through many traditions and many people at once. When a life
            anchors to a code, a light appears in the world, and the family
            grows by one.
          </p>
          <p>
            We share dreams here, not opinions. The wisdom stays free. The art
            is real, made by hand, and it lives in homes and hands across the
            earth.
          </p>
        </div>

        <nav className="family-reveal__doors" aria-label="Ways in">
          <Link className="family-reveal__door family-reveal__door--lead" to="/atlas">
            See where we are in the world
            <span aria-hidden="true"> &rarr;</span>
          </Link>
          <Link className="family-reveal__door" to="/profile">
            Find your codes
            <span aria-hidden="true"> &rarr;</span>
          </Link>
          <Link className="family-reveal__door" to="/universal-language">
            Return to the 64
            <span aria-hidden="true"> &rarr;</span>
          </Link>
        </nav>
      </div>

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .family-reveal {
    min-height: 100vh;
    background: var(--l-bg);
    color: var(--l-1);
    display: flex;
    justify-content: center;
    padding: clamp(72px, 16vh, 160px) 24px 140px;
  }
  .family-reveal__inner { width: 100%; max-width: 620px; }
  .family-reveal__eyebrow {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent, #C99A5B);
    margin: 0 0 18px;
  }
  .family-reveal__title {
    font-family: var(--font-display);
    font-weight: 500;
    font-size: clamp(40px, 12vw, 68px);
    line-height: 1;
    color: var(--l-1);
    margin: 0 0 34px;
  }
  .family-reveal__body p {
    font-family: var(--font-reading);
    font-size: clamp(19px, 4.6vw, 23px);
    line-height: 1.5;
    color: var(--l-2, #C9BDA9);
    margin: 0 0 20px;
  }
  .family-reveal__doors {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 44px;
    border-top: 1px solid var(--l-rule, rgba(180,150,110,0.22));
    padding-top: 8px;
  }
  .family-reveal__door {
    display: block;
    padding: 16px 2px;
    font-family: var(--font-ui);
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--l-3, #9A8E79);
    text-decoration: none;
    border-bottom: 1px solid var(--l-rule, rgba(180,150,110,0.14));
    transition: color 0.25s;
  }
  .family-reveal__door:last-child { border-bottom: 0; }
  .family-reveal__door:hover { color: var(--accent, #C99A5B); }
  .family-reveal__door--lead { color: var(--l-1); font-weight: 700; }
`;

export default FamilyReveal;
