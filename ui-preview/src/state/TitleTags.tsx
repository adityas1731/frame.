import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useStudio} from '../studio/context';

export type TitleTags=Record<string,string[]>;
export function normalizeTags(value:unknown):TitleTags{
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 const result:TitleTags={};
 for(const [id,tags] of Object.entries(value).slice(0,500)){
  if(!/^[a-zA-Z0-9-]{1,100}$/.test(id)||!Array.isArray(tags))continue;
  const unique=new Map<string,string>();
  for(const tag of tags){if(typeof tag!=='string')continue;const name=tag.trim().replace(/\s+/g,' ');if(name&&name.length<=40)unique.set(name.toLocaleLowerCase(),name);}
  if(unique.size)result[id]=[...unique.values()].slice(0,20);
 }
 return result;
}
const Context=createContext<{tags:TitleTags;error:string;set:(id:string,tags:string[])=>void}|null>(null);
export function TitleTagsProvider({children}:{children:ReactNode}){
 const {scope}=useStudio();return <ScopedTags key={scope} scope={scope}>{children}</ScopedTags>;
}
function ScopedTags({scope,children}:{scope:string;children:ReactNode}){
 const key=`${scope}:title-tags.v1`;
 const [tags,setTags]=useState(()=>{try{return normalizeTags(JSON.parse(localStorage.getItem(key)??'null'));}catch{return {};}});
 const [error,setError]=useState('');
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(tags));setError('');}catch{setError('Tags are saved for this visit. Browser storage is unavailable.');}},[key,tags]);
 return <Context value={{tags,error,set:(id,next)=>setTags(previous=>{const updated={...previous};delete updated[id];return normalizeTags({...updated,[id]:next});})}}>{children}</Context>;
}
export function useTitleTags(){const context=useContext(Context);if(!context)throw Error('TitleTagsProvider required');return context;}
