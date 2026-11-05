import { useCallback, useEffect, useState } from 'react';
import { ServerArtwork } from './ServerArtwork';
import { imageSource } from '../jellyfin/presentation';
import type { ItemDto } from '../jellyfin/types';
import type { OnlineMetadata } from '../providers/metadata';
import {useCustomArtwork,useProviderArtworkChoice} from './useArtworkChoice';
export function DetailArtwork({ item, online }: { item: ItemDto; online?:OnlineMetadata|null }) {
  const choice=useProviderArtworkChoice(item);const custom=useCustomArtwork(item,'banner');
  const landscape=imageSource(item,true);const thumb=imageSource(item,false,'Thumb');const poster=imageSource(item);
  const [quality,setQuality]=useState<{id:string;width:number}>({id:item.Id,width:-1});const [failed,setFailed]=useState('');
  const report=useCallback((width:number)=>setQuality({id:item.Id,width}),[item.Id]);
  useEffect(()=>{setFailed('');},[item.Id,online?.backdrop]);
  const width=quality.id===item.Id?quality.width:-1;
  const chosen=choice.url&&failed!==choice.url?choice.url:undefined;
  const local=custom.url&&failed!==custom.url?custom.url:undefined;
  const backdrop=local??chosen??online?.backdrop;
  const tmdb=Object.entries(item.ProviderIds??{}).find(([key])=>key.toLowerCase()==='tmdb')?.[1];
  const source=online?.artworkSource||online?.source||(tmdb&&/^[1-9]\d*$/.test(tmdb)?`https://www.themoviedb.org/${item.Type==='Movie'?'movie':'tv'}/${tmdb}`:undefined);
  const useOnline=!!backdrop && failed!==backdrop && (!!local||!!chosen||!landscape&&!thumb||width>=0&&(online?.backdropWidth??0)>width);
  return <div className="detail-visual">
    {useOnline?<><img className="online-backdrop" src={backdrop} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(backdrop!)}/>{!local&&source&&<a className="artwork-source" href={source} target="_blank" rel="noreferrer" title={online?.artworkLabel ?? 'TMDB via Jellyfin'}>Artwork · {(online?.artworkLabel ?? 'TMDB').replace(/ via Jellyfin$/i,'')}</a>}</>:landscape?<ServerArtwork item={item} backdrop fit="cover" focal={0} onQuality={report}/>:thumb?<ServerArtwork item={item} artwork="Thumb" fit="cover" focal={0} onQuality={report}/>:poster?<><div className="detail-poster-wash"><ServerArtwork item={item}/></div><div className="detail-poster-fallback"><ServerArtwork item={item} fit="contain"/></div></>:<div className="detail-art-missing"/>}
  </div>;
}


