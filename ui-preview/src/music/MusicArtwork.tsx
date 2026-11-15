import {useEffect,useState} from 'react';
import {Music2,UserRound} from 'lucide-react';
import {useConnection} from '../jellyfin/useConnection';
import type {ItemDto} from '../jellyfin/types';
/** Jellyfin images only. Audio browsing never invokes external enrichment. */
export function MusicArtwork({item}:{item:ItemDto}){
 const {client,session}=useConnection();const id=item.ImageTags?.Primary?item.Id:item.AlbumId;const tag=item.ImageTags?.Primary??item.AlbumPrimaryImageTag;
 const key=JSON.stringify([session?.server.Id,session?.user.Id,id,tag]);const [image,setImage]=useState<{key:string;url:string}>();
 useEffect(()=>{let active=true;let url:string|undefined;if(client&&id&&tag)void client.image(id,'Primary',tag,400).then(blob=>{if(active){url=URL.createObjectURL(blob);setImage({key,url});}},()=>{});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[client,key,id,tag]);
 return <span className={`music-art ${item.Type==='MusicArtist'?'music-art-artist':''}`}>{image?.key===key?<img src={image.url} alt="" onError={()=>setImage(undefined)}/>:item.Type==='MusicArtist'?<UserRound aria-hidden="true"/>:<Music2 aria-hidden="true"/>}</span>;
}
