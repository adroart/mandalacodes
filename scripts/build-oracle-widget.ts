import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_CARDS } from '../data/oracleData';
import { sunLongitude } from '../lib/astrology/ephemeris';
import { longitudeToGateLine } from '../lib/astrology/gates';
import { bitsForCard } from '../utils/ichingCasting';

const DAY = 86_400_000;
const gateAt = (time: number) => longitudeToGateLine(sunLongitude(new Date(time))).gate;
export interface WidgetTimeline {
  version: 1;
  generatedAt: number;
  validFrom: number;
  validUntil: number;
  cards: Array<{ number: number; name: string; gift: string; lines: boolean[] }>;
  transitions: Array<{ at: number; gate: number }>;
}
/** All times are Unix seconds. Boundaries use the app's apparent solar ephemeris,
 * then binary-search the first millisecond carrying the new gate. No fixed-date
 * approximation or separate astrology model is used by the widget. */
export function buildWidgetTimeline(start: Date, end: Date, generated = new Date()): WidgetTimeline {
  const from = start.getTime(), until = end.getTime();
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) throw new Error('A valid widget date range is required.');
  const transitions = [{ at: from / 1000, gate: gateAt(from) }];
  let previousTime = from, previousGate = transitions[0].gate;
  for (let sample = Math.min(from + DAY, until); previousTime < until; sample = Math.min(sample + DAY, until)) {
    const nextGate = gateAt(sample);
    if (nextGate !== previousGate) {
      let lo = previousTime, hi = sample;
      while (hi - lo > 1) {
        const midpoint = Math.floor((lo + hi) / 2);
        if (gateAt(midpoint) === previousGate) lo = midpoint;
        else hi = midpoint;
      }
      if (hi < until) transitions.push({at:hi / 1000, gate:nextGate});
    }
    previousTime = sample; previousGate = nextGate;
  }
  return {
    version:1, generatedAt:generated.getTime()/1000, validFrom:from/1000, validUntil:until/1000,
    cards:ALL_CARDS.map(card => ({number:card.number, name:card.card_name, gift:card.gene_keys.gift, lines:[...bitsForCard(card.number)!].reverse()})),
    transitions,
  };
}
const REFRESH_WHEN_LEFT = 365*DAY;
/** True when the bundled file can stay as it is: same cards and gate changes, it already covers today, and more than a
 * year of coverage is left. The window start moves every day, so comparing whole files would rewrite it
 * on every build and trip the device build's uncommitted-changes guard. */
export function widgetStillCurrent(previous: WidgetTimeline | undefined, next: WidgetTimeline, now: Date): boolean {
  if (!previous || previous.version !== next.version) return false;
  if (JSON.stringify(previous.cards) !== JSON.stringify(next.cards)) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (previous.validFrom*1000 > today || previous.validUntil*1000 - today <= REFRESH_WHEN_LEFT) return false;
  // Every gate change the new build finds inside the old coverage must already be in the old file.
  const known = new Set(previous.transitions.map(change => `${change.at}:${change.gate}`));
  return next.transitions.slice(1).filter(change => change.at < previous.validUntil).every(change => known.has(`${change.at}:${change.gate}`));
}
export function writeWidgetTimeline(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 7*DAY);
  const end = new Date(start.getTime() + 738*DAY);
  const document = buildWidgetTimeline(start,end,now);
  const output = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../mobile/ios/App/OracleWidget/oracle-widget.json');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  let previous: WidgetTimeline | undefined;
  try { previous = JSON.parse(fs.readFileSync(output,'utf8')); } catch { previous = undefined; }
  if (widgetStillCurrent(previous, document, now)) {
    console.log(`Oracle widget: unchanged, covers through ${new Date(previous!.validUntil*1000).toISOString().slice(0,10)}.`);
    return previous!;
  }
  fs.writeFileSync(output,JSON.stringify(document,null,2)+'\n');
  console.log(`Oracle widget: ${document.transitions.length} solar transitions through ${end.toISOString().slice(0,10)}.`);
  return document;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) writeWidgetTimeline();
