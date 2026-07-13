import { admin, isAuthResponse, json, type ReflectionContext } from './_shared';
export async function onRequestGet({ request, env }: ReflectionContext): Promise<Response> { const auth = await admin(request, env); return isAuthResponse(auth) ? auth : json({ ok: true, admin: true }); }
