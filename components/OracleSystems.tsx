import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const SECTIONS = [
  {
    id: 'iching',
    label: 'I Ching',
    subtitle: 'The Book of Changes',
    intro:
      'The earliest of the three, with a written core from the first millennium BCE. Sixty-four hexagrams, each naming a pattern in the present moment.',
  },
  {
    id: 'genekeys',
    label: 'Gene Keys',
    subtitle: 'A contemplative path',
    intro:
      'A modern synthesis. Each of the sixty-four keys names a Shadow you move through, a Gift that opens, and a Siddhi held at the highest expression. Less a tool for divination than a practice of attention.',
  },
  {
    id: 'humandesign',
    label: 'Human Design',
    subtitle: 'A map of energy',
    intro:
      'A schematic of how energy moves through a body. Each of the sixty-four gates carries a quality. Channels show how those qualities connect, circuits show the larger pattern they belong to.',
  },
] as const;

const OracleSystems: React.FC = () => {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const id = hash.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [hash]);

  return (
    <article className="oracle-systems bg-page-paper text-ink min-h-screen">
      <div className="max-w-2xl mx-auto px-5 sm:px-7 pb-20 sm:pb-28 pt-[calc(var(--nav-height)+3rem)] sm:pt-[calc(var(--nav-height)+4rem)]">
        <p className="font-label text-[11px] uppercase tracking-[0.32em] text-accent mb-6">
          The Three Systems
        </p>
        <h1 className="font-display text-[34px] sm:text-[44px] leading-[1.05] tracking-[-0.01em] text-ink mb-6 sm:mb-8">
          A lineage of changes
        </h1>
        <p className="font-reading text-[18px] sm:text-[20px] text-ink-soft leading-[1.55] sm:leading-[1.5] max-w-prose">
          The Universal Language reads through three lenses, three vocabularies for the same shape of energy. The I Ching arrives from ancient China. Human Design emerged in 1987; the Gene Keys began in 2002, drawing on both earlier systems. None of this is mine. The cards are an offering of gratitude.
        </p>

        <p className="font-reading text-[14px] tracking-[0.015em] text-ink-faint leading-[1.6] mt-8 max-w-prose">
          {/* DRAFT — prose to be refined by Adrian */}
          The text below is a working draft. The histories, the names, the lineages each deserve more care than a placeholder can give. Read it as a sketch.
        </p>

        <nav aria-label="Explore systems" className="mt-12 sm:mt-14 flex flex-wrap gap-x-6 gap-y-2 border-y border-line py-5">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="font-label text-[11px] uppercase tracking-[0.28em] text-ink-muted hover:text-link transition-colors"
            >
              {s.label}
            </a>
          ))}
        </nav>

        {/* ── I Ching ───────────────────────────────────────────────────── */}
        <section id="iching" className="pt-16 sm:pt-20 scroll-mt-20">
          <p className="font-label text-[10px] uppercase tracking-[0.3em] text-accent mb-4">
            One · I Ching
          </p>
          <h2 className="font-display text-[28px] sm:text-[34px] leading-[1.1] tracking-[-0.005em] text-ink">
            The Book of Changes
          </h2>
          <p className="font-reading text-[15px] tracking-[0.015em] text-ink-faint mt-2">
            attributed to Fu Xi, King Wen, the Duke of Zhou, and Confucius
          </p>

          <div className="space-y-5 mt-8 font-reading text-[16px] sm:text-[17px] text-wood-800 leading-[1.7]">
            <p>
              The I Ching is an early Chinese divination classic, with a written core dating to the first millennium BCE. Tradition traces its eight trigrams to the legendary Fu Xi. The symbols came to encode a way of reading change as it moves through any moment.
            </p>
            <p>
              In traditional accounts, King Wen of Zhou ordered the sixty-four hexagrams and assigned each its name. His son, the Duke of Zhou, is credited with the line statements. Later tradition attributes the Ten Wings to Confucius and his school. These commentaries helped turn the oracle into a philosophical text. Across two thousand years more, scholars and mystics returned to those sixty-four images, finding in them whatever the moment required.
            </p>
            <p>
              James Legge published an English translation in 1882. Richard Wilhelm's influential German edition appeared in 1924, developed with the Chinese scholar Lao Naixuan. Cary F. Baynes translated Wilhelm's work into English in 1950, with a foreword by Carl Jung. That edition shaped many Western readers' encounters with the I Ching.
            </p>

          </div>

          <div className="mt-10 pt-6 border-t border-line">
            <p className="font-label text-[10px] uppercase tracking-[0.28em] text-accent mb-3">
              In gratitude to
            </p>
            <p className="font-reading text-[18px] text-ink">
              Richard Wilhelm and Cary F. Baynes
            </p>
            <p className="font-reading text-[15px] text-ink-muted leading-[1.6] mt-1.5 max-w-prose">
              Whose edition, with Jung's foreword, has shaped many English-language readers' encounters with the I Ching.
            </p>
          </div>
        </section>

        {/* ── Gene Keys ─────────────────────────────────────────────────── */}
        <section id="genekeys" className="pt-20 sm:pt-24 scroll-mt-20">
          <p className="font-label text-[10px] uppercase tracking-[0.3em] text-accent mb-4">
            Two · Gene Keys
          </p>
          <h2 className="font-display text-[28px] sm:text-[34px] leading-[1.1] tracking-[-0.005em] text-ink">
            The contemplative path
          </h2>
          <p className="font-reading text-[15px] tracking-[0.015em] text-ink-faint mt-2">
            transmitted by Richard Rudd, 2002 onward
          </p>

          <div className="space-y-5 mt-8 font-reading text-[16px] sm:text-[17px] text-wood-800 leading-[1.7]">
            <p>
              The Gene Keys are the youngest of the three systems. Richard Rudd began conceiving and writing the work in 2002, drawing on his experience with Human Design and the I Ching. The book first appeared in 2009; a later Watkins edition followed in 2013.
            </p>
            <p>
              Where the I Ching reads the moment and Human Design reads the body, the Gene Keys read a person across a lifetime. Each of the sixty-four keys names three frequencies of the same archetype: the Shadow, a habitual pattern under stress; the Gift, what opens when the Shadow is met with awareness; and the Siddhi, the highest expression, often glimpsed before it is lived. The system is offered not as something to know but as something to contemplate, slowly, until it begins to read you back.
            </p>
            <p>
              The Gene Keys pair sixty-four archetypes with the sixty-four hexagrams of the I Ching and use the genetic code as a contemplative analogy. Rudd's teaching names a Shadow, Gift, and Siddhi for each key, holding the three as one continuous spectrum.
            </p>

          </div>

          <div className="mt-10 pt-6 border-t border-line">
            <p className="font-label text-[10px] uppercase tracking-[0.28em] text-accent mb-3">
              In gratitude to
            </p>
            <p className="font-reading text-[18px] text-ink">
              Richard Rudd
            </p>
            <p className="font-reading text-[15px] text-ink-muted leading-[1.6] mt-1.5 max-w-prose">
              Whose synthesis offers the I Ching, Human Design, and the wisdom traditions back to a contemporary reader as a contemplative life.
            </p>
            <p className="font-reading text-[14px] text-ink-faint mt-3">
              <a
                href="https://genekeys.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-wood-300 underline-offset-[3px] hover:text-link hover:decoration-bronze-500 transition-colors"
              >
                genekeys.com
              </a>
            </p>
          </div>
        </section>

        {/* ── Human Design ──────────────────────────────────────────────── */}
        <section id="humandesign" className="pt-20 sm:pt-24 scroll-mt-20">
          <p className="font-label text-[10px] uppercase tracking-[0.3em] text-accent mb-4">
            Three · Human Design
          </p>
          <h2 className="font-display text-[28px] sm:text-[34px] leading-[1.1] tracking-[-0.005em] text-ink">
            A map of energy
          </h2>
          <p className="font-reading text-[15px] tracking-[0.015em] text-ink-faint mt-2">
            received by Ra Uru Hu, Ibiza, January 1987
          </p>

          <div className="space-y-5 mt-8 font-reading text-[16px] sm:text-[17px] text-wood-800 leading-[1.7]">
            <p>
              Human Design enters the world through Robert Allan Krakower, who later took the name Ra Uru Hu. In January of 1987, on the island of Ibiza, he reported an eight-day-and-night encounter with a voice he called the Voice. He described the system that followed as a synthesis of the I Ching, Western astrology, the Hindu chakra system, the Kabbalistic Tree of Life, and ideas about neutrinos, woven into a chart called the bodygraph.
            </p>
            <p>
              In Human Design, the bodygraph names which centres in a person are defined and which are open. It locates sixty-four gates against the calendar of the sun and the moment of birth. The system gives the reader a Type, Strategy, and Authority as guidance for making decisions in alignment with their design.
            </p>
            <p>
              Ra spent the rest of his life teaching the system, often in long, recorded lectures. He died in 2011. His teachings have since been carried forward by his students through the International Human Design School and the many independent teachers and analysts working today.
            </p>

          </div>

          <div className="mt-10 pt-6 border-t border-line">
            <p className="font-label text-[10px] uppercase tracking-[0.28em] text-accent mb-3">
              In gratitude to
            </p>
            <p className="font-reading text-[18px] text-ink">
              Ra Uru Hu
            </p>
            <p className="font-reading text-[15px] text-ink-muted leading-[1.6] mt-1.5 max-w-prose">
              Whose transmission gave the West a map of energetic design and a vocabulary for living in alignment with one's own nature.
            </p>
          </div>
        </section>

        {/* ── Closing ───────────────────────────────────────────────────── */}
        <section className="pt-20 sm:pt-24 mt-20 border-t border-line">
          <p className="font-reading text-[17px] sm:text-[18px] text-ink-soft leading-[1.7] max-w-prose">
            The Universal Language Oracle does not improve on these systems. It carries them, sixty-four cards holding patterns that have moved from the I Ching into newer traditions. Whatever clarity the cards offer belongs to the lineages that arrived first.
          </p>

          <Link
            to="/universal-language"
            className="inline-block mt-10 font-label text-[11px] uppercase tracking-[0.32em] text-link hover:text-bronze-900 transition-colors"
          >
            Return to the Oracle <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>
    </article>
  );
};

export default OracleSystems;
