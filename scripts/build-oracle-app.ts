import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/media';
import { mkdir, cp, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const widget = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/build-oracle-widget.ts'], { stdio: 'inherit' });
if (widget.status !== 0) process.exit(widget.status ?? 1);
const staging = path.join(root, '.oracle-public');
await mkdir(path.join(staging, 'oracle-art'), { recursive: true });
for (const item of ['fonts', 'oracle', 'favicon.svg', 'data/cities-index.json']) {
  await mkdir(path.dirname(path.join(staging, item)), { recursive: true });
  await cp(path.join(root, 'public', item), path.join(staging, item), { recursive: true });
}
const cards = FULL_ARCHIVE.filter(a => a.series === 'Universal Language' && Number.isInteger(a.cardNumber) && a.cardNumber! >= 1 && a.cardNumber! <= 64);
if (new Set(cards.map(a => a.cardNumber)).size !== 64) throw new Error('A complete 64-card artwork registry is required.');
const manifest: { number: number; source: string; bytes: number }[] = [];
// Four downloads at a time, with a reusable local cache. Never hit media in a loop of tests.
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < cards.length) {
    const card = cards[cursor++];
    const source = `https://mandalacodes.com${img(card.coverImage, { w: 1100, h: 1100, crop: 'fill', gravity: 'center', format: 'webp', backgroundRemoval: card.cardNumber === 22 })}`;
    const file = path.join(staging, 'oracle-art', `${card.cardNumber}.webp`);
    const sourceFile = `${file}.source`;
    let cached = false;
    try { cached = (await readFile(sourceFile, 'utf8')) === source && (await stat(file)).size > 100; } catch {}
    if (!cached) {
      const response = await fetch(source, { signal: AbortSignal.timeout(45000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Artwork ${card.cardNumber}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100) throw new Error(`Artwork ${card.cardNumber} is empty`);
      await writeFile(file, bytes);
      await writeFile(sourceFile, source);
    }
    manifest.push({ number: card.cardNumber!, source, bytes: (await stat(file)).size });
  }
}));
await writeFile(path.join(staging, 'oracle-art', 'manifest.json'), JSON.stringify(manifest.sort((a,b) => a.number-b.number), null, 2));
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.oracle.config.ts'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Oracle app ready: 64 bundled artworks (${(manifest.reduce((n,a)=>n+a.bytes,0)/1048576).toFixed(1)} MB), card text, fonts, and birth-place lookup.`);
