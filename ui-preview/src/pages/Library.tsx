import {GenreMenu} from '../components/TitleTags';
import {headingCase} from '../components/headingCase';
import {WatchedToggle} from '../components/WatchedToggle';
import {Select} from '../components/Select';
import { Link, useSearchParams } from 'react-router';
import { Bookmark, Grid2X2, Heart, List, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { media, genres, duration, type MediaKind } from '../data/media';
import { usePreview } from '../state/PreviewContext';
import { MediaCard } from '../components/MediaCard';
import { Artwork } from '../components/Artwork';
import { EmptyState, IconButton } from '../components/Primitives';
import {CollectionSpotlight} from '../components/CollectionSpotlight';

export type CollectionMode = 'movies' | 'shows' | 'library' | 'favorites' | 'watchlist' | 'search';
const titles: Record<CollectionMode, string> = { movies: 'Movies', shows: 'TV Shows', library: 'Your library', favorites: 'Favorites', watchlist: 'Your watchlist', search: 'Search' };
const labels: Record<CollectionMode, string> = { movies: 'MOVIES', shows: 'TV SHOWS', library: 'ALL LIBRARIES', favorites: 'YOUR FAVORITES', watchlist: 'YOUR WATCHLIST', search: 'SEARCH YOUR LIBRARY' };
export function LibraryPage({ mode }: { mode: CollectionMode }) {
  const { favorites, watchlist, preferences } = usePreview();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const genre = params.get('genre') ?? 'All genres';
  const sort = params.get('sort') ?? 'featured';
  const view = params.get('view') ?? 'grid';
  const update = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true });
  const base = media.filter(item => (mode !== 'movies' || item.kind === 'movie') && (mode !== 'shows' || item.kind === 'show') && (mode !== 'favorites' || favorites.includes(item.id)) && (mode !== 'watchlist' || watchlist.includes(item.id)));
  const items = base.filter(item => (genre === 'All genres' || item.genres.includes(genre)) && `${item.title} ${item.overview} ${item.genres.join(' ')} ${item.cast.join(' ')} ${item.director}`.toLowerCase().includes(q.toLowerCase().trim())).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'rating' ? b.score - a.score : sort === 'newest' ? b.year - a.year || Number(Boolean(b.new)) - Number(Boolean(a.new)) : 0);
  const isSearch = mode === 'search';
  const pageDescription = mode === 'movies' ? 'From quiet discoveries to extraordinary adventures.' : mode === 'shows' ? 'A new world is only an episode away.' : mode === 'watchlist' ? 'Save a little inspiration for another evening.' : mode === 'favorites' ? 'Some stories stay with you. Keep them close.' : isSearch ? 'Search by title, genre, director, or cast.' : `${media.filter(m => m.kind === 'movie').length} films. ${media.filter(m => m.kind === 'show').length} series. Endless possibilities.`;
  const hasSpotlight=['movies','shows'].includes(mode)&&!q&&genre==='All genres'&&items.length>0;
  return <div className={`content-page collection-page ${hasSpotlight?'collection-page-hero':''}`}>
{!hasSpotlight&&<header className="page-heading">
<span className="eyebrow">{labels[mode]}</span>
<h1>{headingCase(titles[mode])}</h1>
<p>{pageDescription}</p>
</header>}
    {hasSpotlight&&<CollectionSpotlight page={mode==='movies'?'movies':'shows'} pageTitle={titles[mode]} stories={items.map(item=>({id:item.id,title:item.title,description:item.overview,meta:[item.year,...item.genres].join(' · '),to:`/item/${item.id}`,artwork:<Artwork item={item}/>}))}/>}
    {isSearch && <div className="search-stage">
<Search size={24}/>
<input autoFocus aria-label="Search titles, genres, and people" placeholder="What are you in the mood for?" value={q} onChange={e => update('q', e.target.value)}/>{q && <IconButton label="Clear search" onClick={() => update('q', '')}>
<X size={20}/>
</IconButton>}</div>}
    <div className="collection-toolbar">
{mode==='library'?<GenreMenu/>:<div className="filter-select">
<SlidersHorizontal size={15}/>
<Select aria-label="Filter by genre" value={genre} onValueChange={value=> update('genre', value)}>{['All genres', ...genres].map(g => <option key={g}>{g}</option>)}</Select>
</div>}{!isSearch && <div className="inline-search">
<Search size={15}/>
<input aria-label="Filter this collection" placeholder="Filter titles…" value={q} onChange={e => update('q', e.target.value)}/>
</div>}<div className="toolbar-right">
<span className="result-count" aria-live="polite">{items.length} {items.length === 1 ? 'title' : 'titles'}</span>
<Select className="select-control" aria-label="Sort titles" value={sort} onValueChange={value=> update('sort', value)}>
<option value="featured">Featured</option>
<option value="newest">Recently added</option>
<option value="title">Title A–Z</option>
<option value="rating">Highest rated</option>
</Select>
<div className="view-switch">
<IconButton label="Grid view" pressed={view === 'grid'} onClick={() => update('view', 'grid')}>
<Grid2X2 size={16}/>
</IconButton>
<IconButton label="List view" pressed={view === 'list'} onClick={() => update('view', 'list')}>
<List size={17}/>
</IconButton>
</div>
</div>
</div>
    {!isSearch && !['favorites', 'watchlist'].includes(mode) && <div className="genre-chips">{['All genres', 'Adventure', 'Drama', 'Science Fiction', 'Thriller', 'Nature'].map(g => <button key={g} className={genre === g ? 'active' : ''} onClick={() => update('genre', g)}>{g === 'All genres' ? 'All stories' : g}</button>)}</div>}
    {isSearch && !q && <p className="search-hint">A little inspiration: <button onClick={() => update('q', 'Adventure')}>an adventure</button>
<button onClick={() => update('q', 'Nature')}>a quieter world</button>
<button onClick={() => update('q', 'Drama')}>a human story</button>
</p>}
    {items.length ? view === 'grid' ? <div className="media-grid">{items.map(item => <MediaCard key={item.id} item={item}/>)}</div> : <div className="media-list">{items.map(item => <article key={item.id} className="media-list-entry"><WatchedToggle demoId={item.id} title={item.title}/><Link to={`/item/${item.id}`} className="media-list-item">
<div className="list-art">
<Artwork item={item}/>
</div>
<div>
<h2>{item.title}</h2>
<p>{item.genres.join(' · ')}<span className="list-summary"> — {item.tagline}</span>
</p>
</div>
<span>{item.year}</span>
<span className="list-duration">{item.kind === 'show' ? `${item.seasons} seasons` : duration(item.runtime)}</span>{preferences.showRatings && <span className="score">
<Star size={13}/>{item.score}</span>}</Link></article>)}</div> : <EmptyState title={q || genre !== 'All genres' ? 'No stories found just yet.' : mode === 'favorites' ? 'Room for your favorites.' : 'Your next chapter starts here.'} description={q || genre !== 'All genres' ? 'Try a different title, person, or genre.' : 'Explore the library and save something that catches your eye.'}>{q || genre !== 'All genres' ? <button className="button secondary" onClick={() => setParams({})}>Clear filters</button> : <Link className="button primary" to="/library">{mode === 'favorites' ? <Heart size={16}/> : <Bookmark size={16}/>} Explore the library</Link>}</EmptyState>}
  </div>;
}
export function KindCollection({ kind }: { kind: MediaKind }) { return <LibraryPage mode={kind === 'movie' ? 'movies' : 'shows'}/>; }
