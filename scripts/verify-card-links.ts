/** Explicit local checkout input; never fetches data or contacts production. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FULL_ARCHIVE } from '../data/mockData';
import { loadCorpus } from '../mcp/oracle-server/src/corpus';
import { artDesignHref } from '../lib/atlas/artSite';
import { onRequest as mandalaQR } from '../functions/qr/[number].js';
import { verifyCardLinkContract } from './card-link-contract';

const artistRootArg = process.argv[2];
if (!artistRootArg || process.argv.length !== 3) {
  console.error('Usage: npm run verify:card-links -- /absolute/path/to/Adrian-Website');
  process.exit(1);
}
const mandalaRoot = fileURLToPath(new URL('../', import.meta.url));
const artistRoot = resolve(artistRootArg);
const fromArtist = (path: string) => import(pathToFileURL(resolve(artistRoot, path)).href);
const [{ FULL_ARCHIVE: artistArtworks }, navigation, { onRequest: artistQR }] = await Promise.all([
  fromArtist('data/mockData.ts'),
  fromArtist('utils/universalLanguage.ts'),
  fromArtist('functions/qr/[number].js'),
]);
await verifyCardLinkContract({
  mandalaArtworks: FULL_ARCHIVE,
  artistArtworks,
  sourceCards: await loadCorpus(),
  hostedCards: JSON.parse(await readFile(resolve(mandalaRoot, 'data/oracle-corpus.json'), 'utf8')).cards,
  artistCardNumber: navigation.ulCardNumber,
  companionCardUrl: navigation.companionCardUrl,
  contextualCardReturn: navigation.contextualCardReturn,
  artDesignHref,
  mandalaQR: number => mandalaQR({ params: { number } }),
  artistQR: number => artistQR({ params: { number }, request: new Request(`https://adrianrasmussen.com/qr/${number}`) }),
  mandalaRedirects: await readFile(resolve(mandalaRoot, 'public/_redirects'), 'utf8'),
});
console.log('PASS: all 64 source/hosted cards, artwork IDs/images, artwork round trips, and both QR destinations agree.');
