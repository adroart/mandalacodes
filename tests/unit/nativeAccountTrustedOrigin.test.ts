import { expect, it, vi } from 'vitest';
const { capture }=vi.hoisted(()=>({capture:vi.fn(options=>options)}));
vi.mock('better-auth',()=>({betterAuth:capture}));
vi.mock('better-auth/plugins',()=>({emailOTP:vi.fn(()=>({})),oneTimeToken:vi.fn(()=>({}))}));
import { createAuth } from '../../lib/account/auth.server.js';
it('trusts only the exact Oracle native origin while retaining CSRF protection',()=>{
  createAuth({BETTER_AUTH_URL:'https://mandalacodes.com'});
  const options=capture.mock.calls[0][0];
  expect(options.trustedOrigins).toContain('capacitor://localhost');
  expect(options.trustedOrigins.filter((origin:string)=>origin.startsWith('capacitor:'))).toEqual(['capacitor://localhost']);
  expect(options.advanced.disableOriginCheck).toBeUndefined();
  expect(options.advanced.disableCSRFCheck).toBeUndefined();
});
