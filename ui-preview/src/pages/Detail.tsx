import {TitleTagsEditor,TitleTagLinks} from '../components/TitleTags';
import {formatMinutes} from '../platform/duration';
import {GenreLinks} from '../components/GenreLinks';
import {personName} from '../components/detailPresentation';
import {WatchedToggle} from '../components/WatchedToggle';
import {EpisodeCardSize} from '../components/EpisodeCardSize';
import {Select} from '../components/Select';
import {CastCarousel} from '../components/CastCarousel';
import { DetailFacts } from '../components/DetailFacts';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronRight, Heart, Info, Star } from 'lucide-react';
import { findMedia, media, duration } from '../data/media';
import { usePreview } from '../state/PreviewContext';
import { Artwork } from '../components/Artwork';
import { MediaRow } from '../components/MediaCard';
import { EmptyState, Modal } from '../components/Primitives';
import { MetadataPreview } from '../components/MetadataPreview';

const episodeNames = ['The first page', 'A signal in the distance', 'The things we carry', 'An unexpected turn', 'Where the light falls', 'A place to begin'];
export function Detail() {
  const { itemId } = useParams();
  const item = findMedia(itemId);
  const { favorites, watchlist, watched, toggleFavorite, toggleWatchlist, toggleWatched, notify } = usePreview();
  const [tab, setTab] = useState('overview');
  const [season, setSeason] = useState('1');
  const [episode, setEpisode] = useState<number | null>(null);
  const [info, setInfo] = useState(false);
  useEffect(() => { setTab('overview'); setSeason('1'); setEpisode(null); setInfo(false); }, [itemId]);
  if (!item) return <div className="content-page">
<EmptyState title="This Story Took A Different Turn." description="We couldn’t find that title in the demo library.">
<Link className="button primary" to="/library">Back to the library</Link>
</EmptyState>
</div>;
  const saved = watchlist.includes(item.id);
  const favorite = favorites.includes(item.id);
  const finished = watched.includes(item.id);
  const related = media.filter(m => m.id !== item.id && m.genres.some(g => item.genres.includes(g)));
  return <div className="detail-page">
<section className="detail-hero">
<div className="detail-visual"><Artwork item={item}/></div>
<div className="detail-shade"/>
<Link className="detail-back" to={item.kind === 'show' ? '/shows' : '/movies'}>
<ArrowLeft size={16}/> {item.kind === 'show' ? 'TV Shows' : 'Movies'}</Link>
<div className="detail-heading">

<h1>{item.title}</h1>
<div className="detail-meta">
<span className="score">
<Star size={14} fill="currentColor"/>{item.score}</span>
<span>{item.year}</span>
<span className="rating-badge">{item.rating}</span>
<span>{item.kind === 'show' ? `${item.seasons} seasons` : duration(item.runtime)}</span>
<span className="quality-badge">4K</span>
</div>

<div className="detail-actions">
<button className="button hero-primary" onClick={() => { toggleWatchlist(item.id); notify(saved ? 'Removed from your watchlist' : 'Added to your watchlist'); }}>{saved ? <Check size={18}/> : <Bookmark size={18}/>} {saved ? 'On your watchlist' : 'Add to watchlist'}</button>
<button className={`button hero-secondary ${favorite ? 'selected' : ''}`} aria-pressed={favorite} onClick={() => toggleFavorite(item.id)}>
<Heart size={18} fill={favorite ? 'currentColor' : 'none'}/>
<span>{favorite ? 'Favorited' : 'Favorite'}</span>
</button>
<button className="button hero-secondary" aria-label={finished ? 'Mark as unwatched' : 'Mark as watched'} aria-pressed={finished} onClick={() => { toggleWatched(item.id); notify(finished ? 'Marked as unwatched' : 'Marked as watched'); }}>
<Check size={18}/>
<span>{finished ? 'Watched' : 'Mark watched'}</span>
</button>
</div>
</div>
</section>
    <div className="detail-body">
<div className="detail-tabs" role="tablist" aria-label="Title details">{[{ id: 'overview', label: 'Overview' }, ...(item.kind === 'show' ? [{ id: 'episodes', label: 'Episodes' }] : []), { id: 'related', label: 'More like this' }].map(t => <button role="tab" id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} aria-selected={tab === t.id} key={t.id} tabIndex={tab === t.id ? 0 : -1} onKeyDown={event => {
        const ids = item.kind === 'show' ? ['overview', 'episodes', 'related'] : ['overview', 'related'];
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = ids.indexOf(tab);
        const next = event.key === 'Home' ? ids[0] : event.key === 'End' ? ids[ids.length - 1] : ids[(current + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length];
        setTab(next);
        document.getElementById(`tab-${next}`)?.focus();
      }} onClick={() => setTab(t.id)}>{t.label}</button>)}<button className="technical-info" onClick={() => setInfo(true)}>
<Info size={15}/> Media info</button>
</div>
      {tab === 'overview' && <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
<div className="overview-layout">
<div className="synopsis">

<div className="overview-heading"><h2>Overview</h2><GenreLinks genres={item.genres}/></div>
<p>{item.overview}</p><TitleTagLinks id={item.id}/>
</div>
<DetailFacts facts={[{ label: 'Directed by', value: personName(item.director) }, { label: 'Release year', value: item.year }, { label: 'Runtime', value: item.kind==='show'?undefined:duration(item.runtime) }, { label: 'Audience rating', value: `${item.score} / 10` }, { label: 'Certification', value: item.rating }, { label: 'Collection', value: item.kind === 'show' ? 'TV Shows' : 'Movies' }, { label: 'Watch status', value: finished ? 'Watched' : 'Unwatched' }]}/>
</div>
<CastCarousel people={item.cast.map((Name,i)=>({Name,Role:i===0?'Lead':'Supporting'}))} personLink={person=>`/person/${encodeURIComponent(person.Name??'')}`}/>{item.kind === 'show' && <button className="season-callout" onClick={() => setTab('episodes')}>
<span>
<strong>A new chapter is waiting.</strong>
<small>Explore {item.seasons} seasons of {item.title}</small>
</span>
<ArrowRight size={22}/>
</button>}</div>}
      {tab === 'episodes' && <section className="episodes-panel" role="tabpanel" id="panel-episodes" aria-labelledby="tab-episodes">
<div className="section-heading">
<div className="episode-heading-title"><h2>Episodes</h2>
<Select aria-label="Select season" className="select-control season-picker" menuClassName="season-picker-menu" value={season} onValueChange={value=> setSeason(value)}>{Array.from({ length: item.seasons ?? 1 }, (_, i) => <option key={i} value={i + 1}>Season {i + 1}</option>)}</Select></div>
<EpisodeCardSize/>
</div>
<div className="episode-list">{episodeNames.map((title, i) => <article className="episode" key={title}><WatchedToggle demoId={`${item.id}:s${season}:e${i+1}`} title={`${title} · S${season} E${i+1}`}/><button className="episode-open" onClick={() => setEpisode(i)}>
<div className="episode-art">
<Artwork item={item}/>
<span>{String(i + 1).padStart(2, '0')}</span>
</div>
<span className="episode-description">
<small>SEASON {season} · EPISODE {i + 1}</small>
<strong>{title}</strong>
<span>A fresh perspective brings familiar faces together as a new piece of the story unfolds.</span>
</span>
<span className="episode-runtime">{formatMinutes(item.runtime + (i * 3) % 8)}<ChevronRight size={16}/>
</span>
</button></article>)}</div>
</section>}
      {tab === 'related' && <div role="tabpanel" id="panel-related" aria-labelledby="tab-related">
<MediaRow title="Stay In This World A Little Longer." items={related} to={`/library?genre=${encodeURIComponent(item.genres[0])}`}/>
</div>}
      <div className="preview-footnote">
<Info size={14}/>
<span>Fictional catalog. Episode and media details are illustrative; playback isn’t part of this preview.</span>
</div>
    </div>
    {episode !== null && <Modal title={`S${season} · E${episode + 1} — ${episodeNames[episode]}`} onClose={() => setEpisode(null)}>
<div className="episode-modal-art">
<Artwork item={item}/>
</div>
<p>In this fictional episode of {item.title}, an unexpected discovery brings a new perspective to the journey. Old questions find new answers, and a familiar place begins to feel different.</p>
<p className="muted">{formatMinutes(item.runtime + (episode * 3) % 8)} · {item.rating} · Mock episode details</p>
<button className="button primary" onClick={() => { notify('Episode marked as explored'); setEpisode(null); }}>Mark as explored <Check size={16}/>
</button>
</Modal>}
    {info && <Modal title="Media Information" onClose={() => setInfo(false)}>
<p>Illustrative metadata for this preview. No media file or server is connected.</p>
<dl className="media-info-list">
<div>
<dt>Title</dt>
<dd>{item.title}</dd>
</div>
<div>
<dt>Library</dt>
<dd>{item.kind === 'show' ? 'TV Shows' : 'Movies'}</dd>
</div>
<div>
<dt>Display quality</dt>
<dd>4K · illustrative</dd>
</div>
<div>
<dt>Artwork</dt>
<dd>Original local SVG</dd>
</div>
<div>
<dt>Source</dt>
<dd>Fictional mock data</dd>
</div>
</dl>
<TitleTagsEditor id={item.id}/><MetadataPreview item={item}/>
</Modal>}
  </div>;
}
export function Person() {
  const { name = '' } = useParams();
  const items = media.filter(m => m.cast.includes(name));
  return <div className="content-page person-page">
<Link to="/library" className="text-link">
<ArrowLeft size={16}/> Back to the library</Link>
<header className="person-heading">
<span className="cast-avatar tone-1">{name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
<div>
<span className="eyebrow">IN FRONT OF THE CAMERA</span>
<h1>{name || 'Unknown person'}</h1>
<p>Fictional performer · Demo filmography</p>
</div>
</header>{items.length ? <MediaRow title="In Your Library" items={items}/> : <EmptyState title="A Story Still To Be Told." description="This person isn’t in the demo catalog."/>}</div>;
}



