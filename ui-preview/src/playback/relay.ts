import {FRAME_VERSION} from '../version.ts';
import type {Session} from '../jellyfin/types.ts';
import {hosting} from '../build/hosting.ts';
import {cleanMediaUrl} from '../../public/frame-stream-policy.js';
import {PlaybackError} from './protocol.ts';

export function relayResource(raw:string,base:string,item:string) {
 const text=cleanMediaUrl(raw,base,item);
 return btoa(String.fromCharCode(...new TextEncoder().encode(text))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
/** Account credentials are used only on authenticated control requests. Native
 * media and HLS use a short lease cookie, never the general Jellyfin token. */
export async function createRelay(session:Session,itemId:string,signal:AbortSignal,baseURI:string,fetcher:typeof fetch=fetch) {
 const host=hosting(baseURI);
 if(host.serverUrl!==session.baseUrl.replace(/\/+$/,''))throw new PlaybackError('Open frame. from the Jellyfin server you are signed into to enable its playback relay.');
 const headers={Authorization:`MediaBrowser Client="frame.", Device="frame.", DeviceId="${encodeURIComponent(session.deviceId)}", Version="${FRAME_VERSION}", Token="${encodeURIComponent(session.token)}"`,'X-Frame-Request':'1','Content-Type':'application/json'};
 const endpoint=session.baseUrl+'/Frame/Media';
 let id='',closed=false,timer:ReturnType<typeof setInterval>|undefined;
 // Non-CORS lease mutations need an explicit same-origin policy: no-referrer
 // serializes their Origin as null, which the server correctly rejects.
 const request=(url:string,method:string,body?:unknown,keepalive=false)=>fetcher(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',mode:'same-origin',redirect:'error',referrerPolicy:'same-origin',cache:'no-store',keepalive});
 const close=()=>{if(closed)return;closed=true;clearInterval(timer);signal.removeEventListener('abort',close);if(id)void request(`${endpoint}/${id}/lease`,'DELETE',undefined,true).catch(()=>{});};
 try {
  const response=await request(endpoint,'POST',{ItemId:itemId});
  if(!response.ok){
   const messages:Record<string,string>={
    'frame-relay-origin':'The server rejected the player origin. Open frame. and sign in using the same server address.',
    'frame-relay-item':'The player sent an invalid media identifier. Return to the library and open the title again.',
    'frame-relay-listener':'frame. could not locate Jellyfin’s local HTTP listener. The server plugin needs an update.',
    'frame-relay-upstream':'frame. could not reach Jellyfin through the server’s own connection. Check the server plugin configuration.',
    'frame-relay-timeout':'Jellyfin took too long to authorize the player. Retry when the server is responsive.',
    'frame-relay-response':'Jellyfin returned an unexpected authorization response. Check plugin and server version compatibility.'};
   let code='';try{const data:unknown=await response.json();if(data&&typeof data==='object'&&'code'in data&&typeof data.code==='string')code=data.code;}catch{/* Only allowlisted codes are displayed. */}
   throw new PlaybackError(messages[code]??(response.status===404?'This server needs the matching frame. playback-relay plugin update.':response.status===401||response.status===403?'Jellyfin did not authorize playback for this account and item.':response.status===429?'Too many active frame. players. Close another player and retry.':`The frame. playback relay returned HTTP ${response.status}. Check the server plugin, then retry.`));
  }
  const value:unknown=await response.json();
  if(!value||typeof value!=='object'||!('grantId' in value)||typeof value.grantId!=='string'||!/^[a-f0-9]{32}$/.test(value.grantId))throw new PlaybackError('The server returned an invalid playback lease.');
  id=value.grantId;
  signal.addEventListener('abort',close,{once:true});if(signal.aborted){close();throw new PlaybackError('Player connection closed.');}
  timer=setInterval(()=>{void request(`${endpoint}/${id}/lease`,'PUT').then(response=>{if(!response.ok)close();},close);},40000);
  const url=(raw:string)=>{if(closed)throw new PlaybackError('Player connection closed.');return `${endpoint}/${id}/stream?resource=${relayResource(raw,session.baseUrl,itemId)}`;};
  const authorizeHls=(raw:string)=>{
   const target=new URL(raw,host.appUrl);
   if(target.origin!==new URL(endpoint).origin||target.pathname!==new URL(`${endpoint}/${id}/stream`).pathname||target.username||target.password||target.hash||target.searchParams.size!==1||!target.searchParams.has('resource'))throw new PlaybackError('HLS requested media outside this playback lease.');
   const encoded=target.searchParams.get('resource')!;if(!/^[a-zA-Z0-9_-]{1,12000}$/.test(encoded))throw new PlaybackError('HLS returned an invalid media resource.');
   try {const text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)));return url(text);}catch{throw new PlaybackError('HLS returned an invalid media resource.');}
  };
  return {url,close,authorizeHls};
 }catch(error){close();if(error instanceof PlaybackError)throw error;throw new PlaybackError('The frame. playback relay could not connect. Retry when the server is available.');}
}
