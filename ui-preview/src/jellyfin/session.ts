import { normalizeServerUrl, parseServer, parseUser } from './client.ts';
import type { Session } from './types.ts';
export const sessionKey = 'frame.jellyfin.session.v1';
export const rememberedSessionKey = 'frame.jellyfin.remembered.v1';
export interface SessionStore { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
/** Allowlist fields: passwords and unrelated runtime state must never be persisted. */
function storedSession(session:Session):Session {
  return {baseUrl:normalizeServerUrl(session.baseUrl,true),token:session.token,deviceId:session.deviceId,created:session.created,server:parseServer(session.server),user:parseUser(session.user)};
}
export function saveRememberedSession(store:SessionStore, session:Session|null):boolean {
  try {
    if(session){const value=storedSession(session);store.setItem(rememberedSessionKey,JSON.stringify({version:1,allowHttp:value.baseUrl.startsWith('http:'),session:value}));}
    else store.removeItem(rememberedSessionKey);
    return true;
  }catch{return false;}
}
export function loadRememberedSession(store:SessionStore):{session:Session;allowHttp:boolean}|null {
  try {
    const value=JSON.parse(store.getItem(rememberedSessionKey)??'null');
    if(!value)return null;
    const s=value.session;
    if(value.version!==1||!s||typeof s.token!=='string'||!s.token.trim()||typeof s.deviceId!=='string'||!s.deviceId||typeof s.created!=='number'||!Number.isFinite(s.created)||s.created>Date.now()+300000)throw Error('Invalid saved session');
    const session=storedSession(s);
    if(session.baseUrl.startsWith('http:')&&value.allowHttp!==true)throw Error('HTTP consent missing');
    if(session.user.Policy?.IsDisabled)throw Error('Account disabled');
    // Server validation governs expiry/revocation, rather than a short client-only timeout.
    return {session,allowHttp:value.allowHttp===true};
  }catch{saveRememberedSession(store,null);return null;}
}
export function saveSession(store: SessionStore, session: Session | null): boolean {
  try { if (session) store.setItem(sessionKey, JSON.stringify(session)); else store.removeItem(sessionKey); return true; } catch { return false; }
}
export function loadSession(store: SessionStore): Session | null {
  try {
    const value = JSON.parse(store.getItem(sessionKey) ?? 'null');
    if (!value || typeof value.baseUrl !== 'string' || typeof value.token !== 'string' || !value.token || typeof value.deviceId !== 'string' || typeof value.created !== 'number' || Date.now() - value.created > 12 * 60 * 60 * 1000) { saveSession(store, null); return null; }
    return { ...value, server: parseServer(value.server), user: parseUser(value.user) };
  } catch { saveSession(store, null); return null; }
}
