import { describe, it, expect, vi, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { startNativeGoogleSignIn } from '../../src/mobile/account/nativeGoogleSignIn';
const cryptography = webcrypto as unknown as Crypto;
const code = 'A'.repeat(43);
function response(events: EventTarget, detail: unknown) {
  const event = new Event('oracle-google-result');
  Object.defineProperty(event, 'detail', {value:detail}); events.dispatchEvent(event);
}
function fixture() {
  const events = new EventTarget(); let payload: any;
  let ready!: () => void; const started = new Promise<void>(r => {ready=r;});
  const bridge = {postMessage:vi.fn((value:unknown) => {payload=value;ready();})};
  const result = startNativeGoogleSignIn(bridge, events, cryptography);
  return {events,bridge,result,started,get payload(){return payload;}};
}
afterEach(()=>vi.useRealTimers());
describe('native Google proof and callback',()=>{
  it('binds a fresh secret proof to the system-browser attempt and never sends that secret to the browser',async()=>{
    const f=fixture();await f.started;
    expect(f.payload).toMatchObject({action:'start'});expect(f.payload).not.toHaveProperty('verifier');
    expect(f.payload.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    response(f.events,{id:'unrelated',state:f.payload.state,code});
    response(f.events,{id:f.payload.id,state:f.payload.state,code});
    const handoff=await f.result;
    const hash=Buffer.from(await cryptography.subtle.digest('SHA-256',new TextEncoder().encode(handoff.verifier))).toString('base64url');
    expect(hash).toBe(f.payload.challenge);expect(handoff.state).toBe(f.payload.state);expect(handoff.code).toBe(code);
    const other=fixture();await other.started;
    expect(other.payload.state).not.toBe(f.payload.state);expect(other.payload.challenge).not.toBe(f.payload.challenge);
    const rejected=expect(other.result).rejects.toThrow('cancelled');response(other.events,{id:other.payload.id,state:other.payload.state,error:'cancelled'});await rejected;
  });
  it.each([{state:'wrong',code},{code:'https://untrusted.example/session'},{error:'cancelled'}])('rejects an invalid or cancelled callback %j',async(change)=>{
    const f=fixture();await f.started;const rejected=expect(f.result).rejects.toThrow();
    response(f.events,{id:f.payload.id,state:f.payload.state,code,...change});await rejected;
  });
  it('expires the attempt and cancels only its matching native session',async()=>{
    vi.useFakeTimers();const f=fixture();await f.started;
    const rejected=expect(f.result).rejects.toThrow('timed out');await vi.advanceTimersByTimeAsync(300000);await rejected;
    expect(f.bridge.postMessage).toHaveBeenLastCalledWith({action:'cancel',id:f.bridge.postMessage.mock.calls[0][0] && (f.bridge.postMessage.mock.calls[0][0] as any).id});
  });
});
