import { useState } from 'react';
import type { ItemDto } from '../jellyfin/types';
import type { OnlineMetadata } from '../providers/metadata';
import { CastCarousel } from './CastCarousel';
export function CastSection({item,online}:{item:ItemDto;online?:OnlineMetadata|null}) {
  const server=item.People?.filter(p=>p.Type==='Actor'&&p.Name)??[];
  const [source,setSource]=useState<'jellyfin'|'online'>('jellyfin');
  const providerCast=online?.cast.map(p=>({Name:p.name,Role:p.role,OnlineImage:p.image}))??[];
  const useProvider=!!providerCast.length&&(!server.length||source==='online');
  const cast=useProvider?providerCast:server;
  if(!cast.length)return null;
  return <CastCarousel key={`${item.Id}:${useProvider}`} people={cast} sourceControl={server.length>0&&providerCast.length>0?<div className="segmented" role="group" aria-label="Cast source"><button aria-pressed={!useProvider} onClick={()=>setSource('jellyfin')}>Jellyfin</button><button aria-pressed={useProvider} onClick={()=>setSource('online')}>Online</button></div>:undefined}/>;
}
