import { useCallback, useEffect, useState } from 'react';
import { ServerArtwork } from './ServerArtwork';
import { imageSource } from '../jellyfin/presentation';
import type { ItemDto } from '../jellyfin/types';
import type { OnlineMetadata } from '../providers/metadata';
import {useCustomArtwork,useProviderArtworkChoice} from './useArtworkChoice';
import {useProviderBanner} from './bannerArtworkPolicy';
import {useArtworkRevision} from '../providers/artworkRefresh';
export function DetailArtwork({ item, online }: { item: ItemDto; online?:OnlineMetadata|null }) {
  const choice=useProviderArtworkChoice(item);const custom=useCustomArtwork(item,'banner');
  const revision=useArtworkRevision(item.Id);
  const landscape=imageSource(item,true);const thumb=imageSource(item,false,'Thumb');const poster=imageSource(item);
  const qualityKey=JSON.stringify([item.Id,landscape,thumb,revision]);
  const [quality,setQuality]=useState<{id:string;width:number}>({id:qualityKey,width:-1});const [failed,setFailed]=useState<string[]>([]);
  const report=useCallback((width:number)=>setQuality({id:qualityKey,width}),[qualityKey]);
  useEffect(()=>{setFailed([]);},[item.Id,online?.backdrop,revision]);
  const width=quality.id===qualityKey?quality.width:-1;
  const chosen=choice.url&&!failed.includes(choice.url)?choice.url:undefined;
  const local=custom.url&&!failed.includes(custom.url)?custom.url:undefined;
  const backdrop=[local,chosen,online?.backdrop,online?.backdropFallback].find(url=>url&&!failed.includes(url));
  const fromTvmaze=backdrop?.startsWith('https://static.tvmaze.com/');
  const tmdb=Object.entries(item.ProviderIds??{}).find(([key])=>key.toLowerCase()==='tmdb')?.[1];
  const source=(fromTvmaze?online?.source:online?.artworkSource||online?.source)||(tmdb&&/^[1-9]\d*$/.test(tmdb)?`https://www.themoviedb.org/${item.Type==='Movie'?'movie':'tv'}/${tmdb}`:undefined);
  const useOnline=!!backdrop && useProviderBanner(!!local||!!chosen,!!landscape||!!thumb,width);
  return <div className="detail-visual">
    {useOnline?<><img className="online-backdrop" src={backdrop} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(values=>[...new Set([...values,backdrop!])])}/>{!local&&source&&<a className="artwork-source" href={source} target="_blank" rel="noreferrer" title={online?.artworkLabel ?? 'TMDB via Jellyfin'}>Artwork · {(fromTvmaze?'TVmaze':online?.artworkLabel ?? 'TMDB').replace(/ via Jellyfin$/i,'')}</a>}</>:landscape?<ServerArtwork item={item} backdrop fit="cover" focal={0} onQuality={report}/>:thumb?<ServerArtwork item={item} artwork="Thumb" fit="cover" focal={0} onQuality={report}/>:poster||online?.poster?<><div className="detail-poster-wash"><ServerArtwork item={item}/></div><div className="detail-poster-fallback"><ServerArtwork item={item} fit="contain"/></div></>:<div className="detail-art-missing"/>}
  </div>;
}
