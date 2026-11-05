import {randomId} from '../platform/browser.ts';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { JellyfinClient, JellyfinError, normalizeServerUrl } from './client';
import { loadSession, saveSession, loadRememberedSession, saveRememberedSession } from './session';
import type { Fetcher, Session } from './types';
import { ConnectionContext as Context } from './context';
const tabStore = { getItem:(k:string)=>sessionStorage.getItem(k),setItem:(k:string,v:string)=>sessionStorage.setItem(k,v),removeItem:(k:string)=>sessionStorage.removeItem(k) };
const deviceStore = { getItem:(k:string)=>localStorage.getItem(k),setItem:(k:string,v:string)=>localStorage.setItem(k,v),removeItem:(k:string)=>localStorage.removeItem(k) };
function initialSession(){const device=loadRememberedSession(deviceStore);return device??((session)=>session?{session,allowHttp:session.baseUrl.startsWith('http:')}:null)(loadSession(tabStore));}
export function ConnectionProvider({children}:{children:ReactNode}) {
 const [initial]=useState(initialSession);
 const [active,setActive]=useState<{client:JellyfinClient;session:Session}|null>(null);const activeRef=useRef(active);
 const [saved,setSaved]=useState<Session|null>(initial?.session??null);
 const [remembered,setRemembered]=useState(!!initial);
 const [restoring,setRestoring]=useState(!!initial);
 const [message,setMessage]=useState('');
 const generation=useRef(0);const pending=useRef<JellyfinClient|null>(null);
 function forget(){saveRememberedSession(deviceStore,null);saveSession(tabStore,null);setSaved(null);setRemembered(false);}
 function createClient(url:string,transport?:Fetcher,deviceId:string=randomId()) {
  const client=new JellyfinClient(url,deviceId,transport,()=>{
   if(activeRef.current?.client===client){client.dispose();activeRef.current=null;setActive(null);forget();setMessage('Your Jellyfin session expired or was revoked. Sign in again from Server connection.');}
  });return client;
 }
 function persist(session:Session,remember:boolean){
  saveSession(tabStore,null);
  if(remember&&saveRememberedSession(deviceStore,session)){setSaved(session);setRemembered(true);}
  else {forget();if(remember)setMessage('Device storage is unavailable. You are signed in for this page session only.');}
 }
 function activate(client:JellyfinClient,session:Session,remember:boolean){
  const old=activeRef.current;if(old&&old.client!==client)old.client.dispose();
  const next={client,session};activeRef.current=next;setActive(next);setMessage('');persist(session,remember);
 }
 function rememberCurrent(remember:boolean){const current=activeRef.current;if(current){setMessage('');persist(current.session,remember);}}
 async function restore(session:Session,allowHttp:boolean){
  const turn=++generation.current;pending.current?.dispose();setRestoring(true);setMessage('');
  let client:JellyfinClient|undefined;
  try {
   const base=normalizeServerUrl(session.baseUrl,allowHttp,location.protocol);
   let transport:Fetcher|undefined;
   if(base==='https://frame-fixture.invalid'){
    if(!import.meta.env.DEV)throw new JellyfinError(409,'Simulated sessions are unavailable in production.');
    transport=(await import('./fixtures')).createFixtureFetch(session.server.Version);
   }
   if(turn!==generation.current)return;
   client=createClient(base,transport,session.deviceId);pending.current=client;client.restore(session);
   const user=await client.validateSession(session);
   if(turn!==generation.current){client.dispose();return;}
   pending.current=null;activate(client,{...session,user},true);client=undefined;
  }catch(error){
   client?.dispose();
   if(turn!==generation.current)return;
   if(error instanceof JellyfinError&&[401,403,409].includes(error.status)){forget();setMessage('The saved Jellyfin session is no longer valid. Sign in again.');}
   else setMessage('Jellyfin is unavailable. Your saved sign-in is kept. Reconnect when your server is back.');
  }finally{if(turn===generation.current){pending.current=null;setRestoring(false);}}
 }
 async function resumeSaved(){if(saved)await restore(saved,saved.baseUrl.startsWith('http:'));}
 function useMock(){generation.current++;pending.current?.dispose();pending.current=null;setRestoring(false);setMessage('Automatic connection paused for this visit. Your remembered sign-in is still available in Server connection.');}
 useEffect(()=>{
  if(initial)void restore(initial.session,initial.allowHttp);
  return()=>{generation.current++;pending.current?.dispose();pending.current=null;};
 },[]);
 async function disconnect(){
  generation.current++;pending.current?.dispose();pending.current=null;setRestoring(false);
  const old=activeRef.current;activeRef.current=null;setActive(null);forget();setMessage('');
  if(old)try{await old.client.logout();}catch{setMessage('Signed out locally. Server logout could not be confirmed; revoke the session in Jellyfin if necessary.');}
 }
 return <Context value={{client:active?.client??null,session:active?.session??null,saved,message,restoring,remembered,rememberCurrent,resumeSaved,createClient,activate,disconnect,forget}}>{restoring?<main className="session-restoring" aria-busy="true"><h1>Welcome Back.</h1><p role="status">Restoring your Jellyfin connection…</p><button className="button secondary" onClick={useMock}>Use mock mode for now</button></main>:children}</Context>;
}
