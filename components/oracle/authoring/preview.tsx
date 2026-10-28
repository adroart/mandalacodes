/** Local development harness, deliberately outside the shared application routes. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import OracleAuthoring from './OracleAuthoring';
import { manuscriptSource } from '../../../lib/oracle/authoring/source';
import { sha256 } from '../../../lib/oracle/authoring/workflow';
import manuscript from '../../../oracle/cards/01.md?raw';
const source = await manuscriptSource(1, `local-preview:${await sha256(manuscript)}`, manuscript);
const loadSource = async () => {
  // Fetch fresh Vite source so stale checks are meaningful in this development harness.
  const current = (await import(/* @vite-ignore */ `/oracle/cards/01.md?raw&t=${Date.now()}`)).default as string;
  return manuscriptSource(1, `local-preview:${await sha256(current)}`, current);
};
createRoot(document.getElementById('root')!).render(<OracleAuthoring source={source} services={{ loadSource }} />);
