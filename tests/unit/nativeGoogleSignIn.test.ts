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


describe('native Google safe return diagnostics',()=>{
 it.each([
  ['presentation-unavailable','could not open'],
  ['system-error','iPhone could not return'],
  ['callback-missing','closed without returning'],
  ['callback-url-shape','unexpected app link'],
  ['callback-query-count','unexpected app link'],
  ['callback-state-mismatch','could not be verified'],
  ['callback-server-error','confirmed by the server'],
  ['callback-code-invalid','invalid response'],
 ])('explains the fixed stage %s without reflecting native error details',async(stage,message)=>{
  const f=fixture();await f.started;const rejected=expect(f.result).rejects.toThrow(message);
  response(f.events,{id:f.payload.id,state:f.payload.state,error:'failed',stage,errorDomain:'untrusted-secret-domain',errorMessage:'private-secret'});await rejected;
 });
 it('keeps cancellation and unknown old native failures compatible',async()=>{
  const cancelled=fixture();await cancelled.started;const cancellation=expect(cancelled.result).rejects.toThrow('Google sign-in was cancelled.');response(cancelled.events,{id:cancelled.payload.id,state:cancelled.payload.state,error:'cancelled',stage:'system-error'});await cancellation;
  const old=fixture();await old.started;const rejected=expect(old.result).rejects.toThrow('Google sign-in did not finish. Please try again.');response(old.events,{id:old.payload.id,state:old.payload.state,error:'failed',stage:'untrusted-secret-stage'});await rejected;
 });
 it('does not let a diagnostic stage override the existing proof checks',async()=>{
  const f=fixture();await f.started;const rejected=expect(f.result).rejects.toThrow('could not be verified');response(f.events,{id:f.payload.id,state:'wrong',code,stage:'success'});await rejected;
 });
});
