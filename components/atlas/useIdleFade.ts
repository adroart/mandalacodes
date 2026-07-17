/**
 * Idle-fade controller for the immersive Atlas chrome.
 *
 * Returns `idle` (true after `delay` ms of no pointer/scroll/key activity) so
 * the corner controls can ease to a low opacity and leave only the turning
 * world on screen. Any interaction wakes them. Honors prefers-reduced-motion
 * by never engaging (chrome stays visible) so nothing silently disappears for
 * users who asked for less motion.
 */

import { useEffect, useRef, useState } from 'react';

export function useIdleFade(delay = 4000): boolean {
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // keep chrome visible, never fade

    const wake = () => {
      setIdle(false);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setIdle(true), delay);
    };

    const events: (keyof WindowEventMap)[] = [
      'pointermove',
      'pointerdown',
      'wheel',
      'keydown',
      'touchstart',
      'focusin', // keyboard focus entering any control restores chrome
    ];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    wake(); // start the countdown

    return () => {
      events.forEach((e) => window.removeEventListener(e, wake));
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [delay]);

  return idle;
}
