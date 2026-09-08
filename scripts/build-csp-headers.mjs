/**
 * Rebuild the CSP inline-script allowlist from what the build ACTUALLY shipped.
 *
 * The site's Content-Security-Policy pins inline scripts by sha256 hash. That
 * list was maintained by hand for a single script; it silently breaks the
 * moment any surface ships a new or edited inline script — and the /learn
 * library (Astro) ships several per page, including the island bootstrap that
 * hydrates the shared site bar. A stale list means those scripts are blocked
 * in production with no build-time error at all.
 *
 * So: after every `vite build` (wired as npm postbuild), this walks every
 * .html file in dist/, hashes every executable inline script (plain,
 * type=module, and speculationrules — but not JSON data blocks like ld+json),
 * and rewrites the script-src / script-src-elem hash set inside dist/_headers.
 * public/_headers stays the human-edited template; dist/_headers is generated
 * truth. 'inline-speculation-rules' is included for the prerender hint blocks.
 *
 * `_headers` is a Cloudflare Pages convention: it is only ever applied to
 * static assets. Anything a Pages Function produces (functions/**) — the
 * social-meta rewrites for /universal-language/:number and /piece/:id, every
 * QR redirect, every /api/* route — skips it entirely and ships with none of
 * these headers. functions/_middleware.ts fills that gap, but it runs inside
 * the Workers runtime and cannot read a file at request time, so it needs its
 * own copy of this same header set baked in at build time. Rather than let
 * that copy be hand-maintained (and drift, the exact failure mode this whole
 * script exists to close for the script hashes), this step parses the `/*`
 * block out of the very `dist/_headers` text just written above and emits it
 * as a generated module the middleware imports directly.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'

function htmlFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p))
    else if (name.endsWith('.html')) out.push(p)
  }
  return out
}

const EXECUTABLE_TYPES = new Set(['', 'module', 'text/javascript', 'speculationrules'])

const hashes = new Set()
let scanned = 0
for (const file of htmlFiles(DIST)) {
  scanned++
  const html = readFileSync(file, 'utf8')
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    const attrs = m[1]
    if (/\bsrc\s*=/i.test(attrs)) continue
    const type = (attrs.match(/\btype\s*=\s*["']([^"']*)["']/i)?.[1] ?? '').toLowerCase()
    if (!EXECUTABLE_TYPES.has(type)) continue
    const body = m[2]
    if (!body.trim()) continue
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`)
  }
}

const headersPath = join(DIST, '_headers')
const headers = readFileSync(headersPath, 'utf8')
const allow = ["'self'", "'inline-speculation-rules'", ...[...hashes].sort()].join(' ')
const rewritten = headers.replace(
  /(script-src(?:-elem)?) 'self'(?: '[^']*')*/g,
  (_, directive) => `${directive} ${allow}`,
)
if (rewritten === headers && hashes.size > 0) {
  console.error('[csp] ERROR: found no script-src directives to rewrite in dist/_headers')
  process.exit(1)
}
writeFileSync(headersPath, rewritten)
console.log(`[csp] ${scanned} pages scanned, ${hashes.size} inline scripts allowlisted in dist/_headers`)

/* ─── Emit the generated middleware module ──────────────────────────────── */

function parseHeaderBlock(text, pathPattern) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trim() === pathPattern)
  if (start === -1) {
    throw new Error(`[csp] no "${pathPattern}" block found in dist/_headers while generating security-headers.ts`)
  }
  const block = {}
  for (let i = start + 1; i < lines.length; i++) {
    const match = lines[i].match(/^  ([A-Za-z-]+):\s(.*)$/)
    if (!match) break
    block[match[1]] = match[2]
  }
  return block
}

const rootHeaders = parseHeaderBlock(rewritten, '/*')
const GENERATED_DIR = join('functions', '_generated')
const GENERATED_PATH = join(GENERATED_DIR, 'security-headers.ts')
mkdirSync(GENERATED_DIR, { recursive: true })
writeFileSync(
  GENERATED_PATH,
  `/**\n` +
    ` * GENERATED FILE — do not hand-edit.\n` +
    ` *\n` +
    ` * Written by scripts/build-csp-headers.mjs (npm run build's postbuild step),\n` +
    ` * parsed straight out of the same dist/_headers text that script just wrote,\n` +
    ` * so functions/_middleware.ts can never carry a security header — CSP script\n` +
    ` * hash included — that has drifted from what Cloudflare Pages serves for\n` +
    ` * every static asset. Regenerate with \`npm run build\`.\n` +
    ` */\n` +
    `\n` +
    `export const SECURITY_HEADERS: Record<string, string> = ${JSON.stringify(rootHeaders, null, 2)};\n`,
)
console.log(`[csp] wrote ${GENERATED_PATH} (${Object.keys(rootHeaders).length} headers)`)
