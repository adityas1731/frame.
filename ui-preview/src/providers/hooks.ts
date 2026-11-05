import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import { useEffect, useRef, useState } from 'react';
import {episodeArtworkCandidates} from '../components/episodeArtworkPolicy';
import type { ItemDto } from '../jellyfin/types';
import { useOnline } from './context';
import { mergeMetadata, ProviderError, type OnlineMetadata } from './metadata';
export function useRichItem(item?:ItemDto, parent?:ItemDto, enabled=true) {
  const {client}=useOnline();const key=JSON.stringify([item?.Id,item?.Name,item?.Type,item?.ProviderIds,item?.ParentIndexNumber,item?.IndexNumber,item?.IndexNumberEnd,parent?.ProviderIds,parent?.DisplayOrder,item?.PremiereDate]);
  const [state,setState]=useState<{client:typeof client;key:string;online?:OnlineMetadata|null;error?:string}>({client:null,key:''});
  const [recovery,setRecovery]=useState(0);
  const attempts=useRef(0);
  useEffect(()=>{attempts.current=0;},[client,key]);
  useEffect(()=>{let ignore=false;if(!client||!item||!enabled)return;
    client.enrich(item,parent).then(online=>{if(!ignore)setState({client,key,online});},error=>{if(!ignore)setState({client,key,error:error instanceof ProviderError?error.message:'Online metadata unavailable.'});});return()=>{ignore=true;};
  },[client,key,enabled,recovery]);
  const visible=state.client===client&&state.key===key?state:undefined;
  const online=client?visible?.online:undefined;
  // Bounded automatic recovery for unavailable episode images, never a library refresh.
  // Shared provider caches deduplicate the show's requests across visible cards.
  const needsArtwork=item?.Type==='Episode'&&!online?.still&&(!episodeArtworkCandidates(item).length||!!visible?.error);
  useEffect(()=>{
    if(!client||!enabled||!visible||!needsArtwork||attempts.current>=3)return;
    let due=false;const notBefore=Date.now()+5500;
    const retry=()=>{if(!due||document.hidden)return;due=false;attempts.current++;setRecovery(value=>value+1);};
    const timer=setTimeout(()=>{due=true;retry();},[5500,15000,121000][attempts.current]);
    const reconnected=()=>{if(Date.now()<notBefore)return;due=true;retry();};
    window.addEventListener('online',reconnected);document.addEventListener('visibilitychange',retry);
    return()=>{clearTimeout(timer);window.removeEventListener('online',reconnected);document.removeEventListener('visibilitychange',retry);};
  },[client,key,enabled,!!visible,needsArtwork,recovery]);
  return {...(item?mergeMetadata(item,online):{item:undefined,fields:[] as string[]}),online,error:visible?.error,loading:!!client&&enabled&&!visible};
}



/** Display enrichment is independent from playback state and never changes a server DTO. */
export function useEpisodeDetails(item?:ItemDto,enabled=true){
 const {client,session}=useConnection();const seriesId=enabled&&item?.Type==='Episode'?item.SeriesId:undefined;
 const parent=useRemote(`episode-series:${seriesId??''}`,()=>seriesId&&client&&session?client.item(session.user.Id,seriesId):Promise.resolve(undefined),false);
 const rich=useRichItem(item,parent.data,enabled&&item?.Type==='Episode');return {...rich,series:parent.data};
}
