import {useEffect,useMemo,useState} from 'react';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {normalizeFeatured,featuredIds,type FeaturedPage,type FeaturedRule} from './featuredModel';
import type {ItemDto} from '../jellyfin/types';
const memory=new Map<string,ReturnType<typeof normalizeFeatured>>();
export function useFeaturedSettings(){
 const {session}=useConnection();const key=`frame.featured.v1:${session?`${session.server.Id}:${session.user.Id}`:'mock'}`;const [revision,setRevision]=useState(0);
 useEffect(()=>{const changed=(e:Event)=>{if(e.type==='storage'){if((e as StorageEvent).key!==key)return;memory.delete(key);}setRevision(n=>n+1);};window.addEventListener('frame:featured',changed);window.addEventListener('storage',changed);return()=>{window.removeEventListener('frame:featured',changed);window.removeEventListener('storage',changed);};},[key]);
 const rules=useMemo(()=>{if(memory.has(key))return memory.get(key)!;try{const value=normalizeFeatured(JSON.parse(localStorage.getItem(key)??'null'));memory.set(key,value);return value;}catch{return normalizeFeatured(null);}},[key,revision]);
 const update=(page:FeaturedPage,rule:FeaturedRule)=>{const next=normalizeFeatured({...rules,[page]:rule});memory.set(key,next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}window.dispatchEvent(new Event('frame:featured'));};
 return {rules,update};
}
export function useFeaturedPool<T extends {Id?:string;id?:string}>(items:T[],page:FeaturedPage){
 const {rules}=useFeaturedSettings();const rule=rules[page];const ids=items.map(item=>item.Id??item.id!);const signature=JSON.stringify([ids,rule]);
 const order=useMemo(()=>featuredIds(ids,rule),[signature]);const map=new Map(items.map(item=>[item.Id??item.id!,item]));return order.flatMap(id=>map.has(id)?[map.get(id)!]:[]);
}
export function useServerFeatured(page:FeaturedPage,enabled=true,deck=true){
 const {client,session}=useConnection();const {rules}=useFeaturedSettings();const rule=rules[page];
 const data=useRemote(`featured:${session?.server.Id}:${session?.user.Id}:${page}:${enabled}:${JSON.stringify(rule)}`,async()=>{
  if(!enabled||!client||!session)return [] as ItemDto[];
  const kind=page==='movies'?'Movie':page==='shows'?'Series':undefined;
  const items=rule.custom?(await Promise.allSettled(rule.selected.map(id=>client.item(session.user.Id,id)))).flatMap(r=>r.status==='fulfilled'?[r.value]:[]):(await client.items(session.user.Id,{kind,sort:rule.shuffle?'Random':'DateCreated',limit:40})).Items;
  return items.filter(item=>['Movie','Series'].includes(item.Type??'')&&(!kind||item.Type===kind));
 },false);
 const selected=useFeaturedPool(data.data??[],page);return deck?selected:data.data??[];
}
