import {TitleTagsEditor, TitleTagLinks} from '../components/TitleTags';
import {formatMinutes} from '../platform/duration';
import {WatchlistToggle} from '../components/WatchlistToggle';
import {IdentifyMedia} from '../components/IdentifyMedia';
import {ArtworkPicker} from '../components/BannerPicker';
import {providerFacts} from '../components/metadataPresentation';
import {FavoriteToggle} from '../components/FavoriteToggle';
import {directorCredits} from '../providers/verifiedCredits';
import {GenreLinks} from '../components/GenreLinks';
import {personName, premiereDate} from '../components/detailPresentation';
import {WatchButton} from '../playback/WatchButton';
import {useRichItem} from '../providers/hooks';
import {CastSection} from '../components/CastSection';
import {DetailArtwork} from '../components/DetailArtwork';
import {DetailFacts} from '../components/DetailFacts';
import {useState} from 'react';
import {Link, useParams} from 'react-router';
import {ArrowLeft, ChevronRight, Info} from 'lucide-react';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {itemCoverage, itemTitle, runtime} from '../jellyfin/presentation';
import {Modal} from '../components/Primitives';
import {RequestStatus, Score} from './LiveShared';
import {LiveEpisodes} from './LiveEpisodes';
export function LiveDetail() {
  const { itemId = '' } = useParams(); const { client, session } = useConnection();
  const data = useRemote(`detail:${itemId}`, () => client!.item(session!.user.Id, itemId));
  const [info, setInfo] = useState(false); const [episodes, setEpisodes] = useState(false);
  const [identifying,setIdentifying]=useState(false);
  const rich = useRichItem(data.data);
  const item = rich.item;
  if (!item) return <div className="content-page">
<RequestStatus {...data}/>
</div>;

  const credits = directorCredits(data.data!);
  const director = credits.names.map(name => personName(name)).join(', ');
  const coverage = itemCoverage(data.data!, true);
  return <div className="detail-page">
<section className="detail-hero">
<DetailArtwork item={data.data!} online={rich.online}/><div className="detail-shade"/>
<Link className="detail-back" to={item.Type === 'Series' ? '/shows' : '/movies'}>
<ArrowLeft size={16}/> {item.Type === 'Series' ? 'TV Shows' : 'Movies'}</Link>
<div className="detail-heading">

<h1>{itemTitle(item)}</h1>
<div className="detail-meta">
<Score item={item}/>{item.ProductionYear && <span>{item.ProductionYear}</span>}{item.OfficialRating && <span className="rating-badge">{item.OfficialRating}</span>}{item.Type!=='Series'&&runtime(item) && <span>{runtime(item)}</span>}</div><div className="detail-actions">
<div className="detail-play-stack"><WatchButton item={data.data!}/>{!!data.data?.UserData?.PlaybackPositionTicks&&item.Type!=='Series'&&<div className="detail-start-over"><WatchButton item={data.data!} restart/></div>}</div><div className="detail-saves" role="group" aria-label="Save this title"><FavoriteToggle item={data.data!} variant="button"/><WatchlistToggle item={data.data!} variant="button"/></div>
</div>
</div>
</section>
    <div className="detail-body">
<div className="detail-tabs">
<button onClick={() => setEpisodes(false)} aria-pressed={!episodes}>Overview</button>{item.Type === 'Series' && <button onClick={() => setEpisodes(true)} aria-pressed={episodes}>Episodes</button>}<button className="technical-info" onClick={() => setInfo(true)}>
<Info size={15}/> Manage title</button>
</div>
<RequestStatus {...data} stale/>
      {episodes && item.Type === 'Series' ? <LiveEpisodes series={data.data!}/> : <>
<div className="overview-layout">
<div className="synopsis">

<div className="overview-heading"><h2>Overview</h2><GenreLinks genres={item.Genres}/></div>
<p>{item.Overview?.trim()}</p><TitleTagLinks id={item.Id}/>
</div>
<DetailFacts facts={[
  { label: 'Directed by', value: director || undefined },
  { label: 'Original title', value: item.OriginalTitle },
  { label: 'Premiere', value: premiereDate(item.PremiereDate) },
  { label: 'Release year', value: item.ProductionYear },
  { label: 'Runtime', value: item.Type==='Series'?undefined:runtime(item) },
  { label: 'Audience rating', value: item.CommunityRating !== undefined ? `${item.CommunityRating.toFixed(1)} / 10` : undefined },
  { label: 'Critic rating', value: item.CriticRating !== undefined ? `${item.CriticRating}%` : undefined },
  { label: 'Certification', value: item.OfficialRating },
  { label: 'Watch status', value: item.UserData?.Played === true ? 'Watched' : item.UserData?.Played === false ? 'Unwatched' : undefined },
  { label: 'Resume position', value: item.UserData?.PlaybackPositionTicks ? formatMinutes(Math.floor(item.UserData.PlaybackPositionTicks / 600000000)) : undefined },
  { label: 'Favorites', value: <FavoriteToggle item={data.data!} variant="inline"/> },
  ...providerFacts(item.ProviderIds).map(([provider, id]) => ({ label: `${provider} ID`, value: id })),
]}/>
</div>
<CastSection item={data.data!} online={rich.online}/>
</>}
      <p className="preview-footnote">
<Info size={14}/> Playback saves your viewing progress to Jellyfin. Identification and metadata remain unchanged.</p>
    </div>
    {info && <Modal title="Manage Title" className="manage-title-modal" onClose={() => setInfo(false)}>
<p className="manage-title-context">{itemTitle(item)}</p>
{session?.user.Policy?.IsAdministrator&&['Movie','Series'].includes(item.Type??'')&&<section className="manage-title-section"><h3>Metadata</h3><button className="identify-entry" onClick={()=>{setInfo(false);setIdentifying(true);}}><span><strong>Match &amp; Update Metadata</strong><small>Choose the right movie or series</small></span><ChevronRight size={18}/></button></section>}
<TitleTagsEditor id={item.Id}/><section className="manage-title-section"><h3>Artwork</h3><ArtworkPicker item={data.data!} kind="banner"/><ArtworkPicker item={data.data!} kind="card"/></section>
<details className="manage-media-details"><summary><span>Media Details</span><small>{coverage.present} fields available</small></summary><div>
<p className="muted">Metadata supplied by Jellyfin.</p>
<ul className="metadata-fields">{coverage.fields.filter(f => f.state !== 'not-applicable').map(f => <li key={f.field}>{f.label}: {f.state === 'missing' ? 'not provided' : f.state}</li>)}</ul>
<dl className="media-info-list">{providerFacts(item.ProviderIds).map(([provider,id]) => <div key={provider}>
<dt>{provider}</dt>
<dd>{id}</dd>
</div>)}</dl>
{credits.conflict&&<section aria-label="Director credit conflict"><h3>Director Credit Conflict</h3><p>Jellyfin lists: {credits.serverNames.join(', ')}.</p><p>frame. displays reviewed director credits. {credits.url&&<a href={credits.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Source reference</a>} The server record has not been changed.</p></section>}
 </div></details>
</Modal>}
<IdentifyMedia item={data.data!} visible={identifying} onClose={()=>setIdentifying(false)} onApplied={data.retry}/>
  </div>;
}
