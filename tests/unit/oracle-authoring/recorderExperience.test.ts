import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startCapture } from '../../../lib/oracle/authoring/recorder';
import type { AuthoringStore, SavedSession } from '../../../lib/oracle/authoring/storage';
import type { AuthoringSession } from '../../../lib/oracle/authoring/types';

class Track extends EventTarget {
  muted = false; enabled = true; readyState: MediaStreamTrackState = 'live';
  stop = vi.fn(() => { this.readyState = 'ended'; });
  end() { this.readyState = 'ended'; this.dispatchEvent(new Event('ended')); }
}
class Recorder {
  static latest: Recorder;
  static isTypeSupported = () => true;
  state: RecordingState = 'inactive'; mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { Recorder.latest = this; }
  start = vi.fn(() => { this.state = 'recording'; });
  requestData = vi.fn(() => this.emit('chunk'));
  emit(text: string) { this.ondataavailable?.({ data: new Blob([text], { type: this.mimeType }) }); }
  pause = vi.fn(() => { this.state = 'paused'; this.onpause?.(); });
  resume = vi.fn(() => { this.state = 'recording'; this.onresume?.(); });
  stop = vi.fn(() => { this.state = 'inactive'; this.emit('final'); this.onstop?.(); });
}
class Page extends EventTarget { visibilityState: DocumentVisibilityState = 'visible'; }
function memoryStore() {
  const initial: AuthoringSession = { schema: 1, id: 'session', createdAt: '2026-10-28', source: { cardNumber: 2, revision: 'r', hash: 'test', markdown: 'words', sections: [{ id: 'CODE', title: 'Code', start: 0, end: 5 }] }, captures: [], markers: [], transcript: [], proposals: [], approvals: [] };
  let current: SavedSession = { session: structuredClone(initial), version: 1 };
  const chunks: { index: number; blob: Blob; endMs: number }[] = [];
  const store = {
    save: vi.fn(async (session: AuthoringSession, version: number) => {
      if (version !== current.version) throw new Error('Concurrent version');
      current = { session: structuredClone(session), version: version + 1 }; return current.version;
    }),
    load: vi.fn(async () => structuredClone(current)),
    appendChunk: vi.fn(async (_session: string, captureId: string, index: number, blob: Blob, endMs: number) => {
      chunks.push({ index, blob, endMs });
      current.session.captures = current.session.captures.map(c => c.id === captureId ? { ...c, durationMs: endMs } : c);
      current.version++;
    }),
    chunks: vi.fn(async () => []),
  };
  return { initial: { session: initial, version: 1 }, store: store as unknown as AuthoringStore, chunks };
}
let now: number, track: Track, page: Page, getUserMedia: ReturnType<typeof vi.fn>;
beforeEach(() => {
  now = 0; track = new Track(); page = new Page();
  getUserMedia = vi.fn(async () => ({ getTracks: () => [track], getAudioTracks: () => [track] }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.stubGlobal('document', page);
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('in-card recording controls', () => {
  it('pauses the audio timeline and keeps chunks and section markers aligned through resume', async () => {
    const { store, initial, chunks } = memoryStore(); const failure = vi.fn();
    const active = await startCapture(store, initial, 'CODE', failure);
    now = 1200; active.pause(); expect(active.state()).toBe('paused');
    now = 10_200; expect(active.elapsed()).toBe(1200); active.mark('ICHING');
    active.resume(); now = 10_700; Recorder.latest.emit('spoken again');
    const saved = await active.stop();
    expect(active.elapsed()).toBe(1700); expect(active.state()).toBe('inactive');
    expect(chunks.map(c => c.endMs)).toEqual([1200, 1700, 1700]);
    expect(saved.session.markers.map(m => [m.atMs, m.sectionId])).toEqual([[0, 'CODE'], [1200, 'ICHING']]);
    expect(saved.session.captures[0]).toMatchObject({ status: 'ready', durationMs: 1700 });
    expect(await Promise.all(chunks.map(c => c.blob.text()))).toEqual(['chunk', 'spoken again', 'final']);
    expect(track.stop).toHaveBeenCalledTimes(1); expect(failure).not.toHaveBeenCalled();
  });
  it('can finish while paused without counting waiting time', async () => {
    const { store, initial } = memoryStore(); const active = await startCapture(store, initial, 'CODE', vi.fn());
    now = 500; active.pause(); now = 50_000;
    const saved = await active.stop();
    expect(active.elapsed()).toBe(500); expect(saved.session.captures[0].durationMs).toBe(500);
  });
  it('treats optional metering as best effort and closes its resources with the microphone', async () => {
    const disconnectSource = vi.fn(), disconnectAnalyser = vi.fn(), close = vi.fn(async () => undefined);
    class Context {
      state = 'running';
      createMediaStreamSource() { return { connect: vi.fn(), disconnect: disconnectSource }; }
      createAnalyser() { return { fftSize: 256, getFloatTimeDomainData: (values: Float32Array) => values.fill(.125), disconnect: disconnectAnalyser }; }
      close = close;
    }
    vi.stubGlobal('window', { setTimeout, clearTimeout, AudioContext: Context });
    const { store, initial } = memoryStore(); const active = await startCapture(store, initial, 'CODE', vi.fn());
    expect(active.level()).toBeCloseTo(.5); expect(active.muted()).toBe(false);
    track.muted = true; expect(active.muted()).toBe(true); now = 1000; active.pause(); expect(active.level()).toBe(0);
    await active.stop(); expect(close).toHaveBeenCalledTimes(1); expect(disconnectSource).toHaveBeenCalledTimes(1); expect(disconnectAnalyser).toHaveBeenCalledTimes(1);
  });
  it('retains final delivered audio after a microphone disconnect and removes listeners on stop', async () => {
    const { store, initial, chunks } = memoryStore(); const failure = vi.fn();
    const active = await startCapture(store, initial, 'CODE', failure);
    expect(active.level()).toBeNull(); now = 1000; page.visibilityState = 'hidden'; page.dispatchEvent(new Event('visibilitychange'));
    expect(Recorder.latest.requestData).toHaveBeenCalledTimes(1);
    now = 1500; track.end(); const saved = await active.completion;
    expect(saved.session.captures[0]).toMatchObject({ status: 'interrupted', durationMs: 1500 });
    expect(failure).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('disconnected') }));
    expect(chunks).toHaveLength(2); expect(await chunks[1].blob.text()).toBe('final');
    track.dispatchEvent(new Event('ended')); page.dispatchEvent(new Event('visibilitychange'));
    expect(failure).toHaveBeenCalledTimes(1); expect(Recorder.latest.requestData).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['NotAllowedError', 'Allow the microphone'], ['NotFoundError', 'No microphone'], ['NotReadableError', 'another app'],
  ])('explains %s without creating a recording', async (name, words) => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('browser detail'), { name }));
    const { store, initial } = memoryStore();
    await expect(startCapture(store, initial, 'CODE', vi.fn())).rejects.toThrow(words);
    expect(store.save).not.toHaveBeenCalled();
  });
});

import {startVoiceCapturePass} from '../../../src/mobile/authoring/voiceCapturePass';
async function settlePass(){for(let i=0;i<60;i++)await Promise.resolve();}
describe('rolling voice passes',()=>{
 it('Send finishes by default and releases the microphone after saving final audio',async()=>{
  const {store,initial,chunks}=memoryStore(),onSegment=vi.fn();
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{onSegment});
  now=1000;await active.flush();await settlePass();
  expect(active.state()).toBe('inactive');expect(getUserMedia).toHaveBeenCalledTimes(1);
  expect(chunks).toHaveLength(1);expect(onSegment).toHaveBeenCalledTimes(1);expect(track.stop).toHaveBeenCalledTimes(1);
 });
 it('retains the microphone across Send next and does not wait for slow processing',async()=>{
  const {store,initial}=memoryStore();let finishProcessing!:()=>void;
  const onSegment=vi.fn(()=>new Promise<void>(resolve=>{finishProcessing=resolve;}));
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{continuous:true,onSegment});
  now=1000;await active.flush({nextSectionId:'ICHING'});
  expect(active.state()).toBe('recording');expect(active.currentCaptureId()).not.toBe(active.captureId);
  expect(getUserMedia).toHaveBeenCalledTimes(1);expect(track.stop).not.toHaveBeenCalled();
  expect(active.pendingProcessing()).toBe(1);
  const saved=await store.load('session');expect(saved!.session.markers.at(-1)?.sectionId).toBe('ICHING');
  finishProcessing();active.setContinuous(false);now=1500;await active.flush();await active.completion;
  expect(track.stop).toHaveBeenCalledTimes(1);
 });
 it('registers the durable job before exposing the next active take',async()=>{
  const {store,initial}=memoryStore(),events:string[]=[];let register!:()=>void;
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{continuous:true,onActive:()=>events.push('active'),onSegmentReady:()=>new Promise<void>(yes=>{register=()=>{events.push('registered');yes();};})});
  now=1000;const flushing=active.flush();await settlePass();expect(events).toEqual(['active']);
  register();await flushing;expect(events).toEqual(['active','registered','active']);
  const stopping=active.stop();await settlePass();register();await stopping;
 });
 it('rolls before byte limits in the same section even with continuous Send next off',async()=>{
  const {store,initial,chunks}=memoryStore(),onSegment=vi.fn();
  const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{maxBytes:6,onSegment});
  now=1000;Recorder.latest.emit('123456');await settlePass();
  expect(active.state()).toBe('recording');expect(active.currentCaptureId()).not.toBe(active.captureId);
  expect(getUserMedia).toHaveBeenCalledTimes(1);expect(await chunks[0].blob.text()).toBe('123456');
  expect((await store.load('session'))!.session.markers.every(marker=>marker.sectionId==='CODE')).toBe(true);
  now=1500;await active.stop();expect(onSegment).toHaveBeenCalledTimes(2);
 });
});

it('distinguishes safety continuation, explicit Send, and Finish while retaining the same microphone',async()=>{
 const {store,initial}=memoryStore(),onSegmentReady=vi.fn();
 const active=await startVoiceCapturePass(store,initial,'CODE',vi.fn(),2,{maxBytes:6,onSegmentReady});
 now=1000;Recorder.latest.emit('123456');await settlePass();
 expect(onSegmentReady.mock.calls.map(call=>call[2].reason)).toEqual(['boundary']);
 expect(getUserMedia).toHaveBeenCalledTimes(1);expect(track.stop).not.toHaveBeenCalled();
 now=1500;await active.flush({continue:true});
 expect(onSegmentReady.mock.calls.map(call=>call[2].reason)).toEqual(['boundary','send']);
 expect(getUserMedia).toHaveBeenCalledTimes(1);expect(track.stop).not.toHaveBeenCalled();
 now=2000;await active.stop();
 expect(onSegmentReady.mock.calls.map(call=>call[2].reason)).toEqual(['boundary','send','stop']);
 expect(getUserMedia).toHaveBeenCalledTimes(1);expect(track.stop).toHaveBeenCalledTimes(1);
});

it('keeps a bounded phrase capture single-take and stops paused safety rolls',async()=>{
 const first=memoryStore();const scoped=await startVoiceCapturePass(first.store,first.initial,'CODE',vi.fn(),2,{maxBytes:6,rollOnBoundary:false});now=1000;Recorder.latest.emit('123456');await scoped.completion;expect(scoped.state()).toBe('inactive');expect(getUserMedia).toHaveBeenCalledTimes(1);
 const second=memoryStore();const paused=await startVoiceCapturePass(second.store,second.initial,'CODE',vi.fn(),2,{maxBytes:6,continuous:true});paused.pause();now=2000;Recorder.latest.emit('123456');await paused.completion;expect(paused.state()).toBe('inactive');expect(getUserMedia).toHaveBeenCalledTimes(2);
});
