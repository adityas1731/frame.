import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useStudio} from '../studio/context';
import {selectedTag,tagSelection} from './tagSelection';

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
export const tagKey=(name:string)=>name.trim().replace(/\s+/g,' ').toLocaleLowerCase();
export function normalizeTagNames(value:unknown):string[]{
 if(!Array.isArray(value))return [];
 const names=new Map<string,string>();
 for(const entry of value){if(typeof entry!=='string')continue;const name=entry.trim().replace(/\s+/g,' ');if(name&&name.length<=40)names.set(tagKey(name),name);if(names.size>=10000)break;}
 return [...names.values()].sort((a,b)=>a.localeCompare(b));
}
export function renameTitleTag(tags:TitleTags,name:string,next:string){return normalizeTags(Object.fromEntries(Object.entries(tags).map(([id,values])=>[id,values.map(value=>tagKey(value)===tagKey(name)?next:value)])));}
export function removeTitleTag(tags:TitleTags,name:string){return normalizeTags(Object.fromEntries(Object.entries(tags).map(([id,values])=>[id,values.filter(value=>tagKey(value)!==tagKey(name))])));}
const Context=createContext<{tags:TitleTags;names:string[];error:string;set:(id:string,tags:string[])=>void;rename:(name:string,next:string)=>void;remove:(name:string)=>void}|null>(null);
export function TitleTagsProvider({children}:{children:ReactNode}){
 const {scope}=useStudio();return <ScopedTags key={scope} scope={scope}>{children}</ScopedTags>;
}
function ScopedTags({scope,children}:{scope:string;children:ReactNode}){
 const {config,update}=useStudio();
 const key=`${scope}:title-tags.v1`;
 const [tags,setTags]=useState(()=>{try{return normalizeTags(JSON.parse(localStorage.getItem(key)??'null'));}catch{return {};}});
 const namesKey=`${scope}:tag-names.v1`;
 const [names,setNames]=useState(()=>{let saved:unknown=[];try{saved=JSON.parse(localStorage.getItem(namesKey)??'[]');}catch{}return normalizeTagNames([...(Array.isArray(saved)?saved:[]),...Object.values(tags).flat()]);});
 const [error,setError]=useState('');
 useEffect(()=>{try{localStorage.setItem(namesKey,JSON.stringify(names));localStorage.setItem(key,JSON.stringify(tags));setError('');}catch{setError('Tags are saved for this visit. Browser storage is unavailable.');}},[key,namesKey,tags,names]);
 function rename(name:string,next:string){setNames(previous=>normalizeTagNames(previous.map(value=>tagKey(value)===tagKey(name)?next:value)));setTags(previous=>renameTitleTag(previous,name,next));if(config.widgets.some(w=>tagKey(selectedTag(w.genre)??'')===tagKey(name)))update({...config,widgets:config.widgets.map(w=>tagKey(selectedTag(w.genre)??'')===tagKey(name)?{...w,genre:tagSelection(next)}:w)});}
 function remove(name:string){setNames(previous=>previous.filter(value=>tagKey(value)!==tagKey(name)));setTags(previous=>removeTitleTag(previous,name));if(config.widgets.some(w=>tagKey(selectedTag(w.genre)??'')===tagKey(name)))update({...config,widgets:config.widgets.map(w=>tagKey(selectedTag(w.genre)??'')===tagKey(name)?{...w,source:'selection',selection:[],genre:''}:w)});}
 return <Context value={{tags,names,error,rename,remove,set:(id,next)=>{setNames(previous=>normalizeTagNames([...previous,...(tags[id]??[]),...next]));setTags(previous=>{const updated={...previous};delete updated[id];return normalizeTags({...updated,[id]:next});});}}}>{children}</Context>;
}
export function useTitleTags(){const context=useContext(Context);if(!context)throw Error('TitleTagsProvider required');return context;}
