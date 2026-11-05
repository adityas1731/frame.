import {saveEarlyProgress,earlyProgressStore} from '../playback/earlyProgress';
import {useEffect,useRef,useState} from 'react';
import {Check,Circle,LoaderCircle} from 'lucide-react';
import {usePreview} from '../state/PreviewContext';
import {useConnection} from '../jellyfin/useConnection';
import {errorMessage} from '../jellyfin/useConnection';
import type {ItemDto} from '../jellyfin/types';
import {Modal} from './Primitives';
/** Separate from the card's open/play button: activation never navigates or starts playback. */
export function WatchedToggle({item,demoId,title}:{item?:ItemDto;demoId?:string;title:string}){
 const {client,session}=useConnection();const {watched,toggleWatched,notify}=usePreview();
 const [remote,setRemote]=useState(item?.UserData?.Played),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
 const pending=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>setRemote(item?.UserData?.Played),[client,session?.user.Id,item?.Id,item?.UserData?.Played]);
 useEffect(()=>{const changed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.client===client&&detail?.itemId===item?.Id)setRemote(detail.played);};window.addEventListener('frame:watched-updated',changed);return()=>window.removeEventListener('frame:watched-updated',changed);},[client,item?.Id]);
 const played=item?remote:watched.includes(demoId??'');const group=item?.Type==='Series'||item?.Type==='Season';
 const unavailable=!!item&&(!client||!session||played===undefined);
 const action=played?'Mark unwatched':'Mark watched';
 async function commit(){
  if(pending.current||unavailable)return;setConfirm(false);
  if(!item){if(demoId)toggleWatched(demoId);notify(played?'Marked as unwatched':'Marked as watched');return;}
  pending.current=true;setBusy(true);
  try{const result=await client!.setWatched(session!.user.Id,item.Id,!played);if(mounted.current)setRemote(result);saveEarlyProgress(session!,item.Id,0,0,true,earlyProgressStore());window.dispatchEvent(new CustomEvent('frame:watched-updated',{detail:{client,itemId:item.Id,played:result}}));window.dispatchEvent(new Event('frame:playback-updated'));notify(result?'Marked as watched on Jellyfin':'Marked as unwatched on Jellyfin');}
  catch(error){notify(errorMessage(error));}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 return <><button type="button" className={`watched-toggle ${played?'is-watched':''}`} aria-label={`${action}: ${title}`} aria-pressed={!!played} aria-busy={busy} disabled={busy||unavailable} title={unavailable?'Watched status unavailable':`${action}${group?' for all episodes':''}`} onClick={event=>{event.preventDefault();event.stopPropagation();if(group)setConfirm(true);else void commit();}}>{busy?<LoaderCircle size={18} className="watched-spinner"/>:played?<Check size={18}/>:<Circle size={18}/>}</button>{confirm&&<Modal title={`${action} for the whole ${item?.Type==='Season'?'season':'series'}?`} onClose={()=>setConfirm(false)}><p>This applies to all episodes in {title}. Jellyfin may reset their resume progress. It changes viewing history, not title metadata.</p><div className="studio-actions"><button className="button primary" onClick={()=>void commit()}>{action} for all episodes</button><button className="button secondary" onClick={()=>setConfirm(false)}>Cancel</button></div></Modal>}</>;
}
