import {GenreMenu} from '../components/TitleTags';
import {headingCase} from '../components/headingCase';
import {useOnline} from '../providers/context';
import {displayGenres, genreCandidates, refineGenrePage} from '../providers/genres';
import {useServerFeatured} from '../state/featured';
import {Select} from '../components/Select';
import {FeaturedServerArtwork} from '../components/FeaturedServerArtwork';
import {useEffect} from 'react';
import {CollectionSpotlight} from '../components/CollectionSpotlight';
import {useRef} from 'react';
import {useSearchParams} from 'react-router';
import {Search} from 'lucide-react';
import {useConnection} from '../jellyfin/useConnection';
import {useDebounced, useRemote} from '../jellyfin/hooks';
import {itemTitle, runtime} from '../jellyfin/presentation';
import type {BrowseQuery, ItemDto} from '../jellyfin/types';
import {EmptyState} from '../components/Primitives';
import type {CollectionMode} from './Library';
import {RequestStatus, RefreshButton, Pagination, LiveCard} from './LiveShared';
const titles = { movies: 'A world of cinema.', shows: 'Find your next obsession.', library: 'Your whole world of stories.', search: 'Follow your curiosity.', favorites: 'Favorites', watchlist: 'Good things to look forward to.' };
export function LiveBrowse({ mode }: { mode: CollectionMode }) {
  const { client, session } = useConnection();
  const {client:online}=useOnline();
  const [params, setParams] = useSearchParams();
  const raw = params.get('q') ?? ''; const search = useDebounced(raw);
  const rawStart = Number(params.get('start') ?? 0); const start = Number.isInteger(rawStart) && rawStart >= 0 ? rawStart : 0;
  const parentId = params.get('library') || undefined;
  const sort = (['SortName', 'DateCreated', 'CommunityRating'].includes(params.get('sort') ?? '') ? params.get('sort') : 'SortName') as BrowseQuery['sort'];
  const change = (values: Record<string, string>) => setParams(previous => { const next = new URLSearchParams(previous); for (const [k,v] of Object.entries(values)) v ? next.set(k,v) : next.delete(k); return next; }, { replace: true });
  const query: BrowseQuery = { kind: mode === 'movies' ? 'Movie' : mode === 'shows' ? 'Series' : undefined, search, parentId, start, sort, genre: params.get('genre') || undefined, favorite: mode === 'favorites' ? true : undefined };
  const data = useRemote(`browse:${mode}:${JSON.stringify(query)}:${!!online}`, async () => {
    if(mode==='watchlist')return {Items:[] as ItemDto[],TotalRecordCount:0,candidateCount:0};
    const page=await client!.items(session!.user.Id,{...query,genre:query.genre?genreCandidates(query.genre):undefined});
    if(!query.genre)return {...page,candidateCount:page.Items.length};
    return refineGenrePage(page,query.genre,online?item=>online.enrich(item):undefined);
  });
  const favoritesRefresh = useRef(data.revalidate); favoritesRefresh.current = data.revalidate;
  useEffect(()=>{if(mode!=='favorites')return;const update=(event:Event)=>{if((event as CustomEvent).detail?.client===client)favoritesRefresh.current();};window.addEventListener('frame:favorite-updated',update);return()=>window.removeEventListener('frame:favorite-updated',update);},[mode,client]);
  const items = data.data?.Items ?? [];
  const bannerItems=useServerFeatured(mode==='movies'?'movies':'shows',['movies','shows'].includes(mode)&&!raw&&!start,false);
  const hasSpotlight=['movies','shows'].includes(mode)&&!raw&&!start&&!query.genre&&bannerItems.length>0;
  return <div className={`content-page collection-page ${hasSpotlight?'collection-page-hero':''}`}>
{!hasSpotlight&&<header className="page-heading">
<h1>{headingCase(query.genre ? query.genre : mode==='movies'?'Movies':mode==='shows'?'TV Shows':mode==='library'?'Your Library':mode==='search'?'Search':titles[mode])}</h1>

</header>}
    {hasSpotlight&&<CollectionSpotlight page={mode==='movies'?'movies':'shows'} pageTitle={mode==='movies'?'Movies':'TV Shows'} stories={bannerItems.map(item=>({id:item.Id,title:itemTitle(item),description:item.Overview??undefined,meta:[item.ProductionYear,item.Type==='Series'?undefined:runtime(item),displayGenres(item.Genres)[0]].filter(Boolean).join(' · '),to:`/item/${encodeURIComponent(item.Id)}`,artwork:<FeaturedServerArtwork item={item}/>}))}/>}
    <form className="search-stage" role="search" onSubmit={e => e.preventDefault()}>
<Search size={24}/>
<input aria-label="Search Jellyfin titles" placeholder="Find a movie or series…" value={raw} onChange={e => change({ q: e.target.value, start: '' })}/>
</form>
    <div className="collection-toolbar">

<Select className="select-control" aria-label="Sort Jellyfin titles" value={sort} onValueChange={value=> change({ sort: value, start: '' })}>
<option value="SortName">Title A–Z</option>
<option value="DateCreated">Recently added</option>
<option value="CommunityRating">Highest rated</option>
</Select>
<RefreshButton retry={data.retry} loading={data.loading}/>{mode==='library'&&<div className="library-genre-filter"><GenreMenu/></div>}
</div>
<RequestStatus {...data} stale={!!data.data}/>
    {raw !== search && <p className="request-status" role="status">Waiting for your search…</p>}
    {items.length ? <div className="media-grid">{items.map(item => <LiveCard key={item.Id} item={item}/>)}</div> : !data.loading && !data.error && <EmptyState title="No Stories Found Just Yet." description="Try another title or sort order. Only titles available to your account are shown."/>}
    {data.data && (query.genre?<nav className="pagination" aria-label="Genre results pages"><button className="button secondary" disabled={data.loading||start===0} onClick={()=>change({start:String(Math.max(0,start-40))})}>Previous</button><span>{items.length} matches · Page {Math.floor(start/40)+1}</span><button className="button secondary" disabled={data.loading||!data.data.candidateCount||start+data.data.candidateCount>=data.data.TotalRecordCount} onClick={()=>change({start:String(start+40)})}>Next</button></nav>:<Pagination start={start} total={data.data.TotalRecordCount} count={items.length} loading={data.loading || raw !== search} change={next => { change({ start: String(next) }); window.scrollTo({ top: 0, behavior: 'instant' }); }}/>)}
  </div>;
}
