import {WatchlistToggle} from '../components/WatchlistToggle';
import {displayGenres} from '../providers/genres';
import {FavoriteToggle} from '../components/FavoriteToggle';
import {WatchedToggle} from '../components/WatchedToggle';
import {Link} from 'react-router';
import {RefreshCw, Star} from 'lucide-react';
import {itemTitle} from '../jellyfin/presentation';
import type {ItemDto} from '../jellyfin/types';
import {ServerArtwork} from '../components/ServerArtwork';
import {usePreview} from '../state/PreviewContext';

export function RequestStatus({ loading, error, retry, stale = false }: { loading: boolean; error?: string; retry: () => void; stale?: boolean }) {
  return <>{loading && <p className="request-status" role="status">{stale ? 'Updating from Jellyfin…' : 'Loading your stories…'}</p>}{error && <div className="connection-error" role="alert">
<p>{error}{stale ? ' Previously loaded data is shown.' : ''}</p>
<button className="button secondary" onClick={retry}>Try again</button>
</div>}</>;
}
export function RefreshButton({ retry, loading }: { retry: () => void; loading: boolean }) { return <button className="text-link" disabled={loading} onClick={retry}>
<RefreshCw size={14}/> Reload</button>; }
export function Score({ item }: { item: ItemDto }) { return typeof item.CommunityRating === 'number' && item.CommunityRating >= 0 ? <span className="card-score">
<Star size={12}/>{item.CommunityRating.toFixed(1)}</span> : null; }
export function LiveCard({ item }: { item: ItemDto }) {
  const { preferences } = usePreview();
  return <article className="media-card">
<div className="poster">
<ServerArtwork item={item}/>{!item.UserData?.Played && item.UserData?.PlaybackPositionTicks && item.RunTimeTicks ? <div className="progress-track" aria-label="Jellyfin resume position"><span style={{ width: `${Math.min(100, item.UserData.PlaybackPositionTicks / item.RunTimeTicks * 100)}%` }}/></div> : null}
<Link className="poster-link" to={`/item/${encodeURIComponent(item.Id)}`} aria-label={`View ${itemTitle(item)}`}/>
</div>
<div className="card-utility-row" role="group" aria-label={`Actions for ${itemTitle(item)}`}><FavoriteToggle item={item}/><WatchlistToggle item={item}/><WatchedToggle item={item} title={itemTitle(item)}/></div>
{preferences.showTitles && <div className="card-info">
<Link className="card-title" to={`/item/${encodeURIComponent(item.Id)}`}>{itemTitle(item)}</Link>
<div className="card-meta">
<span>{[item.ProductionYear, displayGenres(item.Genres)[0]].filter(v => v !== undefined && v !== '').join(' · ') || (item.Type === 'Series' ? 'TV series' : 'Movie')}</span>{preferences.showRatings && <Score item={item}/>}</div>
</div>}
</article>;
}
export function Pagination({ start, total, count, loading, change }: { start: number; total: number; count: number; loading: boolean; change: (start: number) => void }) {
  return <nav className="pagination" aria-label="Results pages">
<button className="button secondary" disabled={loading || start === 0} onClick={() => change(Math.max(0, start - 40))}>Previous</button>
<span>{total ? `${start + 1}–${start + count} of ${total}` : '0 titles'}</span>
<button className="button secondary" disabled={loading || count === 0 || start + count >= total} onClick={() => change(start + 40)}>Next</button>
</nav>;
}
