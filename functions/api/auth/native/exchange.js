import { nativeGoogleAuth } from '../../../../lib/account/nativeGoogleAuth.server.js';
export function onRequest(context) { return nativeGoogleAuth(context, 'exchange'); }
