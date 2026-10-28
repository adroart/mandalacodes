import { describe, expect, it } from 'vitest';
import { createJournalStore, JOURNAL_KEY, journalMarkdown } from '../../src/mobile/journal/store';
import type { CastResult } from '../../utils/ichingCasting';

function setup(initial?: string) {
  const data = new Map<string,string>(initial ? [[JOURNAL_KEY,initial]] : []);
  let failWrites = false, counter = 0, time = 1000;
  const store = createJournalStore({getItem:key => data.get(key) ?? null, setItem:(key,value) => {
    if (failWrites) throw new Error('Quota'); data.set(key,value);
  }}, () => time++, () => `reading-${++counter}`);
  return {store,data,failWrites:() => {failWrites = true;}};
}
const cast: CastResult = {
  primaryNumber:1, changedNumber:44, movingPositions:[1],
  lines:[9,7,7,7,7,7].map((value,i) => ({position:i+1,value:value as 7|9,yang:true,moving:value===9})),
};
describe('native reading journal', () => {
  it('records deliberate repeated draws but deduplicates repeated delivery of one event', () => {
    const {store} = setup();
    const a = store.recordReading({cardNumber:1,question:' What now? ',cast,eventId:'cast-a'});
    const repeated = store.recordReading({cardNumber:1,eventId:'cast-a'});
    expect(repeated).toEqual(a);
    expect(a.question).toBe('What now?');
    store.recordReading({cardNumber:1,eventId:'cast-b'});
    expect(store.getReadings()).toHaveLength(2);
    expect(store.getReadings()[0].eventId).toBe('cast-b');
  });
  it('preserves the original cast when caller data changes and saves reflection/followups through reload', () => {
    const {store,data} = setup();
    const input = structuredClone(cast);
    const entry = store.recordReading({cardNumber:1,cast:input});
    input.movingPositions.push(2);
    store.saveReflection(entry.id,'The first thing I noticed.');
    store.addFollowUp(entry.id,' A week later, this changed. ');
    const reloaded = createJournalStore({getItem:key => data.get(key) ?? null,setItem:()=>{}}).getReadings()[0];
    expect(reloaded.cast?.movingPositions).toEqual([1]);
    expect(reloaded.reflection).toBe('The first thing I noticed.');
    expect(reloaded.followUps[0].text).toBe('A week later, this changed.');
    expect(reloaded.updatedAt).toBeGreaterThan(reloaded.createdAt);
  });
  it.each(['{broken','{"version":2,"entries":[]}','{"version":1,"entries":[{"id":"keep-me"}]}'])('does not overwrite unreadable or newer journals: %s', raw => {
    const {store,data} = setup(raw);
    expect(() => store.recordReading({cardNumber:1})).toThrow(/not been overwritten/);
    expect(data.get(JOURNAL_KEY)).toBe(raw);
    expect(store.exportRawBackup()).toBe(raw);
  });
  it('does not discard saved readings when a storage write fails', () => {
    const {store,data,failWrites} = setup();
    const saved = store.recordReading({cardNumber:29});
    const previous = data.get(JOURNAL_KEY);
    failWrites();
    expect(() => store.saveReflection(saved.id,'Keep this draft')).toThrow(/could not be saved/);
    expect(data.get(JOURNAL_KEY)).toBe(previous);
    expect(store.getReadings()[0].reflection).toBe('');
  });
  it('reads the latest store before changing a reflection', () => {
    const {store,data} = setup();
    const first = store.recordReading({cardNumber:1});
    const doc = JSON.parse(data.get(JOURNAL_KEY)!);
    doc.entries.unshift({...first,id:'other-tab',cardNumber:2});
    data.set(JOURNAL_KEY,JSON.stringify(doc));
    store.saveReflection(first.id,'Here now');
    expect(store.getReadings()).toHaveLength(2);
  });
  it('rejects incomplete casts and invalid cards without creating an empty journal', () => {
    const {store,data} = setup();
    expect(() => store.recordReading({cardNumber:65})).toThrow();
    expect(() => store.recordReading({cardNumber:1,cast:{...cast,lines:[]}})).toThrow();
    expect(data.has(JOURNAL_KEY)).toBe(false);
  });
  it('exports questions, changing lines, reflection and followups with persistent IDs', () => {
    const {store} = setup();
    const entry = store.recordReading({cardNumber:1,question:'My question',cast});
    store.saveReflection(entry.id,'My reflection');
    store.addFollowUp(entry.id,'Later observation');
    const markdown = journalMarkdown(store.getReadings(), () => 'The Creative');
    expect(markdown).toContain('Reading ID: reading-1');
    expect(markdown).toContain('Changing lines: 1');
    expect(markdown).toContain('Changed hexagram: 44');
    for (const text of ['My question','My reflection','Later observation']) expect(markdown).toContain(text);
    expect(JSON.parse(store.exportBackup()).entries).toHaveLength(1);
  });
});
