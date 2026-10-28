import React, { useEffect, useRef, useState } from 'react';
import { Headphones, Pause, Play } from 'lucide-react';
import { boundedSeek, createAudioSleepTimer, formatAudioTime, publishedRecordingSource, type PublishedOracleRecording, type SleepMinutes } from './playback';
import './listening.css';

export type { PublishedOracleRecording } from './playback';
export interface OracleAudioPlayerProps {
  cardNumber: number;
  recording?: PublishedOracleRecording | null;
}

/** No discovery request or media download occurs here. The host supplies an approved publication. */
export default function OracleAudioPlayer({ cardNumber, recording = null }: OracleAudioPlayerProps) {
  const source = publishedRecordingSource(recording, cardNumber);
  // A changed card/publication tears down the old audio and its timer before showing the next.
  return <ListeningRecording key={`${cardNumber}:${recording?.id ?? ''}:${source ?? ''}`} cardNumber={cardNumber} recording={recording} source={source} />;
}
function ListeningRecording({ cardNumber, recording, source }: OracleAudioPlayerProps & {source: string | null}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const active = useRef(true);
  const playAttempt = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState('');
  const [sleepMinutes, setSleepMinutes] = useState<0 | SleepMinutes>(0);
  const sleepRef = useRef<ReturnType<typeof createAudioSleepTimer> | null>(null);
  if (!sleepRef.current) sleepRef.current = createAudioSleepTimer(() => {
    audioRef.current?.pause();
    if (active.current) { setSleepMinutes(0); setMessage('Sleep timer finished.'); }
  });
  useEffect(() => {
    active.current = true;
    const audio = audioRef.current;
    const check = () => sleepRef.current?.check();
    document.addEventListener('visibilitychange', check);
    return () => {
      active.current = false;
      playAttempt.current += 1;
      document.removeEventListener('visibilitychange', check);
      sleepRef.current?.cancel();
      audio?.pause();
      audio?.removeAttribute('src');
      audio?.load();
    };
  }, []);
  const reportPlaybackFailure = () => {
    if (!active.current) return;
    setPlaying(false); setLoading(false);
    setMessage(navigator.onLine === false ? 'Connect to play this recording.' : 'This recording could not be played. Try again.');
  };
  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !source) return;
    if (loading || !audio.paused) { playAttempt.current += 1; audio.pause(); setLoading(false); return; }
    const attempt = ++playAttempt.current;
    setMessage(''); setLoading(true);
    try {
      // Deliberately attach src only after Play, even when the panel is expanded.
      if (!audio.getAttribute('src')) { audio.src = source; audio.load(); }
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
      if (active.current && attempt === playAttempt.current) setLoading(false);
    } catch { if (attempt === playAttempt.current) reportPlaybackFailure(); }
  };
  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = boundedSeek(value, duration);
    try { audio.currentTime = next; setPosition(next); } catch { /* Media may still be loading. */ }
  };
  return <details className="oracle-listening" onToggle={event => {
    if (!event.currentTarget.open) { playAttempt.current += 1; audioRef.current?.pause(); setLoading(false); sleepRef.current?.cancel(); setSleepMinutes(0); }
  }}>
    <summary><Headphones size={18} aria-hidden="true" /><span>Listen</span>{playing && <span className="oracle-listening-state">Playing</span>}</summary>
    {!source ? <p className="oracle-listening-empty">No listening recording has been published for this card yet.</p> : <div className="oracle-listening-content">
      <p className="oracle-listening-title">{recording?.title}</p>
      <audio ref={audioRef} preload="none" aria-label={`Recording for card ${cardNumber}`} onLoadedMetadata={event => { const value = event.currentTarget.duration; setDuration(Number.isFinite(value) ? value : 0); }} onDurationChange={event => { const value = event.currentTarget.duration; setDuration(Number.isFinite(value) ? value : 0); }} onTimeUpdate={event => setPosition(event.currentTarget.currentTime)} onPlaying={() => { setPlaying(true); setLoading(false); }} onPause={() => { setPlaying(false); setLoading(false); }} onEnded={() => { setPlaying(false); sleepRef.current?.cancel(); setSleepMinutes(0); }} onError={reportPlaybackFailure} />
      <div className="oracle-listening-playback"><button type="button" className="oracle-listening-play" onClick={() => void toggle()} aria-label={loading ? 'Cancel loading recording' : playing ? 'Pause recording' : 'Play recording'}>{playing || loading ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}</button><div className="oracle-listening-progress"><input type="range" min={0} max={duration || 1} step={1} value={Math.min(position, duration || 0)} disabled={duration <= 0} aria-label="Recording position" aria-valuetext={`${formatAudioTime(position)} of ${formatAudioTime(duration)}`} onChange={event => seek(Number(event.target.value))} /><div className="oracle-listening-times"><span>{formatAudioTime(position)}</span><span>{duration ? formatAudioTime(duration) : 'Not loaded'}</span></div></div></div>
      <label className="oracle-listening-sleep"><span>Sleep timer</span><select value={sleepMinutes} onChange={event => { const minutes = Number(event.target.value) as 0 | SleepMinutes; setSleepMinutes(minutes); setMessage(''); if (minutes) sleepRef.current?.arm(minutes); else sleepRef.current?.cancel(); }}><option value={0}>Off</option><option value={5}>5 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option></select></label>
      {message && <p className="oracle-listening-message" role="status">{message}</p>}
    </div>}
  </details>;
}
