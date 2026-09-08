import React from 'react';

const RELOAD_GUARD_KEY = 'mc-chunk-reload-once';

/**
 * Whether a failure is one this boundary knows how to answer: a chunk or a
 * fetch that never arrived. Exported so code that catches such a failure
 * itself can check before rethrowing, and so nothing throws an error at this
 * boundary that it would decline and pass on as a blank screen.
 */
export function isChunkLoadError(error: unknown): boolean {
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
 *    loop). The fresh shell has the current manifest.
 *  - Genuinely offline, asking for a route this device never cached (e.g.
 *    the Atlas globe before it's been visited on a connection): reloading
 *    won't help, so say so in one on-brand sentence instead of retrying.
 *
 * The card reading rethrows its own failed prose load here (see
 * components/oracle/reading/CardReadingData.tsx) rather than growing a second
 * error style: a card's words are a chunk like any other, and a visitor who
 * scanned a plaque and lost signal is the same visitor in the same situation.
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

  /* Retry does not reload the page: it clears the boundary's own error state
     so React remounts the children fresh, which repeats the failed fetch
     (CardReadingData's prose load, or a lazy route's own import) on its own.
     Signal can return between one look at this screen and the next tap. */
  private retry = () => {
    this.setState({ hasError: false, offline: false });
  };

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
          <div style={{ maxWidth: 380 }}>
            <p
              style={{
                fontFamily: 'var(--font-reading)',
                fontSize: 16,
                color: 'var(--color-wood-700)',
                margin: 0,
              }}
            >
              This part of the oracle needs a connection: it has not been opened on this device
              yet, but the cards you have already opened are still here.
            </p>
            <button
              type="button"
              onClick={this.retry}
              style={{
                marginTop: 18,
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                fontFamily: 'var(--font-ui)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-bronze-600)',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default ChunkErrorBoundary;
