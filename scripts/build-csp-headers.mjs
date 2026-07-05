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
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
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
