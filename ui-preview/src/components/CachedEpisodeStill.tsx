import {useEffect,useState} from 'react';
import {episodeImages} from '../providers/episodeImages';
import {publicProviderCache} from '../providers/publicCache';

export function CachedEpisodeStill({source,onFailure}:{source:string;onFailure:()=>void}){
 const [image,setImage]=useState<{source:string;url:string}>();
 const [direct,setDirect]=useState('');
 const synthetic=import.meta.env.DEV&&source.startsWith('data:image/svg+xml,');
 useEffect(()=>{
  if(synthetic)return;
  let active=true,url:string|undefined;
  episodeImages.load(source).then(blob=>{if(active){url=URL.createObjectURL(blob);setImage({source,url});}},()=>{if(active)setDirect(source);});
  return()=>{active=false;if(url)URL.revokeObjectURL(url);};
 },[source,onFailure,synthetic]);
 // A blocked byte-cache request must not prevent ordinary public image display.
 if(synthetic||direct===source)return <img src={source} alt="" referrerPolicy="no-referrer" onError={onFailure}/>;
 return image?.source===source?<img src={image.url} alt="" onError={()=>{void publicProviderCache.remove(`image:${source}`);setDirect(source);}}/>:<div className="episode-artwork-placeholder" role="status" aria-label="Loading episode artwork"/>;
}
