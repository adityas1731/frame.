import {createRelay} from './relay.ts';
import {streamingRequirement,randomId} from '../platform/browser.ts';
import type {Session} from '../jellyfin/types.ts';
import {cleanMediaUrl,gatewayPath} from '../../public/frame-stream-policy.js';
import {PlaybackError} from './protocol.ts';
import {hosting} from '../build/hosting.ts';
export interface MediaGateway {url:(raw:string)=>string;close:()=>void;authorizeHls?:(raw:string)=>string}
export async function createMediaGateway(session:Session,itemId:string,signal:AbortSignal):Promise<MediaGateway>{
 if(hosting(document.baseURI).serverUrl===session.baseUrl.replace(/\/+$/,''))return createRelay(session,itemId,signal,document.baseURI);
 const requirement=streamingRequirement(globalThis.isSecureContext===true,'serviceWorker' in navigator);if(requirement)throw new PlaybackError(requirement);
 const host=hosting(document.baseURI);
 const registration=await navigator.serviceWorker.register(new URL('frame-stream-sw.js',host.appUrl),{type:'module',scope:host.scope,updateViaCache:'none'});await navigator.serviceWorker.ready;
 if(!navigator.serviceWorker.controller)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(new PlaybackError('Reload Frame once to enable authenticated streaming.'));},10000);const changed=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve();};navigator.serviceWorker.addEventListener('controllerchange',changed);if(navigator.serviceWorker.controller)changed();});
 const nonce=randomId();const payload={type:'frame:open',nonce,baseUrl:session.baseUrl,deviceId:session.deviceId,token:session.token,itemId,proxy:import.meta.env.DEV&&session.baseUrl==='http://localhost:8096',fixture:import.meta.env.DEV&&session.baseUrl==='https://frame-fixture.invalid'};
 if(session.baseUrl==='https://frame-fixture.invalid'&&!import.meta.env.DEV)throw new PlaybackError('The synthetic media fixture is development-only.');
 const worker=navigator.serviceWorker.controller??registration.active;if(!worker||signal.aborted)throw new PlaybackError('Player connection closed.');
 let closed=false;
 const listener=(event:MessageEvent)=>{if(!closed&&event.data?.type==='frame:need'&&event.data.nonce===nonce)(event.source as ServiceWorker|null)?.postMessage(payload);};
 navigator.serviceWorker.addEventListener('message',listener);
 const close=()=>{if(closed)return;closed=true;navigator.serviceWorker.removeEventListener('message',listener);(navigator.serviceWorker.controller??worker).postMessage({type:'frame:close',nonce});signal.removeEventListener('abort',close);};
 try{await new Promise<void>((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();reject(new PlaybackError('Streaming authorization timed out.'));},5000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data?.ok?resolve():reject(new PlaybackError('Streaming authorization failed.'));};worker.postMessage(payload,[channel.port2]);});}catch(error){close();throw error;}
 signal.addEventListener('abort',close,{once:true});if(signal.aborted){close();throw new PlaybackError('Player connection closed.');}
 return{url:raw=>{if(closed)throw new PlaybackError('Player connection closed.');return gatewayPath(nonce,cleanMediaUrl(raw,session.baseUrl,itemId),host.scope);},close};
}
