import {EpisodeArtwork} from '../components/EpisodeArtwork';
import {WatchedToggle} from '../components/WatchedToggle';
import {EpisodeCardSize} from '../components/EpisodeCardSize';
import {Select} from '../components/Select';
import {useEffect} from 'react';
import {useRichItem} from '../providers/hooks';
import {episodeLabel, episodeTitle, type OnlineMetadata} from '../providers/metadata';
import {useRef, useState} from 'react';
import {useNavigate} from 'react-router';
import {Star} from 'lucide-react';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {itemTitle, runtime} from '../jellyfin/presentation';
import type {ItemDto} from '../jellyfin/types';
import {usePreview} from '../state/PreviewContext';
import {RequestStatus, Pagination} from './LiveShared';
interface EpisodeSelection { item:ItemDto; original:ItemDto; online?:OnlineMetadata|null; fields:string[] }
export function LiveEpisodes({ series }: { series: ItemDto }) {
  const seriesId=series.Id;
  const { client, session } = useConnection();
  const seasons = useRemote(`seasons:${seriesId}`, () => client!.seasons(session!.user.Id, seriesId));
  const [selected, setSelected] = useState(''); const seasonId = selected || seasons.data?.Items.find(s=>s.IndexNumber===1)?.Id || seasons.data?.Items[0]?.Id;
  const [start, setStart] = useState(0); const navigate=useNavigate();
  useEffect(()=>{setSelected('');setStart(0);},[seriesId]);
  const result = useRemote(`episodes:${seriesId}:${seasonId}:${start}`, () => seasonId ? client!.episodes(session!.user.Id, seriesId, seasonId, start) : Promise.resolve({ Items: [], TotalRecordCount: 0 }));
  return <section className="episodes-panel">
<RequestStatus {...seasons}/>
<div className="section-heading">
<div className="episode-heading-title"><h2>Episodes</h2>
<Select className="select-control season-picker" menuClassName="season-picker-menu" aria-label="Jellyfin season" value={seasonId ?? ''} onValueChange={value=> { setSelected(value); setStart(0); }}>{seasons.data?.Items.map(s => <option key={s.Id} value={s.Id}>{s.Name || `Season ${s.IndexNumber ?? '—'}`}</option>)}</Select></div>
<EpisodeCardSize/>
</div>
<RequestStatus {...result}/>
<div className="episode-list">{result.data?.Items.map(e => <RichEpisode key={e.Id} episode={e} series={series} open={selection=>navigate(`/play/${encodeURIComponent(selection.original.Id)}`)}/>)}</div>{!result.loading && !result.error && !result.data?.Items.length && <p className="muted">No episodes available for this season.</p>}{result.data && <Pagination start={start} total={result.data.TotalRecordCount} count={result.data.Items.length} loading={result.loading} change={setStart}/>}</section>;
}












function RichEpisode({episode,series,open}:{episode:ItemDto;series:ItemDto;open:(item:EpisodeSelection)=>void}) {
  const host=useRef<HTMLElement>(null);const [visible,setVisible]=useState(false);
  useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'100px'});if(host.current)observer.observe(host.current);return()=>observer.disconnect();},[]);
  const rich=useRichItem(episode,series,visible);const item=rich.item!;
  const {preferences}=usePreview();
  return <article ref={host} className="episode"><WatchedToggle item={episode} title={`${episodeLabel(item)} · ${episodeTitle(item)||itemTitle(item)}`}/><button className="episode-open" onClick={()=>open({item,original:episode,online:rich.online,fields:rich.fields})}>
    <div className="episode-art"><EpisodeArtwork item={episode} still={rich.online?.still} stillFallback={rich.online?.stillFallback}/></div>
    <span className="episode-description"><small>{episodeLabel(item)}</small>{episodeTitle(item)&&<strong>{episodeTitle(item)}</strong>}{item.Overview?.trim()&&<span>{item.Overview.trim()}</span>}{rich.error&&<span className="episode-provider">{rich.error}</span>}</span>
    <span className="episode-stats">{preferences.showRatings&&item.CommunityRating!==undefined&&<span className="episode-score"><Star size={15}/>{item.CommunityRating.toFixed(1)} / 10</span>}{runtime(item)&&<span>{runtime(item)}</span>}</span>
  </button></article>;
}
