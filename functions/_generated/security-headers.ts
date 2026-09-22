/**
 * GENERATED FILE — do not hand-edit.
 *
 * Written by scripts/build-csp-headers.mjs (npm run build's postbuild step),
 * parsed straight out of the same dist/_headers text that script just wrote,
 * so functions/_middleware.ts can never carry a security header — CSP script
 * hash included — that has drifted from what Cloudflare Pages serves for
 * every static asset. Regenerate with `npm run build`.
 */

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
  "X-XSS-Protection": "1; mode=block",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'inline-speculation-rules' 'sha256-4ooaTf3MLyBW0Z4rHpW0emtRYlr9uYMWWGLlmG+TjgI=' 'sha256-4zm1CCJc2vpU6wPFY0DrmT701MpKuK9JCtNvl1twjB4=' 'sha256-BcaPNfQmlUMAzA3vDP6oWsWVtoYHvONdXdjPbm38Duo=' 'sha256-F50DuNf754NlaR04yn7sJ2w8Aj0abLaBgOCACzdxb2c=' 'sha256-L3/1+GNqdQTkG7c2nGLNJz24PgEWo9RDuME8e97eqro=' 'sha256-PhrD7ow/gqq24AWJal+YzfEzuWy7dRxKq8nMn+mhe/Y=' 'sha256-QzWFZi+FLIx23tnm9SBU4aEgx4x8DsuASP07mfqol/c=' 'sha256-SaCkFfPruIdTXT8/97JArQmGxiJAL2o4bBDvSgJ5y3Q=' 'sha256-Zv5o8iIvvty7EbYcp3efz1tD/TcKXGdlFJx0JTTnDmg=' https://static.cloudflareinsights.com; script-src-elem 'self' 'inline-speculation-rules' 'sha256-4ooaTf3MLyBW0Z4rHpW0emtRYlr9uYMWWGLlmG+TjgI=' 'sha256-4zm1CCJc2vpU6wPFY0DrmT701MpKuK9JCtNvl1twjB4=' 'sha256-BcaPNfQmlUMAzA3vDP6oWsWVtoYHvONdXdjPbm38Duo=' 'sha256-F50DuNf754NlaR04yn7sJ2w8Aj0abLaBgOCACzdxb2c=' 'sha256-L3/1+GNqdQTkG7c2nGLNJz24PgEWo9RDuME8e97eqro=' 'sha256-PhrD7ow/gqq24AWJal+YzfEzuWy7dRxKq8nMn+mhe/Y=' 'sha256-QzWFZi+FLIx23tnm9SBU4aEgx4x8DsuASP07mfqol/c=' 'sha256-SaCkFfPruIdTXT8/97JArQmGxiJAL2o4bBDvSgJ5y3Q=' 'sha256-Zv5o8iIvvty7EbYcp3efz1tD/TcKXGdlFJx0JTTnDmg=' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://mandalacodes-media.lightcodes.workers.dev; media-src 'self' blob:; connect-src 'self' https://cloudflareinsights.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
};
