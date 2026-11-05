import {useEffect,useRef,useState} from 'react';
import type {ItemDto} from '../jellyfin/types';
import {useConnection} from '../jellyfin/useConnection';
import {useOnline} from '../providers/context';
import {ProviderError} from '../providers/metadata';

export function CastAvatar({person,index=0}:{person:NonNullable<ItemDto['People']>[number];index?:number}){
 const {client,session}=useConnection();const {client:online}=useOnline();const host=useRef<HTMLSpanElement>(null);
 const key=JSON.stringify([person.Id,person.PrimaryImageTag,person.OnlineImage]);
 const [image,setImage]=useState<{key:string;url:string;source:string}|null>(null);
 const [status,setStatus]=useState<{key:string;text:string}|null>(null);
 useEffect(()=>{
  let active=true,objectUrl:string|undefined;setImage(null);setStatus(null);
  const observer=new IntersectionObserver(entries=>{
   if(!entries.some(entry=>entry.isIntersecting))return;observer.disconnect();
   void(async()=>{
    // A cache tag is optional in Jellyfin; missing tags do not prove a photo is absent.
    if(person.Id&&client){try{const blob=await client.image(person.Id,'Primary',person.PrimaryImageTag??'',320);if(!active)return;objectUrl=URL.createObjectURL(blob);setImage({key,url:objectUrl,source:'Jellyfin'});return;}catch{/* Try permitted display-only alternatives. */}}
    if(!active)return;
    if(person.OnlineImage){setImage({key,url:person.OnlineImage,source:'Online provider'});return;}
    if(!person.Id&&!person.OnlineImage){setStatus({key,text:'Photo unavailable: Jellyfin supplied no person ID.'});return;}
    if(person.Id&&online&&session){try{const url=await online.portrait(session.user.Id,person.Id);if(active&&url)setImage({key,url,source:'TMDB via Jellyfin'});}catch(error){if(active)setStatus({key,text:error instanceof ProviderError?error.message:'Photo unavailable: person lookup could not be completed.'});}}
   })();
  },{rootMargin:'100px'});
  if(host.current)observer.observe(host.current);
  return()=>{active=false;observer.disconnect();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[client,online,session,key]);
 const shown=image?.key===key?image:null;
 return <span ref={host} className={`cast-avatar tone-${index%3}`} title={shown?`Photo: ${shown.source}`:status?.key===key?status.text:'Photo unavailable'}>{shown&&<img key={shown.url} src={shown.url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>{setImage(null);setStatus({key,text:'Photo unavailable: the image could not load.'});}}/>}<span>{person.Name?.split(' ').map(s=>s[0]).slice(0,2).join('')}</span></span>;
}
