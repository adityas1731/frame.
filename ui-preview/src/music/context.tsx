import {createContext,useContext,useEffect,useMemo,useSyncExternalStore,type ReactNode} from 'react';
import {useConnection} from '../jellyfin/useConnection';
import {MusicController,emptyMusicState,type MusicState} from './controller';
import {mediaFocus} from '../playback/mediaFocus';
import {musicTitle,musicArtist} from './presentation';
const empty=emptyMusicState();
const Context=createContext<{controller:MusicController|null;state:MusicState}>({controller:null,state:empty});
let sessionOwner:MusicController|undefined;
export function MusicProvider({children}:{children:ReactNode}){
 const {client,session,unavailable}=useConnection();
 const mediaOwner=useSyncExternalStore(mediaFocus.subscribe,mediaFocus.snapshot);
 const controller=useMemo(()=>client&&session?new MusicController(client,session):null,[client,session]);
 const state=useSyncExternalStore(controller?.subscribe??(()=>()=>{}),controller?.snapshot??(()=>empty));
 useEffect(()=>{controller?.mount();const leaving=()=>{void controller?.stop(true);};window.addEventListener('pagehide',leaving);return()=>{window.removeEventListener('pagehide',leaving);void controller?.dispose();};},[controller]);
 useEffect(()=>{if(unavailable)void controller?.stop();},[controller,unavailable]);
 useEffect(()=>{
  if(!controller||!('mediaSession' in navigator)||mediaOwner!==controller)return;
  const media=navigator.mediaSession;sessionOwner=controller;
  const handlers:Partial<Record<MediaSessionAction,MediaSessionActionHandler>>={play:()=>{void controller.resume();},pause:()=>controller.pause(),previoustrack:()=>{void controller.previous();},nexttrack:()=>{void controller.next();},seekto:details=>{if(details.seekTime!==undefined)controller.seek(details.seekTime);},seekbackward:details=>controller.seek(controller.snapshot().position-(details.seekOffset??10)),seekforward:details=>controller.seek(controller.snapshot().position+(details.seekOffset??10)),stop:()=>{void controller.stop();}};
  for(const [action,handler] of Object.entries(handlers))try{media.setActionHandler(action as MediaSessionAction,handler);}catch{/* Optional browser action. */}
  return()=>{if(sessionOwner!==controller)return;sessionOwner=undefined;for(const action of Object.keys(handlers))try{media.setActionHandler(action as MediaSessionAction,null);}catch{/* Optional browser action. */}media.metadata=null;media.playbackState='none';};
 },[controller,mediaOwner]);
 const track=state.entries.find(e=>e.key===state.current)?.item;
 useEffect(()=>{if(!controller||!track||!('mediaSession' in navigator)||mediaOwner!==controller)return;try{if(typeof MediaMetadata!=='undefined')navigator.mediaSession.metadata=new MediaMetadata({title:musicTitle(track),artist:musicArtist(track),album:track.Album??''});navigator.mediaSession.playbackState=state.phase==='playing'?'playing':'paused';if(state.duration>0&&Number.isFinite(state.duration))navigator.mediaSession.setPositionState?.({duration:state.duration,playbackRate:1,position:Math.max(0,Math.min(state.duration,state.position))});}catch{/* System controls never block playback. */}},[controller,mediaOwner,track,state.phase,state.position,state.duration]);
 return <Context value={{controller,state}}>{children}</Context>;
}
export const useMusic=()=>useContext(Context);
