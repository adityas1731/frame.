import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {useConnection} from '../jellyfin/useConnection';
import {usePreview} from '../state/PreviewContext';
export interface SavedList {ids:string[];width:number;gap:number}
export function normalizeList(value:unknown):SavedList{const raw=value&&typeof value==='object'?value as Partial<SavedList>:{};return {ids:Array.isArray(raw.ids)?[...new Set(raw.ids.filter((id):id is string=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id)))].slice(0,1000):[],width:typeof raw.width==='number'&&Number.isFinite(raw.width)?Math.max(120,Math.min(260,raw.width)):172,gap:typeof raw.gap==='number'&&Number.isFinite(raw.gap)?Math.max(8,Math.min(40,raw.gap)):20};}
export function watchlistKey(server:string,user:string){return `frame.watchlist.v1:${encodeURIComponent(server)}:${encodeURIComponent(user)}`;}
const Context=createContext<{list:SavedList;toggle:(id:string)=>void;layout:(width:number,gap:number)=>void;error:string}|null>(null);
export function WatchlistProvider({children}:{children:ReactNode}){const {session}=useConnection();const scope=session?watchlistKey(`${session.baseUrl}:${session.server.Id}`,session.user.Id):'frame.watchlist.v1:demo';return <ScopedWatchlist key={scope} scope={scope} live={!!session}>{children}</ScopedWatchlist>;}
function ScopedWatchlist({scope,live,children}:{scope:string;live:boolean;children:ReactNode}){const preview=usePreview();const [list,setList]=useState<SavedList>(()=>{try{return normalizeList(JSON.parse(localStorage.getItem(scope)??'null'));}catch{return normalizeList(null);}});const [error,setError]=useState('');
useEffect(()=>{try{localStorage.setItem(scope,JSON.stringify(list));setError('');}catch{setError('Browser storage is unavailable. Your changes will last until this page is closed.');}},[scope,list]);
return <Context value={{list:{...list,ids:live?list.ids:preview.watchlist},error,layout:(width,gap)=>setList(s=>normalizeList({...s,width,gap})),toggle:id=>{if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))return;if(!live){preview.toggleWatchlist(id);return;}setList(s=>s.ids.includes(id)?{...s,ids:s.ids.filter(v=>v!==id)}:{...s,ids:[id,...s.ids].slice(0,1000)});}}}>{children}</Context>;}
export function useWatchlist(){const value=useContext(Context);if(!value)throw Error('WatchlistProvider is required');return value;}
