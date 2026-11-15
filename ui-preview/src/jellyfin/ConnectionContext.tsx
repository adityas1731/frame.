import {ConnectionMachine,connectionUnavailable,type ConnectionMemory} from './connectionMachine';
import {randomId} from '../platform/browser.ts';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { JellyfinClient, JellyfinError, normalizeServerUrl } from './client';
import { loadSession, saveSession, loadRememberedSession, saveRememberedSession } from './session';
import type { Fetcher, Session } from './types';
import { ConnectionContext as Context } from './context';
const tabStore = { getItem:(k:string)=>sessionStorage.getItem(k),setItem:(k:string,v:string)=>sessionStorage.setItem(k,v),removeItem:(k:string)=>sessionStorage.removeItem(k) };
const deviceStore = { getItem:(k:string)=>localStorage.getItem(k),setItem:(k:string,v:string)=>localStorage.setItem(k,v),removeItem:(k:string)=>localStorage.removeItem(k) };
type SessionStorage=import('./session').SessionStore;
type Stores={tab:SessionStorage;device:SessionStorage};
function initialSession(stores:Stores){const device=loadRememberedSession(stores.device);return device??((session)=>session?{session,allowHttp:session.baseUrl.startsWith('http:')}:null)(loadSession(stores.tab));}
export function ConnectionProvider({children,storage}:{children:ReactNode;storage?:Stores}) {
 const [stores]=useState(()=>storage??{tab:tabStore,device:deviceStore});
 const [initial]=useState(()=>initialSession(stores));
 const [machine]=useState(()=>new ConnectionMachine<JellyfinClient,Session>(initial?.session??null));
 const state=useSyncExternalStore(machine.subscribe,machine.snapshot);
 const {active,saved,remembered,message}=state;
 const restoring=state.phase==='restoring',unavailable=connectionUnavailable(state);
 function clearSaved(){saveRememberedSession(stores.device,null);saveSession(stores.tab,null);}
 function forget(){clearSaved();machine.forget();}
 function rawClient(url:string,transport?:Fetcher,deviceId:string=randomId()) {
  const client=new JellyfinClient(url,deviceId,transport,()=>{
   if(machine.expire(client,'Your Jellyfin session expired or was revoked. Sign in again from Server connection.'))clearSaved();
  });return client;
 }
 function createClient(url:string,transport?:Fetcher,deviceId?:string){
  const operation=machine.begin('connecting');const client=rawClient(url,transport,deviceId);machine.attach(operation,client);return client;
 }
 function persist(session:Session,remember:boolean):ConnectionMemory<Session>{
  saveSession(stores.tab,null);
  if(remember&&saveRememberedSession(stores.device,session))return {saved:session,remembered:true,message:''};
  clearSaved();return {saved:null,remembered:false,message:remember?'Device storage is unavailable. You are signed in for this page session only.':''};
 }
 function activate(client:JellyfinClient,session:Session,remember:boolean){
  if(!machine.owns(client)){client.dispose();return false;}
  return machine.accept(client,session,persist(session,remember));
 }
 function rememberCurrent(remember:boolean){const current=machine.snapshot().active;if(current)machine.remember(persist(current.session,remember));}
 async function restore(session:Session,allowHttp:boolean,remember=true){
  const operation=machine.begin('restoring');
  try {
   const base=normalizeServerUrl(session.baseUrl,allowHttp,location.protocol);
   let transport:Fetcher|undefined;
   if(base==='https://frame-fixture.invalid'){
    if(!import.meta.env.DEV)throw new JellyfinError(409,'Simulated sessions are unavailable in production.');
    transport=(await import('./fixtures')).createFixtureFetch(session.server.Version);
   }
   if(!machine.current(operation))return;
   const client=rawClient(base,transport,session.deviceId);if(!machine.attach(operation,client))return;client.restore(session);
   const user=await client.validateSession(session);
   if(machine.current(operation))activate(client,{...session,user},remember);
  }catch(error){
   const invalid=error instanceof JellyfinError&&[401,403,409].includes(error.status);
   if(machine.reject(operation,invalid,invalid?'The saved Jellyfin session is no longer valid. Sign in again.':'Jellyfin is unavailable. Your saved sign-in is kept. Reconnect when your server is back.')&&invalid)clearSaved();
  }
 }
 async function resumeSaved(){const current=machine.snapshot();const session=current.active?.session??current.saved;if(session)await restore(session,session.baseUrl.startsWith('http:'),current.active?current.remembered:true);}
 function reportUnavailable(source:JellyfinClient){machine.unavailable(source);}
 function cancelClient(client:JellyfinClient){machine.cancel(client);}
 function showSignIn(){machine.cancel();window.location.hash='/connect';}
 useEffect(()=>{
  if(initial)void restore(initial.session,initial.allowHttp);
  return()=>{machine.cancel();};
 },[]);
 async function disconnect(){
  const {old,operation}=machine.signOut();clearSaved();
  if(old)try{await old.client.logout();}catch{machine.logoutFailed(operation,'Signed out locally. Server logout could not be confirmed; revoke the session in Jellyfin if necessary.');}
 }
 return <Context value={{client:active?.client??null,session:active?.session??null,saved,message,restoring,remembered,rememberCurrent,resumeSaved,createClient,activate,cancelClient,disconnect,forget,unavailable,reportUnavailable}}>{restoring?<main className="session-restoring" aria-busy="true"><h1>Connecting To Jellyfin</h1><p role="status">Checking your saved sign-in…</p><button className="button secondary" onClick={showSignIn}>Connection Settings</button></main>:children}</Context>;
}
