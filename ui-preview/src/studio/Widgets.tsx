import {fitWidgetCards} from './cardLayout';
import {useTitleTags} from '../state/TitleTags';
import {selectedTag,taggedIds,loadTaggedItems} from '../state/tagSelection';
import {formatPlaybackProgress} from '../platform/duration';
import {readEarlyProgress,earlyProgressItems,earlyProgressStore} from '../playback/earlyProgress';
import {WatchlistToggle} from '../components/WatchlistToggle';
import {headingCase} from '../components/headingCase';
import {useOnline} from '../providers/context';
import {displayGenres,genreCandidates,genreSectionItems} from '../providers/genres';
import {FavoriteToggle} from '../components/FavoriteToggle';
import {useEpisodeDetails} from '../providers/hooks';
import {WatchedToggle} from '../components/WatchedToggle';
import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {Link} from 'react-router';
import {ChevronLeft,ChevronRight,Film,Tv,Layers,RefreshCw} from 'lucide-react';
import {useStudio} from './context';
import {continueItems,widgetQuery,type Category,type Widget} from './model';
import {thumbnail} from './images';
import {media,type MediaItem} from '../data/media';
import {Artwork} from '../components/Artwork';
import {MediaCard} from '../components/MediaCard';
import {ServerArtwork} from '../components/ServerArtwork';
import {EpisodeArtwork} from '../components/EpisodeArtwork';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {imageSource,itemTitle,runtime} from '../jellyfin/presentation';
import {episodeLabel,episodeTitle} from '../providers/metadata';
import type {ItemDto} from '../jellyfin/types';
import {usePreview} from '../state/PreviewContext';
export const widgetRegistry={continue:{label:'Continue Watching',description:'In-progress series from your latest playback activity.'},categories:{label:'Category Grid',description:'Quick access across your accessible libraries.'},recent:{label:'Recently Added',description:'Latest additions, ordered by server date added.'},custom:{label:'Custom Section',description:'Choose your titles and arrange them your way.'}};
export function HomeWidgets(){const {config}=useStudio();const {session}=useConnection();return <div className="home-widgets">{config.widgets.filter(w=>w.visible).map(w=>w.kind==='categories'?<Categories key={w.id} widget={w}/>:session?<ServerWidget key={w.id} widget={w}/>:<MockWidget key={w.id} widget={w}/>)}{!config.widgets.some(w=>w.visible)&&<div className="empty-home"><h2>Make Room For Your Stories.</h2><Link className="button primary" to="/settings?studio=home">Add home sections</Link></div>}</div>;}
function WidgetFrame({widget:w,children,loading,error,retry,count}:{widget:Widget;children:ReactNode;loading?:boolean;error?:string;retry?:()=>void;count:number}){
 const row=useRef<HTMLDivElement>(null);const probe=useRef<HTMLSpanElement>(null);const [layout,setLayout]=useState({columns:1,width:0});
 useLayoutEffect(()=>{
  const element=row.current,sizer=probe.current;if(!element||!sizer)return;
  const measure=()=>{const gap=parseFloat(getComputedStyle(element).columnGap)||0;const next=fitWidgetCards(element.clientWidth,sizer.getBoundingClientRect().width,gap);setLayout(previous=>previous.columns===next.columns&&Math.abs(previous.width-next.width)<.1?previous:next);};
  measure();const observer=new ResizeObserver(measure);observer.observe(element);observer.observe(sizer);return()=>observer.disconnect();
 },[]);
 const {preferences}=usePreview();const move=(direction:number)=>row.current?.scrollBy({left:direction*(row.current.clientWidth+(parseFloat(getComputedStyle(row.current).columnGap)||0)),behavior:preferences.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 return <section className={`media-section home-widget widget-${w.layout} widget-size-${w.size} ${w.kind==='continue'?'widget-continue':''} ${w.art!=='poster'?'widget-backdrops':''}`} data-widget-id={w.id} style={{'--widget-columns':layout.columns,'--widget-card-width':layout.width?`${layout.width}px`:undefined,'--widget-gap':`${w.spacing}px`,'--widget-width':w.size==='small'?'calc(var(--poster-width) - 22px)':w.size==='large'?'calc(var(--poster-width) + 68px)':'calc(var(--poster-width) + 13px)'} as CSSProperties}><header className="section-heading"><div><h2>{headingCase(w.title)}</h2></div><div className="row-controls">{retry&&<button className="text-link" onClick={retry} disabled={loading} aria-label={`Reload ${w.title}`}><RefreshCw size={15}/></button>}{w.layout!=='grid'&&<><button className="icon-button" aria-label={`Scroll ${w.title} left`} onClick={()=>move(-1)}><ChevronLeft size={18}/></button><button className="icon-button" aria-label={`Scroll ${w.title} right`} onClick={()=>move(1)}><ChevronRight size={18}/></button></>}</div></header>{error&&<p className="widget-message" role="alert">{error} {retry&&<button className="text-link" onClick={retry}>Try again</button>}</p>}{loading&&!count&&<p className="widget-message" role="status">Loading your collection…</p>}<div className="widget-items" ref={row}><span ref={probe} className="widget-size-probe" aria-hidden="true"/>{children}</div>{!loading&&!error&&!count&&<p className="widget-message">{w.kind==='continue'?'Nothing is in progress yet.':w.source==='selection'?'Choose titles in Settings → Home Sections.':'No titles match this section.'}</p>}</section>;
}
function ServerWidget({widget:w}:{widget:Widget}){
 const {client,session}=useConnection();const {client:online}=useOnline();const query=widgetQuery(w);
 const {tags}=useTitleTags();const tag=selectedTag(w.genre);const tagIds=tag?taggedIds(tags,tag):undefined;
 const result=useRemote(`widget:${JSON.stringify([query,w.source,w.selection,!!online,tagIds])}`,async()=>{
  if(w.kind==='continue'){
   const records=readEarlyProgress(session!,earlyProgressStore());
   const [resume,next,early]=await Promise.allSettled([client!.items(session!.user.Id,query),client!.nextUp(session!.user.Id,40,w.library||undefined),records.length?client!.itemsById(session!.user.Id,records.map(row=>row.id),w.library||undefined):Promise.resolve({Items:[]})]);
   if(resume.status==='rejected'&&next.status==='rejected')throw resume.reason;
   // Retain the available pool. The live display limit is applied below, so
   // changing it does not reuse a response already truncated to the old limit.
   return continueItems(resume.status==='fulfilled'?resume.value.Items:[],{...w,limit:40},next.status==='fulfilled'?next.value.Items:[],early.status==='fulfilled'?earlyProgressItems(early.value.Items,records):[]);
  }
  if(w.kind==='custom'&&w.source==='genre'&&!w.genre)return [];
  if(w.kind==='custom'&&w.source==='selection'){const rows=await Promise.allSettled(w.selection.slice(0,w.limit).map(id=>client!.item(session!.user.Id,id)));return rows.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);}
  if(tagIds&&w.source!=='selection')return loadTaggedItems(tagIds,query,part=>client!.items(session!.user.Id,part));
  if(w.genre&&w.source!=='selection')return genreSectionItems(start=>client!.items(session!.user.Id,{...query,genre:genreCandidates(w.genre),start,limit:40}),w.genre,w.limit,online?item=>online.enrich(item):undefined);
  return(w.kind==='custom'&&w.source==='nextup'?await client!.nextUp(session!.user.Id,w.limit,w.library||undefined):await client!.items(session!.user.Id,query)).Items;
 });
 const refresh=useRef(result.revalidate);refresh.current=result.revalidate;
 useEffect(()=>{if(w.source!=='favorites'||w.kind!=='custom')return;const update=(event:Event)=>{if((event as CustomEvent).detail?.client===client)refresh.current();};window.addEventListener('frame:favorite-updated',update);return()=>window.removeEventListener('frame:favorite-updated',update);},[client,w.kind,w.source]);
 useEffect(()=>{const update=()=>{if(!document.hidden)refresh.current();};const timer=setInterval(update,60000);window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};},[]);
 const items=(result.data??[]).filter((v,i,all)=>all.findIndex(other=>other.Id===v.Id)===i).slice(0,w.limit);
 return <WidgetFrame widget={w} loading={result.loading} error={result.error} retry={result.retry} count={items.length}>{items.map(item=><ServerWidgetCard key={item.Id} item={item} widget={w}/>)}</WidgetFrame>;
}
function ServerWidgetCard({item,widget:w}:{item:ItemDto;widget:Widget}){
 const {client,session}=useConnection();const wantsStill=w.art==='episode'&&item.Type==='Episode';
 const full=useRemote(`widget-episode-art:${wantsStill?item.Id:''}`,()=>wantsStill&&client&&session?client.item(session.user.Id,item.Id):Promise.resolve(item),false);
 const {preferences}=usePreview();const details=useEpisodeDetails(wantsStill?(full.data??item):item);const display=details.item??item;const isEpisode=item.Type==='Episode';const position=item.UserData?.PlaybackPositionTicks??0;const progress=position>0&&item.RunTimeTicks?Math.max(0,Math.min(100,position/item.RunTimeTicks*100)):undefined;
 const title=isEpisode?item.SeriesName??'TV series':itemTitle(item);const destination=isEpisode&&item.SeriesId?item.SeriesId:item.Id;
 const cardDestination=w.kind==='continue'?`/play/${encodeURIComponent(item.Id)}?choose`:`/item/${encodeURIComponent(destination)}`;
 return <article className="media-card"><div className="poster">{wantsStill?<EpisodeArtwork item={display} still={details.online?.still} stillFallback={details.online?.stillFallback}/>:<ServerArtwork item={item} backdrop={w.art!=='poster'&&!!imageSource(item,true)}/>}<Link className="poster-link" to={cardDestination} aria-label={`${w.kind==='continue'?'Continue':'View'} ${title}`}/ >{progress!==undefined&&<div className="progress-track" role="progressbar" aria-label={`${title} resume progress`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${progress}%`}}/></div>}</div><div className="card-utility-row" role="group" aria-label={`Actions for ${title}`}><FavoriteToggle item={item}/><WatchlistToggle item={item}/><WatchedToggle item={item} title={isEpisode?`${title} · ${episodeLabel(item)}`:title}/></div>{w.kind==='continue'?<ContinueInfo item={item} display={display} title={title} showRatings={preferences.showRatings}/>: (preferences.showTitles||isEpisode)&&<div className="card-info"><Link className="card-title" to={`/item/${encodeURIComponent(destination)}`}>{title}</Link>{isEpisode&&<p className="widget-episode">{episodeTitle(display)&&<strong>{episodeTitle(display)}</strong>}<span>{episodeLabel(item)}</span></p>}<div className="card-meta"><span>{isEpisode?position>0?formatPlaybackProgress(position/10000000,item.RunTimeTicks?item.RunTimeTicks/10000000:undefined):runtime(item):[item.ProductionYear,displayGenres(item.Genres)[0]].filter(Boolean).join(' · ')}</span>{preferences.showRatings&&item.CommunityRating!==undefined&&<span>★ {item.CommunityRating.toFixed(1)}</span>}</div></div>}</article>;
}
function ContinueInfo({item,display,title,showRatings}:{item:ItemDto;display:ItemDto;title:string;showRatings:boolean}){
 const episode=item.Type==='Episode';const position=item.UserData?.PlaybackPositionTicks??0;
 const detailDestination=`/item/${encodeURIComponent(episode&&item.SeriesId?item.SeriesId:item.Id)}`;
 const detail=episode?episodeTitle(display)||episodeLabel(item):item.ProductionYear?String(item.ProductionYear):'';
 return <div className="card-info continue-info">
  <Link className="card-title" to={detailDestination}>{title}</Link>
  <Link className="continue-detail" title={detail} to={detailDestination}>{detail}</Link>
  <div className="continue-metadata"><span className="continue-context">{episode?episodeLabel(item):''}</span><span className="continue-progress">{formatPlaybackProgress(position/10000000,item.RunTimeTicks?item.RunTimeTicks/10000000:undefined)}</span></div>
  <div className="continue-rating">{showRatings&&item.CommunityRating!==undefined&&<span aria-label={`Rating ${item.CommunityRating.toFixed(1)} out of 10`}>★ {item.CommunityRating.toFixed(1)}</span>}</div>
 </div>;
}
function MockWidget({widget:w}:{widget:Widget}){
 const {tags}=useTitleTags();const tag=selectedTag(w.genre);
 const {favorites,watched}=usePreview();let items:MediaItem[]=[...media];
 if(w.kind==='continue')items=items.filter(m=>m.progress&&(w.includeMovies||m.kind==='show'));
 else if(w.kind==='recent')items=items.filter(m=>m.new);
 else if(w.source==='favorites')items=items.filter(m=>favorites.includes(m.id));
 else if(w.source==='selection')items=w.selection.flatMap(id=>media.find(m=>m.id===id)?[media.find(m=>m.id===id)!]:[]);
 else if(w.source==='nextup')items=items.filter(m=>m.kind==='show'&&m.progress);
 if(w.source!=='selection'&&w.kind!=='continue'&&w.media!=='all')items=items.filter(m=>m.kind===(w.media==='Movie'?'movie':'show'));
 if(w.source!=='selection'&&w.genre)items=items.filter(m=>tag?taggedIds(tags,tag).includes(m.id):m.genres.includes(w.genre));if(w.source!=='selection'&&w.year)items=items.filter(m=>m.year===Number(w.year));if(w.source!=='selection'&&w.minRating)items=items.filter(m=>m.score>=w.minRating);
 if(w.source!=='selection'&&(w.source==='unwatched'||w.watched==='unwatched'))items=items.filter(m=>!watched.includes(m.id));if(w.source!=='selection'&&w.watched==='watched')items=items.filter(m=>watched.includes(m.id));
 if(w.source!=='selection'&&(w.source==='rated'||w.sort==='CommunityRating'))items.sort((a,b)=>b.score-a.score);else if(w.source!=='selection'&&(w.source==='released'||w.sort==='PremiereDate'))items.sort((a,b)=>b.year-a.year);else if(w.source!=='selection'&&w.sort==='SortName')items.sort((a,b)=>a.title.localeCompare(b.title));
 items=items.slice(0,w.limit);return <WidgetFrame widget={w} count={items.length}>{items.map(item=><MediaCard key={item.id} item={item} continueWatching={w.kind==='continue'} landscape={w.art!=='poster'}/>)}</WidgetFrame>;
}
export function Categories({widget:w,editor=false}:{widget:Widget;editor?:boolean}){
 useStudio();const {session}=useConnection();return session?<ServerCategories widget={w} editor={editor}/>:<CategoryGrid widget={w} editor={editor} items={[]} supported={['movies','shows']}/>;
}
function ServerCategories({widget:w,editor}:{widget:Widget;editor:boolean}){
 const {client,session}=useConnection();const data=useRemote('category-discovery',async()=>{const [libraries,counts,items]=await Promise.all([client!.libraries(session!.user.Id),client!.counts(session!.user.Id),client!.items(session!.user.Id,{sort:'DateCreated',limit:40})]);return{libraries: libraries.Items,counts,items:items.Items};});
 const supported=[...(data.data?.counts.movies?['movies']:[]),...(data.data?.counts.series?['shows']:[]),...(data.data?.libraries.map(l=>l.Id)??[])];
 return <><CategoryGrid widget={w} editor={editor} items={data.data?.items??[]} supported={supported}/>{data.error&&<p className="widget-message">Categories could not be discovered. <button className="text-link" onClick={data.retry}>Try again</button></p>}</>;
}
function CategoryGrid({widget:w,editor,items,supported}:{widget:Widget;editor:boolean;items:ItemDto[];supported:string[]}){
 const {config}=useStudio();const categories=config.categories.filter(c=>c.visible&&(editor||c.target==='genre'||supported.includes(c.target==='library'?c.value:c.target)));
 const layout=config.categoryLayout;
 return <section className="media-section category-widget" data-widget-id={w.id}><header className="section-heading"><h2>{headingCase(w.title)}</h2>{!editor&&<Link className="text-link" to="/settings?studio=home">Customize</Link>}</header><div className={`category-grid category-mode-${layout.presentation} category-${layout.shape} category-labels-${layout.labels}`} style={{'--category-columns':layout.columns,'--category-count':Math.max(1,categories.length),'--category-height':`${layout.height}px`,'--category-radius':`${layout.radius}px`} as CSSProperties}>{categories.map(c=><CategoryTile key={c.id} category={c} items={items}/>)}</div>{!categories.length&&<p className="widget-message">No supported categories are visible. Edit the grid in Settings.</p>}</section>;
}
export function CategoryTile({category:c,items=[],preview=false}:{category:Category;items?:ItemDto[];preview?:boolean}){
 const {scope,config}=useStudio();const minimal=config.categoryLayout.presentation==='minimal';const {session,client}=useConnection();const [upload,setUpload]=useState<string>();
 useEffect(()=>{let active=true;let url:string|undefined;setUpload(undefined);if(c.image==='upload'&&c.imageKey?.startsWith(scope+':'))void thumbnail(c.imageKey).then(blob=>{if(blob&&active){url=URL.createObjectURL(blob);setUpload(url);}},()=>{});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[c.image,c.imageKey,scope]);
 const chosen=useRemote(`category-art:${c.id}:${c.image}:${c.itemId}`,()=>!minimal&&c.image==='library'&&session&&c.itemId?client!.item(session.user.Id,c.itemId):Promise.resolve(undefined));
 const automatic=items.find(i=>c.target==='movies'?i.Type==='Movie':c.target==='shows'?i.Type==='Series':c.target==='genre'?i.Genres?.includes(c.value):true);
 const item=chosen.data??automatic;const mock=c.image==='library'?media.find(m=>m.id===c.itemId):media.find(m=>c.target==='movies'?m.kind==='movie':c.target==='shows'?m.kind==='show':m.genres.includes(c.value))??media[c.placeholder%media.length];
 const art=c.image==='upload'&&upload?<img src={upload} alt=""/>:c.image!=='builtin'&&c.image!=='upload'?(session?item?<ServerArtwork item={item} backdrop={!!imageSource(item,true)} fit={imageSource(item,true)?'cover':'contain'}/>:null:mock?<Artwork item={mock}/>:null):null;
 const content=<>{minimal?<span className="category-symbol">{c.target==='shows'?<Tv size={23}/>:<Film size={23}/>}</span>:<div className={`category-art placeholder-${c.placeholder}`} style={{'--category-zoom':c.zoom,'--category-x':`${c.x}%`,'--category-y':`${c.y}%`} as CSSProperties}>{art??<><div className="category-orbit"/><Film size={38}/></>}</div>}<span className="category-title">{c.title}</span><Layers className="category-arrow" size={19}/></>;
 const target=c.target==='movies'?'/movies':c.target==='shows'?'/shows':`/library?${new URLSearchParams({[c.target==='genre'?'genre':'library']:c.value})}`;
 return preview?<div className={`category-tile ${minimal?'category-minimal':'category-artwork'}`}>{content}</div>:<Link className={`category-tile ${minimal?'category-minimal':'category-artwork'}`} to={target}>{content}</Link>;
}




