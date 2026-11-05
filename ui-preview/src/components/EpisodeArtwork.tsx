import {useCallback,useEffect,useRef,useState} from 'react';
import {ImageOff} from 'lucide-react';
import type {ItemDto} from '../jellyfin/types';
import {episodeLabel} from '../providers/metadata';
import {episodeArtworkCandidates,preferEpisodeStill} from './episodeArtworkPolicy';
import {ServerArtwork} from './ServerArtwork';
import {CachedEpisodeStill} from './CachedEpisodeStill';

/** Shared by series grids and the player's episode browser. A broken or portrait
 * local image must not suppress a verified provider's actual episode still. */
export function EpisodeArtwork({item,still,stillFallback}:{item:ItemDto;still?:string;stillFallback?:string}){
 const [failedLocal,setFailedLocal]=useState<string[]>([]);const [failedOnline,setFailedOnline]=useState<string[]>([]);
 const source=episodeArtworkCandidates(item).find(type=>!failedLocal.includes(`${item.Id}:${type}:${item.ImageTags?.[type]}`));
 const key=`${item.Id}:${source}:${source?item.ImageTags?.[source]:''}`;
 const [localQuality,setLocalQuality]=useState<{key:string;width:number}>();
 const quality=useCallback((width:number)=>{if(width===0)setFailedLocal(old=>[...old.slice(-7),key]);else setLocalQuality(old=>old?.key===key&&old.width===width?old:{key,width});},[key]);
 const online=[still,stillFallback].find((url):url is string=>!!url&&!failedOnline.includes(url));
 const failOnline=useCallback(()=>{if(online)setFailedOnline(old=>[...old.slice(-7),online]);},[online]);
 const recoveryAttempts=useRef(0);
 useEffect(()=>{recoveryAttempts.current=0;},[item.Id]);
 const lowResolution=localQuality?.key===key&&preferEpisodeStill(localQuality.width,true);
 const exhausted=(!source||lowResolution&&failedOnline.length>0)&&!online&&!!(episodeArtworkCandidates(item).length||still||stillFallback);
 useEffect(()=>{
  if(!exhausted||recoveryAttempts.current>=3)return;
  let due=false;
  const recover=()=>{if(!due||document.hidden)return;due=false;recoveryAttempts.current++;setFailedLocal([]);setFailedOnline([]);};
  const timer=setTimeout(()=>{due=true;recover();},[5500,15000,60000][recoveryAttempts.current]);
  const reconnected=()=>{due=true;recover();};
  window.addEventListener('online',reconnected);document.addEventListener('visibilitychange',recover);
  return()=>{clearTimeout(timer);window.removeEventListener('online',reconnected);document.removeEventListener('visibilitychange',recover);};
 },[exhausted,item.Id,failedLocal.length,failedOnline.length]);
 if(source&&!preferEpisodeStill(localQuality?.key===key?localQuality.width:undefined,!!online))return <ServerArtwork key={key} item={item} artwork={source==='Thumb'?'Thumb':undefined} allowInherited={false} onQuality={quality}/>;
 if(online)return <CachedEpisodeStill key={online} source={online} onFailure={failOnline}/>;
 return <div className="episode-artwork-placeholder" aria-label={`${episodeLabel(item)} artwork unavailable`}><ImageOff size={28}/></div>;
}

