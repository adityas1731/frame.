import {Bookmark,Check} from 'lucide-react';
import {useWatchlist} from '../state/WatchlistContext';
import {usePreview} from '../state/PreviewContext';
import type {ItemDto} from '../jellyfin/types';
export function WatchlistToggle({item,variant='card'}:{item:ItemDto;variant?:'card'|'button'}){const {list,toggle}=useWatchlist();const {notify}=usePreview();const saved=list.ids.includes(item.Id);return <button type="button" className={variant==='card'?`watchlist-card ${saved?'is-saved':''}`:'button hero-secondary'} aria-pressed={saved} aria-label={`${saved?'Remove from':'Add to'} watchlist: ${item.Name??'Untitled'}`} title={saved?'Remove From Watchlist':'Add To Watchlist'} onClick={event=>{event.preventDefault();event.stopPropagation();toggle(item.Id);notify(saved?'Removed from Watchlist':'Added to Watchlist');}}>{saved?<Check size={17}/>:<Bookmark size={17}/>} {variant==='button'&&<span>{saved?'In Watchlist':'Watchlist'}</span>}</button>;}
