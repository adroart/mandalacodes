import React from 'react';

const RELOAD_GUARD_KEY = 'mc-chunk-reload-once';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Failed to fetch|Loading chunk|ChunkLoadError/i.test(message);
}

interface State {
  hasError: boolean;
  offline: boolean;
}

/**
 * Wraps the router so a lazy-chunk failure never shows the browser's blank
 * white-screen crash. Two distinct causes produce the same React error, so
 * they get two distinct, quiet responses:
 *
 *  - A stale deploy: the visitor's tab still references a chunk hash that a
 *    later deploy removed. Reload once (sessionStorage guards against a
 *    loop) — the fresh shell has the current manifest.
 *  - Genuinely offline, asking for a route this device never cached (e.g.
 *    the Atlas globe before it's been visited on a connection): reloading
 *    won't help, so say so in one on-brand sentence instead of retrying.
 */
class ChunkErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, offline: false };

  static getDerivedStateFromError(error: unknown): Partial<State> | null {
    if (!isChunkLoadError(error)) return null;
    return { hasError: true, offline: typeof navigator !== 'undefined' && !navigator.onLine };
  }

  componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    window.location.reload();
  }

  render() {
    if (this.state.hasError && this.state.offline) {
      return (
        <div
          style={{
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: 24,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-reading)',
              fontSize: 16,
              color: 'var(--color-wood-700)',
              maxWidth: 380,
            }}
          >
            This part of the oracle needs a connection — it hasn't been opened on this device yet.
          </p>
        </div>
      );
    }
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default ChunkErrorBoundary;
