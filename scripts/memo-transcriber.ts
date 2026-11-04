/**
 * The memo transcriber, for a machine with no per-request CPU limit (the VPS): it asks the site for memos whose
 * recording still needs a first transcript, claims each one, transcribes it through the same quick-transcription
 * service the site uses, and sends the result back. One pass, then it exits; a timer or the agent runs it again.
 *
 *   npx tsx scripts/memo-transcriber.ts            one pass
 *   npx tsx scripts/memo-transcriber.ts --dry-run  list what is waiting, change nothing
 *
 * Reads from the environment: AR_PICKUP_TOKEN (required), GROQ_API_KEY, and for the Workers AI fallback
 * CLOUDFLARE_ACCOUNT_ID with CLOUDFLARE_AI_TOKEN. MEMO_SITE_URL overrides https://mandalacodes.com.
 * It never prints a key.
 */
import { quickTranscribe, type QuickTranscriptionEnv } from '../functions/api/_lib/quickTranscription';
import { memoTranscriptionPrompt } from '../functions/api/_lib/memoTranscript';

const site = (process.env.MEMO_SITE_URL || 'https://mandalacodes.com').replace(/\/$/, '');
const key = process.env.AR_PICKUP_TOKEN?.trim();
const dryRun = process.argv.includes('--dry-run');

/** Workers AI over its REST API, shaped like the site's AI binding, so the service code runs unchanged here. */
function workersAiOverRest(): QuickTranscriptionEnv['AI'] | undefined {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim(); const token = process.env.CLOUDFLARE_AI_TOKEN?.trim();
  if (!account || !token) return undefined;
  return {
    async run(model: string, input: unknown) {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const body = await response.json() as { success?: boolean; result?: unknown; errors?: { message?: string }[] };
      if (!response.ok || !body.success) throw new Error(`Workers AI HTTP ${response.status}`);
      return body.result;
    },
  } as never;
}

async function call(path: string, init: RequestInit = {}) {
  const response = await fetch(site + path, { ...init, headers: { Authorization: `Bearer ${key}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } });
  return { status: response.status, response };
}

async function main() {
  if (!key) { console.error('AR_PICKUP_TOKEN is not set; nothing to do.'); process.exit(2); }
  const env: QuickTranscriptionEnv = { GROQ_API_KEY: process.env.GROQ_API_KEY, AI: workersAiOverRest() };
  if (!env.GROQ_API_KEY && !env.AI) { console.error('No transcription provider: set GROQ_API_KEY, or CLOUDFLARE_ACCOUNT_ID with CLOUDFLARE_AI_TOKEN.'); process.exit(2); }
  const listed = await call('/api/oracle/pickup/memos?waiting=transcript');
  if (listed.status !== 200) { console.error(`The site refused the list (HTTP ${listed.status}).`); process.exit(1); }
  const { memos } = await listed.response.json() as { memos: { id: string; title: string; audio: { mimeType: string; byteSize: number } | null }[] };
  console.log(`${memos.length} memo(s) waiting for a transcript.`);
  let failures = 0;
  for (const memo of memos) {
    const label = `${memo.id.slice(0, 8)} ${memo.title || '(untitled)'}`;
    if (dryRun || !memo.audio) { console.log(`  ${label}: ${memo.audio ? 'waiting' : 'no recording yet'}`); continue; }
    const claim = await call(`/api/oracle/pickup/memos/${memo.id}/transcript`, { method: 'POST', body: JSON.stringify({ claim: true }) });
    if (claim.status !== 200) { console.log(`  ${label}: claimed elsewhere (HTTP ${claim.status}), skipped.`); continue; }
    const { startedAt } = await claim.response.json() as { startedAt: string };
    const send = (body: unknown) => call(`/api/oracle/pickup/memos/${memo.id}/transcript`, { method: 'POST', body: JSON.stringify({ startedAt, ...body as object }) });
    try {
      const audio = await call(`/api/oracle/pickup/memos/${memo.id}/files/audio`);
      if (audio.status !== 200) throw new Error(`audio HTTP ${audio.status}`);
      const started = Date.now();
      const transcript = await quickTranscribe(env, await audio.response.arrayBuffer(), memo.audio.mimeType, { prompt: memoTranscriptionPrompt(), timings: true, logTag: '[memo-transcriber]' });
      const sent = await send({ transcript });
      if (sent.status !== 200) throw new Error(`the site refused the transcript (HTTP ${sent.status})`);
      console.log(`  ${label}: done by ${transcript.provider} in ${Math.round((Date.now() - started) / 1000)} s, ${transcript.text.split(/\s+/).length} words, ${transcript.segments?.length ?? 0} timed sentences.`);
    } catch (error) {
      failures += 1;
      const why = error instanceof Error ? error.message.replace(/Bearer\s+\S+/g, 'Bearer [redacted]').slice(0, 160) : 'unknown error';
      await send({ failed: why }).catch(() => undefined);
      console.log(`  ${label}: failed (${why}); the phone page shows it can be tried again.`);
    }
  }
  process.exit(failures ? 1 : 0);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
