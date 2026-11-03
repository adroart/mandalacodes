import React, { useState } from 'react';
import type { ReflectionSegment } from '../../types/oracleReflection';
import { decideBetterTranscript } from '../../lib/oracle/reflectionApi';

type Choice = 'accept' | 'keep' | 'defer';
interface Props { segment: ReflectionSegment; onSegment: (segment: ReflectionSegment) => void; onMessage: (message: string) => void }

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'accept', label: 'Use the Mac version' },
  { value: 'keep', label: 'Keep mine' },
  { value: 'defer', label: 'Decide later' },
];

/**
 * What the Mac's better transcript means for this recording: already in place (the first draft is kept),
 * waiting for a decision (Adrian edited the words, so nothing is replaced for him), or settled.
 */
export default function BetterTranscriptNote({ segment, onSegment, onMessage }: Props) {
  const better = segment.betterTranscript;
  const [choices, setChoices] = useState<Record<string, Choice>>(() => better?.comparison?.decisions ?? {});
  const [busy, setBusy] = useState(false);
  if (!better) return null;

  const draft = better.draft && <details className="reflection-better__draft">
    <summary>First draft from the phone</summary>
    <p>{better.draft.text}</p>
  </details>;

  if (better.state !== 'reconcile' || !better.comparison) {
    return <div className="reflection-better" data-state={better.state}>
      <p className="reflection-better__line">{better.state === 'applied'
        ? 'Improved on your Mac. The first draft is kept.'
        : 'Compared with the version from your Mac. Your choices are saved.'}</p>
      {draft}
    </div>;
  }

  const { changes } = better.comparison;
  const answered = changes.filter((change) => choices[change.id]).length;
  const send = async () => {
    setBusy(true);
    try {
      const result = await decideBetterTranscript(segment.id, choices);
      onSegment(result.segment);
      onMessage(result.done ? 'Transcript updated with your choices.' : 'Choices saved. Some changes are still waiting for you.');
    } catch { onMessage('Your choices were not saved. Try again.'); }
    finally { setBusy(false); }
  };

  return <section className="reflection-better is-open" data-state="reconcile" aria-label="Better transcript from your Mac">
    <p className="reflection-better__line">Your Mac made a better transcript. You already edited this one, so nothing is replaced until you choose.</p>
    {changes.map((change, index) => <div className="reflection-better__change" key={change.id}>
      <p className="reflection-better__label">Change {index + 1} of {changes.length}</p>
      <p className="reflection-better__yours"><span>Yours</span>{change.before.replace(/\n$/, '') || 'Nothing here'}</p>
      <p className="reflection-better__theirs"><span>From the Mac</span>{change.after.replace(/\n$/, '') || 'Nothing here'}</p>
      <div className="reflection-better__choices" role="group" aria-label={`Choose for change ${index + 1}`}>
        {CHOICES.map(({ value, label }) => <button key={value} type="button" aria-pressed={choices[change.id] === value}
          onClick={() => setChoices((current) => ({ ...current, [change.id]: value }))}>{label}</button>)}
      </div>
    </div>)}
    <button className="reflection-better__apply" type="button" disabled={busy || answered === 0} onClick={() => void send()}>
      {answered === changes.length ? 'Apply my choices' : `Save ${answered} of ${changes.length} choices`}
    </button>
    {draft}
  </section>;
}
