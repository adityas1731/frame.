import {useState} from 'react';
import {Link} from 'react-router';
import {Bookmark,Search,X} from 'lucide-react';
import {useWatchlist} from '../state/WatchlistContext';
import {useCollectionLayout} from '../state/collectionLayout';
import {CollectionLayoutButton,collectionGridClass} from '../components/CollectionLayout';
import {Select} from '../components/Select';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {LiveCard,Pagination,RequestStatus} from './LiveShared';
import {MediaCard} from '../components/MediaCard';
import {media} from '../data/media';
import {itemTitle} from '../jellyfin/presentation';
import type {ItemDto} from '../jellyfin/types';
export function WatchlistPage(){
 const {list,error,toggle}=useWatchlist();const {client,session}=useConnection();const layout=useCollectionLayout('watchlist');
 const [page,setPage]=useState(0),[search,setSearch]=useState(''),[sort,setSort]=useState('title');
 const data=useRemote(`watchlist-titles:${session?.server.Id}:${session?.user.Id}:${JSON.stringify(list.ids)}`,async()=>{
  if(!client||!session)return [] as ItemDto[];
  const result:ItemDto[]=[];
  // Jellyfin's bounded IDs query batches up to 40; reuse its existing cache.
  for(let index=0;index<list.ids.length;index+=40){const batch=await client.items(session.user.Id,{ids:list.ids.slice(index,index+40),limit:40});result.push(...batch.Items);}
  return result;
 },false);
 const loading=!!session&&list.ids.length>0&&data.loading;
 const live=new Map((data.data??[]).map(item=>[item.Id,item]));
 const entries=list.ids.map(id=>{const item=live.get(id),demo=!session?media.find(item=>item.id===id):undefined;return {id,item,demo,title:item?itemTitle(item):demo?.title??'Unavailable Title',year:item?.ProductionYear??demo?.year??0,score:item?.CommunityRating??demo?.score??0};})
 .filter(entry=>entry.title.toLowerCase().includes(search.trim().toLowerCase()))
 .sort((a,b)=>sort==='rating'?b.score-a.score:sort==='newest'?b.year-a.year:a.title.localeCompare(b.title));
 const size=layout.value.pageSize,start=Math.min(page*size,Math.max(0,Math.ceil(entries.length/size)-1)*size),visible=entries.slice(start,start+size);
 return <div className={`content-page collection-page watchlist-page ${!list.ids.length?'watchlist-empty-page':''}`}>
 <header className="page-heading collection-page-heading"><h1>Watchlist</h1><CollectionLayoutButton layout={layout} onPageSizeChange={()=>setPage(0)}/></header>
 <form className="search-stage" role="search" onSubmit={event=>event.preventDefault()}><Search size={24}/><input aria-label="Search watchlist titles" placeholder="Find a movie or series…" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></form>
 <div className="collection-toolbar"><Select className="select-control" aria-label="Sort watchlist titles" value={sort} onValueChange={value=>{setSort(value);setPage(0);}}><option value="title">Title A–Z</option><option value="newest">Release Year</option><option value="rating">Highest Rated</option></Select></div>
 {error&&<p role="status">{error}</p>}{session&&list.ids.length>0&&<RequestStatus {...data} stale={!!data.data}/>}
 {(!loading)&&visible.length?<><div className={collectionGridClass(layout.value)} style={layout.style}>{visible.map(entry=>entry.item?<LiveCard key={entry.id} item={entry.item} showTitles={layout.value.titles} showRatings={layout.value.ratings}/>:entry.demo?<MediaCard key={entry.id} item={entry.demo} showTitles={layout.value.titles} showRatings={layout.value.ratings}/>:<article key={entry.id} className="saved-unavailable"><Bookmark size={24}/><p>This title is unavailable.</p><button className="text-link" onClick={()=>toggle(entry.id)}><X size={15}/>Remove</button></article>)}</div>
 {entries.length>size&&<Pagination start={start} total={entries.length} count={visible.length} pageSize={size} loading={false} change={next=>setPage(Math.floor(next/size))}/>}</>:(!loading)&&!data.error&&<div className="watchlist-empty"><Bookmark size={32} strokeWidth={1.3}/><h2>{search?'No Matching Titles':'Save Something For Later'}</h2><p>{search?'Try another title.':'Tap the bookmark on a title or card.'}</p><Link className="button secondary" to="/library">Explore Your Library</Link></div>}
 </div>;
}
