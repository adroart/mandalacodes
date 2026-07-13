export interface CardEntranceLocationState {
  entrance?: boolean;
  [key: string]: unknown;
}

export function requestsCardEntrance(search: string, state: unknown): boolean {
  const ref = new URLSearchParams(search).get('ref');
  return ref === 'qr' || ref === 'index' || (state as CardEntranceLocationState | null)?.entrance === true;
}

/**
 * Remove a ceremonial-entry marker without notifying React Router. The reading
 * keeps its local entrance state for this mount, while Back and reload see the
 * same history entry after the marker has been consumed.
 */
export function consumeCardEntranceRequest(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const ref = url.searchParams.get('ref');
  if (ref === 'qr' || ref === 'index') url.searchParams.delete('ref');

  const currentState = window.history.state;
  let nextState = currentState;
  const routerState = currentState && typeof currentState === 'object' ? currentState : null;
  const userState = routerState?.usr;
  if (userState && typeof userState === 'object' && userState.entrance === true) {
    const nextUserState = { ...userState };
    delete nextUserState.entrance;
    nextState = { ...routerState, usr: nextUserState };
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(nextState, '', nextUrl);
}
