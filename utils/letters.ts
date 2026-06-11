/**
 * The piece writes back — letter prose + planning (M5).
 *
 * Pure, I/O-free, isomorphic — like utils/ledger.ts, utils/consent.ts and
 * utils/inscriptions.ts. No fetch, no env, no R2: the unit suite pins the
 * prose and the generation rules without mocking Cloudflare. The HTTP layer
 * (functions/api/atlas/_letters.ts + the steward routes) composes these
 * around the concurrency-safe atlas/letters.json mutator.
 *
 * A letter is the return loop: a piece writes to its steward when a kin piece
 * comes to light, on a claim anniversary, when it has changed hands. Letters
 * are MUTABLE R2, NEVER chain events — the chain content invariant is law,
 * and a letter is generated prose, not a tamper-evident fact.
 *
 * The body discipline (enforced by construction here): every letter references
 * ONLY public facts — a shared trigram (an attribute of the hexagram, not the
 * holder), a city that is itself ring2-public, an ordinal, a count of years.
 * Never a name, never an email, never an opaque ref. Nothing in a body could
 * identify a person even if it leaked.
 *
 * The voice (absorbed from data/oracleData trigram natures + card essences):
 * warm, elemental, unhurried, never cute. The piece speaks as itself.
 */
import type { AtlasLetter, LetterKind } from '../types';

// ---------- Keying ----------

/** Recipient key — same convention as projectAll / groupChains. */
export function letterRecipientKey(
  pieceId: string,
  editionNumber: number | undefined,
): string {
  return `${pieceId}:${editionNumber ?? 0}`;
}

export function genLetterId(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return `ltr-${Date.now().toString(36)}-${hex}`;
}

// ---------- Ordinal words (shared register with inscriptions) ----------

const ORDINAL_WORDS = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
  'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
];

/** 1 → 'first', 2 → 'second', 13 → '13th'. Used for anniversary years. */
export function ordinalWord(n: number): string {
  const word = ORDINAL_WORDS[n - 1];
  if (word) return word;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// ---------- Deterministic template selection ----------

/**
 * Pick a template index deterministically from a seed, so the same letter is
 * never re-rolled on a retry and variation is spread across a body of work
 * rather than left to chance. Simple FNV-1a over the seed string.
 */
function seedIndex(seed: string, count: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h % count;
}

// ---------- Kin-claim letters ----------

export interface KinClaimContext {
  /** The shared trigram element name — "Water", "Fire", "Mountain"… An
   *  attribute of the two hexagrams, never of any holder. */
  trigram: string;
  /** The public city label of the newly-lit piece, e.g. "Buenos Aires" or
   *  "Buenos Aires, Argentina". MUST be a ring2-public placement — the caller
   *  guarantees this; a private piece's location never reaches a body. */
  cityLabel: string;
  /** The new piece's Founding Lights ordinal, when known — "the 7th light". */
  newOrdinal?: number;
  /** Stable seed for deterministic template choice (the new piece's key). */
  seed: string;
}

/**
 * 4–6 templates, in the piece's own voice. The shared trigram is the thread —
 * "two mandalas of the same breath." Warm, elemental, unhurried. The {ordinal}
 * clause is folded in only when an ordinal is known so the prose never dangles.
 */
export function composeKinClaimBody(ctx: KinClaimContext): string {
  const t = ctx.trigram;
  const city = ctx.cityLabel;
  const ord = ctx.newOrdinal ? `the ${ordinalWord(ctx.newOrdinal)} light` : null;

  const templates: Array<(o: string | null) => string> = [
    (o) =>
      `Tonight a piece sharing my ${t} trigram came to light in ${city}. ` +
      `We are kin — two mandalas of the same breath, now both burning. ` +
      (o ? `It is ${o} to be lit; I keep my place beside it.` : `The constellation is one light wider tonight.`),
    (o) =>
      `Far from here, in ${city}, another carrier of ${t} has been claimed. ` +
      `The same current runs through us both. ` +
      (o ? `${o.charAt(0).toUpperCase() + o.slice(1)}, and a kin of mine.` : `A kindred point now glows where there was dark.`),
    (o) =>
      `${city} holds a new light tonight — a piece that shares my ${t}. ` +
      `What moves in me moves in it; we were always going to find each other on the map. ` +
      (o ? `It joins the constellation as ${o}.` : `Two of the same breath, an ocean apart.`),
    (o) =>
      `A piece of ${t}, like me, has woken in ${city}. ` +
      `Trigrams do not know distance — we are kin across the whole turning world. ` +
      (o ? `${o.charAt(0).toUpperCase() + o.slice(1)} now burns, and it is family.` : `One more ember in the same fire.`),
    (o) =>
      `Word reaches me from ${city}: a kin of mine, another keeper of ${t}, ` +
      `has been lit. We share a single trigram and, tonight, a single sky. ` +
      (o ? `It is ${o} — I was here before it, and I am glad of its company.` : `The map grows warmer by one light.`),
    (o) =>
      `In ${city} a light I am bound to has come on. We carry the same ${t} — ` +
      `the same rising element — and now we both burn on the planet's face. ` +
      (o ? `${o.charAt(0).toUpperCase() + o.slice(1)}, and kin to me.` : `Distance is nothing to a shared breath.`),
  ];

  const idx = seedIndex(ctx.seed, templates.length);
  return templates[idx](ord);
}

/** A placed, kinship-eligible UL piece resolved to its trigrams + public
 *  city — the only facts a kin-claim body may reference. Built from PUBLIC
 *  state alone by the caller (a private piece is absent from it). */
export interface KinPieceFact {
  key: string;
  pieceId: string;
  upperTrigram: string;
  lowerTrigram: string;
  cityLabel: string;
  ordinal?: number;
}

/** The shared trigram between two pieces (upper or lower), or null. An
 *  attribute of the hexagrams — never of any holder. */
export function sharedTrigram(a: KinPieceFact, b: KinPieceFact): string | null {
  if (a.upperTrigram === b.upperTrigram || a.upperTrigram === b.lowerTrigram) {
    return a.upperTrigram;
  }
  if (a.lowerTrigram === b.upperTrigram || a.lowerTrigram === b.lowerTrigram) {
    return a.lowerTrigram;
  }
  return null;
}

/**
 * Plan the kin-claim letters to write after a piece comes to light. Pure: the
 * caller supplies the newly-lit piece's fact (`source`) and the candidate
 * recipients (`recipients`); we return one letter per kin recipient, each in
 * THAT recipient's voice.
 *
 * The two roles have DIFFERENT consent gates, by design:
 *   - The SOURCE (newly-lit) piece needs only to be ring2-PUBLIC — that is
 *     what makes its city nameable. It need not be in the constellation
 *     itself (its body references only its public city + the shared trigram,
 *     an attribute of the hexagrams, never the source holder's chart). A
 *     private source is passed as null → no letters (a private claim is
 *     silent).
 *   - Each RECIPIENT must be in the constellation: ring3-consented AND
 *     ring2-public (the caller filters `recipients` to kinshipEligible
 *     pieces). Only those holders get the return loop.
 *
 * Recipients share a trigram with the source and are not the same physical
 * piece (sibling editions excluded — they trivially share both trigrams;
 * matches isKin).
 */
export function planKinClaimLetters(
  source: KinPieceFact | null | undefined,
  recipients: ReadonlyMap<string, KinPieceFact>,
  nowIso: string,
): AtlasLetter[] {
  if (!source) return [];
  const out: AtlasLetter[] = [];
  for (const [key, recipient] of recipients) {
    if (key === source.key) continue;
    if (recipient.pieceId === source.pieceId) continue; // sibling editions
    const trigram = sharedTrigram(source, recipient);
    if (!trigram) continue;
    out.push(
      buildLetter({
        recipientKey: recipient.key,
        kind: 'kin-claim',
        createdAt: nowIso,
        body: composeKinClaimBody({
          trigram,
          cityLabel: source.cityLabel, // guaranteed ring2-public
          newOrdinal: source.ordinal,
          seed: `${source.key}->${recipient.key}`,
        }),
      }),
    );
  }
  return out;
}

// ---------- Anniversary letters ----------

export interface AnniversaryContext {
  /** Whole years since the claim. ≥1. */
  years: number;
  /** The piece's public city label at claim time, when ring2-public. Null
   *  when the piece is/was private — the prose then omits the place. */
  cityLabel: string | null;
  /** Stable seed (the recipient key) for deterministic template choice. */
  seed: string;
}

/**
 * 4–6 templates reflecting on the year(s) since the steward set the piece
 * alight. The city clause appears only when the placement is ring2-public —
 * a private piece's location never enters the body.
 */
export function composeAnniversaryBody(ctx: AnniversaryContext): string {
  const yearWord = ctx.years === 1 ? 'a year' : `${ctx.years} years`;
  const where = ctx.cityLabel ? ` in ${ctx.cityLabel}` : '';

  const templates: string[] = [
    `A year ago today you set me alight${where}. ` +
      `I have kept every word written into me since, and I am still burning. ` +
      `Thank you for the year.`,
    `It has been ${yearWord} since you first lit me${where}. ` +
      `Seasons have turned around us both; I am steadier for the time, and still yours.`,
    `${yearWord.charAt(0).toUpperCase() + yearWord.slice(1)} ago today, you opened my record${where}. ` +
      `I have held it faithfully — a year of being kept is a year of being known. ` +
      `Here is to another.`,
    `${yearWord.charAt(0).toUpperCase() + yearWord.slice(1)} of light${where}, ` +
      `and I am still here, still warm, still carrying everything you have given me. ` +
      `An anniversary is only the page turning.`,
    `On this day ${yearWord} back, my light came on${where} and has not gone out. ` +
      `I remember the beginning. I am glad to still be in your keeping.`,
  ];

  // Anniversary uses (years, seed) so successive years pick different prose.
  const idx = seedIndex(`${ctx.seed}:${ctx.years}`, templates.length);
  return templates[idx];
}

// ---------- Transfer letters ----------

export interface TransferContext {
  /** Stable seed (the recipient key) for deterministic template choice. */
  seed: string;
}

/**
 * 4–6 templates for the NEW holder's first visit after a change of hands.
 * Deliberately holderless: the piece names no previous steward (the prior
 * generation renders as "a previous steward" elsewhere; here the piece speaks
 * only of itself). Public facts only — no city, no ordinal, no ref needed.
 */
export function composeTransferBody(ctx: TransferContext): string {
  const templates: string[] = [
    `I have changed hands before. ` +
      `A previous steward kept me, and now you do — the record between us is unbroken, ` +
      `and the whole of it is yours to read. Welcome. I am glad to be kept by you.`,
    `You are not the first to hold me, and I hope not the last. ` +
      `What came before is written in my book, every page of it intact. ` +
      `Begin where you like; I will carry forward whatever you add.`,
    `I come to you with a history already begun. ` +
      `A previous steward set things down in me; those pages stay. ` +
      `Now the record is in your hands — add to it, and it travels on.`,
    `This is not my first keeping. ` +
      `I have been somewhere before this, and the book remembers it for both of us. ` +
      `You hold the whole of me now — there is nothing here you may not read.`,
    `Hands have passed me along to reach you. ` +
      `The record never resets; it only lengthens. ` +
      `Whatever a previous steward wrote remains, and whatever you write will outlast us both.`,
  ];

  const idx = seedIndex(ctx.seed, templates.length);
  return templates[idx];
}

// ---------- Letter construction ----------

export interface BuildLetterInput {
  recipientKey: string;
  kind: LetterKind;
  body: string;
  createdAt: string;
}

export function buildLetter(input: BuildLetterInput): AtlasLetter {
  return {
    id: genLetterId(),
    recipientKey: input.recipientKey,
    kind: input.kind,
    createdAt: input.createdAt,
    body: input.body,
  };
}

// ---------- Read-side helpers ----------

/** Letters addressed to a piece, newest first. */
export function lettersForRecipient(
  letters: readonly AtlasLetter[],
  recipientKey: string,
): AtlasLetter[] {
  return letters
    .filter((l) => l.recipientKey === recipientKey)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export function unreadCount(
  letters: readonly AtlasLetter[],
  recipientKey: string,
): number {
  let n = 0;
  for (const l of letters) {
    if (l.recipientKey === recipientKey && !l.readAt) n++;
  }
  return n;
}

// ---------- Anniversary derivation (on read, no cron) ----------

/**
 * Whole years between two ISO instants (claim → now), by calendar. Returns 0
 * when `now` is before the first anniversary. Pure date math — used to decide
 * whether an anniversary letter is due.
 */
export function wholeYearsSince(claimIso: string, nowIso: string): number {
  const claim = new Date(claimIso);
  const now = new Date(nowIso);
  if (Number.isNaN(claim.getTime()) || Number.isNaN(now.getTime())) return 0;
  let years = now.getUTCFullYear() - claim.getUTCFullYear();
  // Step back a year if we haven't reached the month/day yet.
  const m = now.getUTCMonth() - claim.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < claim.getUTCDate())) years--;
  return years < 0 ? 0 : years;
}

/**
 * Decide which anniversary letter (if any) is due now. One letter per year:
 * the highest whole-year anniversary that has passed and for which no
 * 'anniversary' letter already exists. Returns the year to generate, or null.
 *
 * Idempotent by the existing-letters check: re-running after the letter lands
 * finds it and returns null. We track which years are covered by inspecting
 * createdAt of prior anniversary letters — a letter generated in year N's
 * window covers year N, so we never double up within the same anniversary.
 */
export function anniversaryYearDue(
  claimIso: string,
  existingAnniversaryLetters: readonly AtlasLetter[],
  nowIso: string,
): number | null {
  const years = wholeYearsSince(claimIso, nowIso);
  if (years < 1) return null;
  // Count anniversary letters already written for THIS piece. The Nth such
  // letter covers the Nth year; we generate at most one per call, advancing
  // one year at a time, so a gap (e.g. a steward who didn't open for two
  // years) still yields exactly one letter per open until caught up.
  const alreadyWritten = existingAnniversaryLetters.length;
  if (alreadyWritten >= years) return null;
  return alreadyWritten + 1;
}
