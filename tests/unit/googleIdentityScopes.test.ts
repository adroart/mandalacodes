import {expect,it} from 'vitest';
import {createAuth} from '../../lib/account/auth.server.js';

it('requests only Google login identity without merging previously granted application scopes',async()=>{
 const origin='https://mandalacodes.com';
 const auth=createAuth({BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:'local-test-secret-not-used-in-production',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'});
 const result=await auth.api.signInSocial({headers:new Headers({Origin:origin}),body:{provider:'google',callbackURL:origin+'/account',disableRedirect:true,scopes:['https://www.googleapis.com/auth/youtube','https://www.googleapis.com/auth/drive.file']},returnHeaders:true});
 const target=new URL(result.response.url);
 expect(target.origin).toBe('https://accounts.google.com');
 expect(target.searchParams.get('include_granted_scopes')).toBe('false');
 expect(target.searchParams.get('scope')?.split(' ').sort()).toEqual(['email','openid','profile']);
 expect(target.searchParams.get('redirect_uri')).toBe(origin+'/api/auth/callback/google');
 expect(target.searchParams.get('state')).toBeTruthy();
 expect(target.searchParams.get('code_challenge')).toBeTruthy();
 expect(target.searchParams.get('code_challenge_method')).toBe('S256');
 expect(result.headers.getSetCookie().some(cookie=>cookie.includes('oauth_state'))).toBe(true);
});
