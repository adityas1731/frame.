import {cleanMediaUrl,rewritePlaylist} from './frame-stream-policy.js';
// Policy revision 2026-10-24: compact/dashed Jellyfin GUID equivalence.
const appScope=new URL(".",self.location.href).pathname;
const mediaPrefix=appScope+"__frame_media/";
const grants=new Map();const waiting=new Map();
function releaseBody(response,grant,controller,release){
 if(!response.body){release();return null;}
 const reader=response.body.getReader();
 return new ReadableStream({async pull(output){try{const chunk=await reader.read();if(chunk.done){release();output.close();}else output.enqueue(chunk.value);}catch{release();output.error(Error('Media stream interrupted'));}},cancel(){release();controller.abort();return reader.cancel();}});
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
 const source=event.source;const data=event.data;
 for(const [key,grant] of grants)if(grant.expires<Date.now()){grant.controllers.forEach(c=>c.abort());grants.delete(key);}
 if(!source?.id||new URL(source.url).origin!==self.location.origin||!new URL(source.url).pathname.startsWith(appScope)||!data||typeof data.nonce!=='string')return;
 const key=source.id+':'+data.nonce;
 if(data.type==='frame:close'){const grant=grants.get(key);grant?.controllers.forEach(c=>c.abort());grants.delete(key);return;}
 if(data.type!=='frame:open'||!/^[a-zA-Z0-9-]{16,100}$/.test(data.nonce)||typeof data.token!=='string'||!data.token||typeof data.deviceId!=='string'||typeof data.itemId!=='string'||!/^[a-z0-9-]+$/i.test(data.itemId))return;
 try{
  const base=new URL(data.baseUrl);if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||self.location.protocol==='https:'&&base.protocol!=='https:')throw Error('base');
  const requestBase=data.proxy===true&&data.baseUrl==='http://localhost:8096'?self.location.origin+'/__frame_jellyfin':data.fixture===true&&data.baseUrl==='https://frame-fixture.invalid'?self.location.origin+'/__frame_fixture':data.baseUrl;
  const old=grants.get(key);grants.set(key,{...data,requestBase,controllers:old?.controllers??new Set(),expires:Date.now()+1800000});
  waiting.get(key)?.();waiting.delete(key);event.ports?.[0]?.postMessage({ok:true});
 }catch{event.ports?.[0]?.postMessage({ok:false});}
});
async function grantFor(clientId,nonce){
 const key=clientId+':'+nonce;let grant=grants.get(key);
 if(!grant||grant.expires<Date.now()){
  const client=await self.clients.get(clientId);if(!client)return null;
  // A browser can restart an idle worker. Ask the still-open owning player to regrant from page memory.
  await new Promise(resolve=>{const timer=setTimeout(()=>{waiting.delete(key);resolve();},2500);waiting.set(key,()=>{clearTimeout(timer);resolve();});client.postMessage({type:'frame:need',nonce});});grant=grants.get(key);
 }
 return grant&&grant.expires>=Date.now()?grant:null;
}
self.addEventListener('fetch',event=>{
 const local=new URL(event.request.url);if(local.origin!==self.location.origin||!local.pathname.startsWith(mediaPrefix))return;
 event.respondWith((async()=>{
  if(!['GET','HEAD'].includes(event.request.method))return new Response('Media read only',{status:405});
  let grant,controller;let release=()=>{};
  try{
   const match=local.pathname.slice(mediaPrefix.length).match(/^([^/]+)\/([^/]+)\/stream\.(?:mp4|webm|m4v|m3u8|ts|m4s|vtt)$/);if(!match||local.search)return new Response('Invalid media request',{status:400});
   const nonce=decodeURIComponent(match[1]);grant=await grantFor(event.clientId,nonce);if(!grant)return new Response('Player connection unavailable',{status:403});
   const relative=cleanMediaUrl(decodeURIComponent(match[2]),grant.baseUrl,grant.itemId);
   const target=grant.requestBase.replace(/\/+$/,'')+'/'+relative;const canonical=grant.baseUrl.replace(/\/+$/,'')+'/'+relative;
   const headers=new Headers({Accept:'*/*'});headers.set('Authorization',`MediaBrowser Client="Frame", Device="Frame Browser", DeviceId="${encodeURIComponent(grant.deviceId)}", Version="0.1.0", Token="${encodeURIComponent(grant.token)}"`);
   for(const key of ['Range','If-Range']){const value=event.request.headers.get(key);if(value)headers.set(key,value);}
   controller=new AbortController();grant.controllers.add(controller);grant.expires=Date.now()+1800000;
   const abortRequest=()=>controller.abort();event.request.signal.addEventListener('abort',abortRequest,{once:true});if(event.request.signal.aborted)abortRequest();
   release=()=>{grant.controllers.delete(controller);event.request.signal.removeEventListener('abort',abortRequest);};
   const response=await fetch(target,{method:event.request.method,headers,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal:controller.signal});
   if(!response.ok){release();void response.body?.cancel();return new Response(response.status===401?'Session expired':'Media request failed',{status:response.status,headers:{'Cache-Control':'no-store'}});}
   const output=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
   for(const key of ['Content-Type','Content-Length','Content-Range','Accept-Ranges','ETag','Last-Modified']){const value=response.headers.get(key);if(value)output.set(key,value);}
   if(response.status===206&&!output.has('Content-Range')){release();void response.body?.cancel();return new Response('Range headers unavailable. Check server CORS configuration.',{status:502});}
   if(relative.split('?')[0].endsWith('.m3u8')){
    const text=rewritePlaylist(await response.text(),canonical,grant.baseUrl,grant.itemId,nonce,appScope);release();output.delete('Content-Length');output.set('Content-Type','application/vnd.apple.mpegurl');return new Response(text,{status:response.status,headers:output});
   }
   return new Response(releaseBody(response,grant,controller,release),{status:response.status,headers:output});
  }catch{if(controller){controller.abort();release();}return new Response('Media connection failed',{status:502,headers:{'Cache-Control':'no-store'}});}
 })());
});
