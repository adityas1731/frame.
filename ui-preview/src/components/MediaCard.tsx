import {formatPlaybackProgress} from '../platform/duration';
import {headingCase} from './headingCase';
import {WatchedToggle} from './WatchedToggle';
import { useRef } from 'react';
import { Link } from 'react-router';
import { Bookmark, Check, ChevronLeft, ChevronRight, Heart, Star } from 'lucide-react';
import { type MediaItem, duration } from '../data/media';
import { usePreview } from '../state/PreviewContext';
import { Artwork } from './Artwork';
import { IconButton } from './Primitives';

export function MediaCard({ item, landscape = false, rank, continueWatching = false }: { item: MediaItem; landscape?: boolean; rank?: number; continueWatching?: boolean }) {
  const { favorites, watchlist, toggleFavorite, toggleWatchlist, preferences, notify } = usePreview();
  const saved = watchlist.includes(item.id);
  return <article className={`media-card ${landscape ? 'landscape-card' : ''} ${rank ? 'ranked-card' : ''}`}>
    {rank && <span className="rank-number" aria-label={`Rank ${rank}`}>{rank}</span>}
    <div className="poster">
      <Artwork item={item}/>
      <div className="poster-vignette"/>
      <span className="poster-kicker">{item.art === 'forest' || item.art === 'coast' ? 'A different perspective' : 'An original story'}</span>
      <span className={`poster-title poster-font-${item.art}`}>{item.title}</span>
      <span className="poster-credit">{item.director.toUpperCase()}</span>
      <Link className="poster-link" to={`/item/${item.id}`} aria-label={`View ${item.title}`}/>
      {item.new && <span className="poster-badge">NEW</span>}
      <WatchedToggle demoId={item.id} title={item.title}/>
      <div className="card-actions">
        <IconButton label={`${favorites.includes(item.id) ? 'Unfavorite' : 'Favorite'} ${item.title}`} pressed={favorites.includes(item.id)} onClick={() => toggleFavorite(item.id)}>
<Heart size={16} fill={favorites.includes(item.id) ? 'currentColor' : 'none'}/>
</IconButton>
        <IconButton label={`${saved ? 'Remove from' : 'Add to'} watchlist: ${item.title}`} pressed={saved} onClick={() => { toggleWatchlist(item.id); notify(saved ? 'Removed from your watchlist' : 'Added to your watchlist'); }}>{saved ? <Check size={16}/> : <Bookmark size={16}/>}</IconButton>
      </div>
      {landscape && item.progress && <div className="progress-track" role="progressbar" aria-label={`${item.title} demo progress`} aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100}>
<span style={{ width: `${item.progress}%` }}/>
</div>}
    </div>
    {(preferences.showTitles || landscape) && <div className="card-info">
<Link to={`/item/${item.id}`} className="card-title">{item.title}</Link>
<div className="card-meta">
<span>{item.kind === 'show' ? `${item.seasons} seasons` : item.year}{continueWatching ? ` · ${formatPlaybackProgress(item.runtime*60*(item.progress??0)/100,item.runtime*60)}` : landscape ? ` · ${item.kind === 'show' ? 'Episode 3' : `${duration(Math.round(item.runtime * (1 - (item.progress ?? 0) / 100)))} left`}` : ` · ${item.genres[0]}`}</span>{preferences.showRatings && !landscape && <span className="card-score">
<Star size={10} fill="currentColor"/>{item.score.toFixed(1)}</span>}</div>
</div>}
  </article>;
}
export function MediaRow({ title, subtitle, items, landscape = false, ranked = false, to = '/library' }: { title: string; subtitle?: string; items: MediaItem[]; landscape?: boolean; ranked?: boolean; to?: string }) {
  const scroll = useRef<HTMLDivElement>(null);
  const { preferences } = usePreview();
  const move = (left: number) => scroll.current?.scrollBy({ left, behavior: preferences.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  return <section className="media-section">
<header className="section-heading">
<div>
<h2>{headingCase(title)}</h2>{subtitle && <p>{subtitle}</p>}</div>
<div className="row-controls">
<Link to={to} className="text-link">View all <ChevronRight size={14}/>
</Link>
<div className="scroll-controls">
<IconButton label={`Scroll ${title} left`} onClick={() => move(-650)}>
<ChevronLeft size={17}/>
</IconButton>
<IconButton label={`Scroll ${title} right`} onClick={() => move(650)}>
<ChevronRight size={17}/>
</IconButton>
</div>
</div>
</header>
<div className={`media-row ${landscape ? 'landscape-row' : ''} ${ranked ? 'ranked-row' : ''}`} ref={scroll}>{items.map((item, i) => <MediaCard key={item.id} item={item} landscape={landscape} rank={ranked ? i + 1 : undefined}/>)}</div>
</section>;
}
