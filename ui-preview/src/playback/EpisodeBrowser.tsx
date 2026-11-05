import {MetadataCredit} from '../components/MetadataCredit';
import {useEffect,useRef,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Play,X} from 'lucide-react';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import type {ItemDto} from '../jellyfin/types';
import {runtime} from '../jellyfin/presentation';
import {useRichItem} from '../providers/hooks';
import {episodeLabel,episodeTitle} from '../providers/metadata';
import {EpisodeArtwork} from '../components/EpisodeArtwork';

/** Page-owned dialog: no playback negotiation until an episode is explicitly chosen. */
export function EpisodeBrowser({current,series,position,duration,close,choose}:{current:ItemDto;series?:ItemDto;position:number;duration:number;close:()=>void;choose:(item:ItemDto)=>void}){
 const {client,session}=useConnection();const dialog=useRef<HTMLDialogElement>(null);
 const seasons=useRemote(`player-seasons:${current.SeriesId}`,()=>client!.seasons(session!.user.Id,current.SeriesId!),false);
 const [selected,setSelected]=useState('');const [start,setStart]=useState(0);
 const seasonId=selected||seasons.data?.Items.find(s=>s.IndexNumber===current.ParentIndexNumber)?.Id||seasons.data?.Items[0]?.Id;
 const episodes=useRemote(`player-episodes:${current.SeriesId}:${seasonId}:${start}`,()=>seasonId?client!.episodes(session!.user.Id,current.SeriesId!,seasonId,start):Promise.resolve({Items:[],TotalRecordCount:0}),false);
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>dialog.current?.querySelector('[aria-current=true]')?.scrollIntoView({block:'center'}));return()=>cancelAnimationFrame(frame);},[episodes.data,current.Id]);
 return <dialog ref={dialog} className="player-episode-browser" aria-labelledby="episode-browser-title" onCancel={e=>{e.preventDefault();close();}} onKeyDown={e=>e.stopPropagation()}>
  <header><div><p>Episodes</p><h2 id="episode-browser-title">{series?.Name||current.SeriesName||'Your series'}</h2></div><button className="player-icon" aria-label="Close episodes" onClick={close}><X/></button></header>
  <div className="episode-browser-body"><nav aria-label="Seasons">
   {seasons.loading&&<p role="status">Loading seasons…</p>}{seasons.error&&<p role="alert">{seasons.error}<button onClick={seasons.retry}>Try again</button></p>}
   {seasons.data?.Items.map(season=><button key={season.Id} aria-pressed={seasonId===season.Id} onClick={()=>{setSelected(season.Id);setStart(0);}}><span>{season.Name||`Season ${season.IndexNumber??''}`}</span>{season.ChildCount!==undefined&&<small>{season.ChildCount} episodes</small>}</button>)}
  </nav><section className="episode-browser-list" aria-label="Season episodes">
   {episodes.loading&&<p role="status">Loading episodes…</p>}{episodes.error&&<p role="alert">{episodes.error}<button className="button secondary" onClick={episodes.retry}>Try again</button></p>}
   {episodes.data?.Items.map(item=><EpisodeRow key={item.Id} item={item} series={series} current={item.Id===current.Id} position={position} duration={duration} choose={()=>item.Id===current.Id?close():choose(item)}/>)}
   {!episodes.loading&&!episodes.error&&episodes.data&&!episodes.data.Items.length&&<p>No accessible episodes in this season.</p>}
   {!!episodes.data&&(episodes.data.TotalRecordCount>40||start>0)&&<nav className="episode-browser-pages" aria-label="Episode pages"><button className="player-icon" aria-label="Previous episode page" disabled={start===0||episodes.loading} onClick={()=>setStart(n=>Math.max(0,n-40))}><ChevronLeft/></button><span>{start+1}–{start+episodes.data.Items.length} of {episodes.data.TotalRecordCount}</span><button className="player-icon" aria-label="Next episode page" disabled={start+episodes.data.Items.length>=episodes.data.TotalRecordCount||episodes.loading} onClick={()=>setStart(n=>n+40)}><ChevronRight/></button></nav>}
  </section></div><MetadataCredit/>
 </dialog>;
}
function EpisodeRow({item,series,current,position,duration,choose}:{item:ItemDto;series?:ItemDto;current:boolean;position:number;duration:number;choose:()=>void}){
 const host=useRef<HTMLButtonElement>(null);const [visible,setVisible]=useState(false);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'120px'});if(host.current)observer.observe(host.current);return()=>observer.disconnect();},[]);
 const rich=useRichItem(item,series,visible);const display=rich.item??item;
 const progress=current&&duration>0?position/duration:item.UserData?.Played?1:item.RunTimeTicks?(item.UserData?.PlaybackPositionTicks??0)/item.RunTimeTicks:0;
 const date=display.PremiereDate&&Number.isFinite(Date.parse(display.PremiereDate))?new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(new Date(display.PremiereDate)):undefined;
 return <button ref={host} className={`episode-browser-row ${current?'is-current':''}`} aria-current={current?'true':undefined} onClick={choose}>
  <span className="episode-browser-art"><EpisodeArtwork item={item} still={rich.online?.still} stillFallback={rich.online?.stillFallback}/><span className="episode-browser-play"><Play size={18} fill="currentColor"/></span>{progress>0&&<span className="episode-browser-progress"><span style={{width:`${Math.min(100,Math.max(0,progress*100))}%`}}/></span>}</span>
  <span className="episode-browser-copy"><strong>{episodeTitle(display)||(rich.loading?'Loading title…':'Untitled episode')}</strong><span className="episode-browser-meta">{[episodeLabel(item),date,runtime(display)].filter(Boolean).join(' · ')}{display.CommunityRating!==undefined&&` · ★ ${display.CommunityRating.toFixed(1)}`}</span>{display.Overview?.trim()&&<span className="episode-browser-overview">{display.Overview.trim()}</span>}<span className="episode-browser-status">{current?'Now playing':item.UserData?.Played?<><Check size={13}/>Watched</>:null}</span></span>
 </button>;
}

