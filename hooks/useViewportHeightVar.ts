import { useEffect } from 'react';

/* Publishes the browser's real visible height as `--app-vh` on the document
   root, for the app-shell layouts that must fill the screen exactly and pin a
   bar to its bottom edge.

   Why not just `100dvh`. The unit is the right idea and stays the fallback, but
   iOS resolves it lazily: Safari and the in-app browser (the one a QR scan
   opens) grow and shrink the viewport as their toolbar collapses and expands,
   and the value a page was laid out with can lag a toolbar state behind. A
   shell sized from the stale value stops short of the bottom, which is what
   lifted the reading's bottom bar off the floor and left a dead band under it.

   `window.innerHeight` is the layout viewport, which the toolbar transition
   updates directly. It is deliberately NOT `visualViewport.height`: that one
   also shrinks for the on-screen keyboard and for pinch-zoom, and the shell
   should hold its size through both.

   The variable is refcounted rather than owned by one component, so a second
   shell mounting during a route change cannot clear it out from under the
   first. */
let holders = 0;

export function useViewportHeightVar(): void {
  useEffect(() => {
    holders += 1;
    const root = document.documentElement;
    const update = () => {
      const height = window.innerHeight;
      if (height > 0) root.style.setProperty('--app-vh', `${height}px`);
    };
    update();

    const viewport = window.visualViewport;
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    /* The toolbar animation reports through the visual viewport before the
       window resize settles, so both are heard. */
    viewport?.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      viewport?.removeEventListener('resize', update);
      holders -= 1;
      if (holders === 0) root.style.removeProperty('--app-vh');
    };
  }, []);
}

export default useViewportHeightVar;
