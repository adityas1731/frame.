import {useEffect,useState,type CSSProperties} from 'react';
import {useConnection} from '../jellyfin/useConnection';
export type CollectionSection='watchlist'|'favorites'|'library';
export interface CollectionLayout {width:number;gap:number;radius:number;pageSize:number;view:'grid'|'list';titles:boolean;ratings:boolean}
const bounded=(n:unknown,fallback:number,min:number,max:number)=>typeof n==='number'&&Number.isFinite(n)?Math.round(Math.max(min,Math.min(max,n))):fallback;
export function normalizeCollectionLayout(raw:unknown,defaults:Partial<CollectionLayout>={}):CollectionLayout {
 const v=raw&&typeof raw==='object'?raw as Partial<CollectionLayout>:{};
 return {width:bounded(v.width,defaults.width??172,120,320),gap:bounded(v.gap,defaults.gap??20,8,40),radius:bounded(v.radius,defaults.radius??12,0,32),pageSize:bounded(v.pageSize,40,12,40),view:v.view==='list'?'list':'grid',titles:v.titles!==false,ratings:v.ratings!==false};
}
export function useCollectionLayout(section:string,defaults:Partial<CollectionLayout>={}) {
 const {session}=useConnection();
 const key=`frame.collection-layout.v1:${session?encodeURIComponent(`${session.baseUrl}:${session.server.Id}:${session.user.Id}`):'demo'}:${section}`;
 const read=()=>{try{return normalizeCollectionLayout(JSON.parse(localStorage.getItem(key)??'null'),defaults);}catch{return normalizeCollectionLayout(null,defaults);}};
 const [stored,setStored]=useState(()=>({key,value:read()}));const [error,setError]=useState('');
 const value=stored.key===key?stored.value:read();
 useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===key)setStored({key,value:read()});};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[key]);
 const change=(patch:Partial<CollectionLayout>)=>{const next=normalizeCollectionLayout({...value,...patch},defaults);setStored({key,value:next});try{localStorage.setItem(key,JSON.stringify(next));setError('');}catch{setError('Layout changes will last until this page is closed.');}};
 const reset=()=>change(normalizeCollectionLayout(null,defaults));
 const style={'--collection-width':`${value.width}px`,'--collection-gap':`${value.gap}px`,'--collection-radius':`${value.radius}px`} as CSSProperties;
 return {value,change,reset,style,error};
}
