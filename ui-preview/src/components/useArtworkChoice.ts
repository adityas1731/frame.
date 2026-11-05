import {useEffect,useState} from 'react';
import {useConnection} from '../jellyfin/useConnection';
import {useOnline} from '../providers/context';
import type {ItemDto} from '../jellyfin/types';
import {bannerChoiceKey,safeBannerUrl} from './bannerChoice';
import {readCustomArtwork,writeCustomArtwork,type ArtworkKind} from './customArtwork';

function useChoiceKey(item:ItemDto,kind:ArtworkKind){
  const {session}=useConnection();
  const key=bannerChoiceKey(session?.server.Id??'',session?.user.Id??'',item.Id,JSON.stringify(item.ProviderIds??{}));
  return kind==='banner'?key:`${key}:card`;
}
export function useProviderArtworkChoice(item:ItemDto,kind:ArtworkKind='banner',enabled=true) {
  const {client:online}=useOnline();const key=useChoiceKey(item,kind);
  const [choice,setChoice]=useState<{key:string;url?:string}>({key:''});
  useEffect(()=>{
    if(!enabled)return;
    let url:string|undefined;try{url=safeBannerUrl(localStorage.getItem(key));}catch{/* Storage can be unavailable. */}setChoice({key,url});
    const changed=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.key===key)setChoice({key,url:safeBannerUrl(detail.url)});};
    window.addEventListener('frame:banner-changed',changed);return()=>window.removeEventListener('frame:banner-changed',changed);
  },[key,enabled]);
  return {url:enabled&&online&&choice.key===key?choice.url:undefined,set:(url?:string)=>{
    const safe=safeBannerUrl(url);setChoice({key,url:safe});
    try{if(safe)localStorage.setItem(key,safe);else localStorage.removeItem(key);}catch{/* Session preference still works. */}
    window.dispatchEvent(new CustomEvent('frame:banner-changed',{detail:{key,url:safe}}));
  }};
}
export function useCustomArtwork(item:ItemDto,kind:ArtworkKind,enabled=true){
  const key=`custom:${useChoiceKey(item,kind)}`;const [value,setValue]=useState<{key:string;blob?:Blob}>({key:''});
  const [object,setObject]=useState<{key:string;url:string}>();
  useEffect(()=>{
    if(!enabled)return;let active=true;let revision=0;
    readCustomArtwork(key).then(blob=>{if(active&&revision===0)setValue({key,blob});},()=>{if(active&&revision===0)setValue({key});});
    const change=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.key===key){revision++;setValue({key,blob:detail.blob instanceof Blob?detail.blob:undefined});}};
    window.addEventListener('frame:custom-artwork',change);return()=>{active=false;window.removeEventListener('frame:custom-artwork',change);};
  },[key,enabled]);
  useEffect(()=>{if(!enabled||value.key!==key||!value.blob){setObject(undefined);return;}const url=URL.createObjectURL(value.blob);setObject({key,url});return()=>URL.revokeObjectURL(url);},[key,value,enabled]);
  return {url:enabled&&object?.key===key?object.url:undefined,save:async(blob?:Blob)=>{
    await writeCustomArtwork(key,blob);setValue({key,blob});window.dispatchEvent(new CustomEvent('frame:custom-artwork',{detail:{key,blob}}));
  }};
}
