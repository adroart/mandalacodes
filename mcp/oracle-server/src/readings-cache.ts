/**
 * Loader for the authored per-artwork readings in oracle/readings/<id>.md.
 *
 * These are cached, reviewed prose (CONCEPT §4 structure) that the website
 * renders and the MCP returns when present. A tiny front-matter parser keeps
 * this dependency-free.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ORACLE_DIR } from './paths.ts';

export interface CachedReading {
  artwork: string;
  code?: number;
  card_name?: string;
  voices?: string[];
  length?: string;
  status?: string;
  body: string;
}

const READINGS_DIR = resolve(ORACLE_DIR, 'readings');

/** Minimal front-matter parser: `---` block of `key: value` (and `[a, b]`). */
function parse(raw: string): CachedReading | undefined {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return undefined;
  const meta: Record<string, unknown> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val: unknown = kv[2].trim();
    if (typeof val === 'string') {
      const s = val;
      if (/^\[.*\]$/.test(s)) {
        val = s.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
      } else if (/^-?\d+$/.test(s)) {
        val = Number(s);
      }
    }
    meta[key] = val;
  }
  if (!meta.artwork) return undefined;
  return { ...(meta as object), body: m[2].trim() } as CachedReading;
}

let cache: Promise<Map<string, CachedReading>> | undefined;

export function loadReadings(): Promise<Map<string, CachedReading>> {
  if (!cache) cache = build();
  return cache;
}

async function build(): Promise<Map<string, CachedReading>> {
  const out = new Map<string, CachedReading>();
  if (!existsSync(READINGS_DIR)) return out;
  for (const name of await readdir(READINGS_DIR)) {
    if (!name.endsWith('.md') || name === 'README.md') continue;
    const parsed = parse(await readFile(resolve(READINGS_DIR, name), 'utf8'));
    if (parsed) out.set(parsed.artwork, parsed);
  }
  return out;
}
