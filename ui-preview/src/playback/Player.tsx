import {formatPlaybackClock,formatPlaybackTime} from '../platform/duration';
import {readEarlyProgress,earlyResumeTicks,earlyProgressStore} from './earlyProgress';
import {CompletedScreen} from './CompletedScreen';
import {PlayerStory} from './PlayerStory';
import {SkipButton} from './SkipButton';
import {useStudio} from '../studio/context';
import {activeSegment,loadSkipping,SegmentSkipper,saveSkipping,type SegmentInfo,type SkippingPreferences} from './segments';
import {ResumePrompt} from './ResumePrompt';
import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router';
import {ArrowLeft,Play,Pause,Volume2,VolumeX,Maximize,Minimize,Settings,RotateCcw,LoaderCircle,Captions,RotateCw} from 'lucide-react';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {EpisodeBrowser} from './EpisodeBrowser';
import {useEpisodeDetails} from '../providers/hooks';
import type {ItemDto} from '../jellyfin/types';
import {episodeLabel,episodeTitle} from '../providers/metadata';
import {itemTitle} from '../jellyfin/presentation';
import {PlaybackRuntime,type PlayerSnapshot} from './runtime';
import {PlayerSettings,type PlayerTab} from './PlayerSettings';
import {captionAppearance,loadCaptionPreferences,saveCaptionPreferences} from './preferences';
import './player.css';
import {fullscreenAvailable,toggleVideoFullscreen,type SafariVideo} from './fullscreen';
import {projectedEnd,remainingSeconds} from './timing';
import type {previewControls} from './uiPreview';
const initial:PlayerSnapshot={phase:'idle',position:0,duration:0,paused:true,volume:1,muted:false,canHls:false};
export const clock=formatPlaybackTime;
export function PlayerRoute(){
 const {itemId=''}=useParams();const {session}=useConnection();
 if(!session)return <div className="player-unavailable"><h1>Sign In To Watch</h1><Link className="button primary" to="/connect">Connect to Jellyfin</Link></div>;
 return <Player key={itemId} itemId={itemId}/>;
}
export function Player({itemId,preview}:{itemId:string;preview?:{item:ItemDto;snapshot:()=>PlayerSnapshot;controls:typeof previewControls;segmentInfo?:SegmentInfo;initialTab?:PlayerTab}}){
 const {scope}=useStudio();const [segments,setSegments]=useState<{itemId:string;info?:SegmentInfo}>({itemId:''});
 const [skipPreferences,setSkipPreferences]=useState(()=>loadSkipping(scope,localStorage));
 useEffect(()=>setSkipPreferences(loadSkipping(scope,localStorage)),[scope]);
 const [segmentRevision,setSegmentRevision]=useState(0);
 const skipper=useRef(new SegmentSkipper());
 const [remaining,setRemaining]=useState(false);const [,updateWallClock]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>updateWallClock(n=>n+1),60000);return()=>clearInterval(timer);},[]);
 const [caption,setCaption]=useState(loadCaptionPreferences);const [playerTab,setPlayerTab]=useState<PlayerTab>(preview?.initialTab??'audio');
 const {client,session}=useConnection();const [params]=useSearchParams();const navigate=useNavigate();const video=useRef<HTMLVideoElement>(null);const host=useRef<HTMLDivElement>(null);const runtime=useRef<Pick<PlaybackRuntime,'subtitleDelay'|'toggle'|'seek'|'mute'|'volume'|'change'|'destroy'|'state'>|null>(null);
 useEffect(()=>{let active=true;skipper.current=new SegmentSkipper();setSegments({itemId:''});
  if(preview)setSegments({itemId,info:preview.segmentInfo??{status:'ready',segments:[]}});
  else if(client)void (segmentRevision?client.refreshMediaSegments(itemId):client.mediaSegmentInfo(itemId)).then(info=>{if(active)setSegments({itemId,info});});
  return()=>{active=false;};
 },[client,itemId,preview,scope,segmentRevision]);
 const [state,setState]=useState(preview?preview.snapshot:initial);const [rate,setRate]=useState(1);const settingsOpener=useRef<HTMLElement|null>(null);const [settings,setSettings]=useState(!!preview?.initialTab);const [visible,setVisible]=useState(true);const [fullscreen,setFullscreen]=useState(false);const [uiError,setUiError]=useState('');const [attempt,setAttempt]=useState(0);const inactivity=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const [canFullscreen,setCanFullscreen]=useState(false);
 const [pauseScreen,setPauseScreen]=useState(false);const pauseIdle=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const data=useRemote(`player-item:${itemId}`,()=>preview?Promise.resolve(preview.item):client!.item(session!.user.Id,itemId),false);const item=data.data;
 const episodeDetails=useEpisodeDetails(item);
 const [episodeBrowser,setEpisodeBrowser]=useState(false);const resumeAfterBrowser=useRef(false);const episodesOpener=useRef<HTMLElement|null>(null);
 const localStart=useRef<{key:string;ticks:number}>({key:'unloaded',ticks:0});
 const progressScope=session?JSON.stringify([session.baseUrl,session.server.Id,session.user.Id,itemId]):`preview:${itemId}`;
 if(item&&localStart.current.key!==progressScope){localStart.current={key:progressScope,ticks:!preview&&session?earlyResumeTicks(item,readEarlyProgress(session,earlyProgressStore()).find(row=>row.id===itemId)):item.UserData?.PlaybackPositionTicks??0};}
 const [entry,setEntry]=useState<'resume'|'restart'|null>(null);const choosing=!!item&&['Episode','Movie'].includes(item.Type??'')&&(localStart.current.ticks>0||params.has('choose'))&&!params.has('restart')&&!entry;
 const startTicks=params.has('restart')||entry==='restart'?0:localStart.current.ticks;
 useEffect(()=>{
  if(preview){runtime.current=preview.controls(setState);return()=>{runtime.current=null;};}
  if(!item||choosing||!video.current||!client||!session)return;
  let active=true;let player:PlaybackRuntime|undefined;let unsubscribe:(()=>void)|undefined;
  // StrictMode's discarded effect must not create a second server playback negotiation.
  queueMicrotask(()=>{if(!active||!video.current)return;host.current?.focus();player=new PlaybackRuntime(client,session,itemId,video.current);runtime.current=player;unsubscribe=player.subscribe(setState);void player.start({startTicks,maxBitrate:40000000});});
  const stop=()=>{void player?.destroy(true);};window.addEventListener('pagehide',stop);
  return()=>{active=false;window.removeEventListener('pagehide',stop);unsubscribe?.();if(runtime.current===player)runtime.current=null;void player?.destroy();};
 },[item,client,session,itemId,startTicks,attempt,preview,choosing]);
 function wake(){setVisible(true);setPauseScreen(false);clearTimeout(pauseIdle.current);clearTimeout(inactivity.current);if(state.paused&&state.plan&&['paused','ready'].includes(state.phase)&&!settings&&!episodeBrowser&&!choosing&&!state.error)pauseIdle.current=setTimeout(()=>{host.current?.focus({preventScroll:true});clearTimeout(pauseIdle.current);pauseIdle.current=undefined;setPauseScreen(true);},6000);if(preview)return;inactivity.current=setTimeout(()=>{if(!runtime.current?.state.paused&&!settings&&!episodeBrowser&&!host.current?.querySelector('.player-chrome:focus-within')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)setVisible(false);},3000);}
 useEffect(()=>{wake();return()=>{clearTimeout(inactivity.current);clearTimeout(pauseIdle.current);};},[state.paused,state.phase,settings,episodeBrowser,choosing]);
 useEffect(()=>{const media=video.current as SafariVideo|null;const change=()=>{setFullscreen(!!document.fullscreenElement||!!media?.webkitDisplayingFullscreen);setCanFullscreen(fullscreenAvailable(document,host.current,media));};const begin=()=>setFullscreen(true);const end=()=>{setFullscreen(false);wake();};change();document.addEventListener('fullscreenchange',change);media?.addEventListener('loadedmetadata',change);media?.addEventListener('webkitbeginfullscreen',begin);media?.addEventListener('webkitendfullscreen',end);return()=>{document.removeEventListener('fullscreenchange',change);media?.removeEventListener('loadedmetadata',change);media?.removeEventListener('webkitbeginfullscreen',begin);media?.removeEventListener('webkitendfullscreen',end);};},[]);
 async function toggleFullscreen(){setUiError('');try{await toggleVideoFullscreen(document,host.current,video.current,matchMedia('(pointer: coarse)').matches);}catch(error){setUiError(error instanceof Error&&error.message.startsWith('Wait for the video')?error.message:'Fullscreen is unavailable. Try rotating your phone to landscape.');}}
 const plan=state.plan;const title=item?item.Type==='Episode'?episodeTitle(episodeDetails.item??item)||episodeLabel(item):itemTitle(item):'Loading video';const busy=['idle','negotiating','buffering','seeking'].includes(state.phase);
 function openSettings(tab:PlayerTab){settingsOpener.current=document.activeElement as HTMLElement;setPlayerTab(tab);setSettings(true);}
 function closeSettings(){setSettings(false);settingsOpener.current?.focus();}
 function openEpisodes(){episodesOpener.current=document.activeElement as HTMLElement;resumeAfterBrowser.current=!!runtime.current&&!runtime.current.state.paused;if(resumeAfterBrowser.current)runtime.current?.toggle();setSettings(false);setEpisodeBrowser(true);}
 function closeEpisodes(){setEpisodeBrowser(false);if(resumeAfterBrowser.current&&runtime.current?.state.paused)runtime.current.toggle();resumeAfterBrowser.current=false;requestAnimationFrame(()=>episodesOpener.current?.focus());}
 function chooseEpisode(target:ItemDto){resumeAfterBrowser.current=false;setEpisodeBrowser(false);void runtime.current?.destroy();navigate(`/play/${encodeURIComponent(target.Id)}`);}
 function changeSkipping(value:SkippingPreferences){try{saveSkipping(scope,value,localStorage);setSkipPreferences(value);setUiError('');}catch{setUiError('Skip preference could not be saved on this device.');}}
 const segment=segments.itemId===itemId?activeSegment(segments.info?.segments??[],state.position,state.duration,skipPreferences,state.plan?.duration):undefined;
 useEffect(()=>{const target=skipper.current.automatic(segment,skipPreferences,state.phase==='playing'&&!state.paused&&!settings&&!episodeBrowser&&!choosing&&!preview);if(target!==undefined)runtime.current?.seek(target);},[segment,skipPreferences.Intro,skipPreferences.Recap,skipPreferences.Outro,skipPreferences.Preview,skipPreferences.Commercial,state.phase,state.paused,settings,episodeBrowser,choosing,preview]);
 const end=projectedEnd(Date.now(),state.position,state.duration,rate,!state.paused&&state.phase==='playing');
 function leave(){if(preview){navigate('/settings');return;}const destination=item?.Type==='Episode'&&item.SeriesId?item.SeriesId:itemId;void runtime.current?.destroy();navigate(`/item/${encodeURIComponent(destination)}`);}
 const ready=!!plan&&state.phase!=='failed';
 return <div ref={host} data-resume-ticks={startTicks} data-plan-start-ticks={plan?.selection.startTicks} className={`frame-player ${state.phase==='ended'?'player-is-ended':''} ${choosing?'player-is-choosing':''} ${pauseScreen?'pause-screen-visible':''} ${preview?'player-ui-preview':''} ${visible||state.paused||settings||episodeBrowser||state.error?'controls-visible':'controls-hidden'}`} onPointerMove={wake} onPointerDown={wake} onFocusCapture={wake} tabIndex={-1} onKeyDownCapture={wake} onKeyDown={e=>{
  if((e.target as HTMLElement).closest('input,select,textarea,[role=combobox],.player-settings,.player-episode-browser')||(e.target as HTMLElement).matches('button,a')&&[' ','Enter'].includes(e.key))return;wake();
  if([' ','k','ArrowLeft','ArrowRight','j','l','m','f'].includes(e.key)){e.preventDefault();if(e.key===' '||e.key==='k')runtime.current?.toggle();if(['ArrowLeft','j'].includes(e.key))runtime.current?.seek(state.position-10);if(['ArrowRight','l'].includes(e.key))runtime.current?.seek(state.position+10);if(e.key==='m')runtime.current?.mute();if(e.key==='f')void toggleFullscreen();}
 }}>
 <video ref={video} aria-hidden={!!preview||undefined} onRateChange={()=>{setRate(video.current?.playbackRate??1);updateWallClock(n=>n+1);}} playsInline preload="metadata" onClick={()=>{host.current?.focus();runtime.current?.toggle();wake();}} onDoubleClick={()=>void toggleFullscreen()} aria-label={title}/>
 {state.captions?.length ? <div className="player-captions" style={{fontSize:`${caption.size/100*24}px`}} aria-live="off">{state.captions.map((text,index)=><span key={index} style={captionAppearance(caption)}>{text}</span>)}</div> : null}
 {<div className="player-pause-screen" aria-hidden={!pauseScreen} role="status" aria-live="off"><PlayerStory title={title} context={item?.Type==='Episode'?[item.SeriesName??episodeDetails.series?.Name,episodeLabel(item)].filter(Boolean).join(' · '):item?.ProductionYear?String(item.ProductionYear):undefined} metadata={state.duration?`${clock(state.position)} / ${clock(state.duration)}`:undefined} description={episodeDetails.item?.Overview||item?.Overview}/></div>}
 <div className="player-top player-chrome"><button className="player-icon" aria-label="Return to details" onClick={leave}><ArrowLeft/></button><div className="player-title"><h1>{title}</h1>{item?.Type==='Episode'&&<p>{[item.SeriesName??episodeDetails.series?.Name,episodeLabel(item)].filter(Boolean).join(' · ')}</p>}</div>{item?.Type==='Episode'&&item.SeriesId&&<button className="player-episodes-trigger" aria-label="Browse episodes" aria-expanded={episodeBrowser} onClick={openEpisodes}>Episodes</button>}</div>
 {preview&&<p className="player-preview-note">Original UI preview · no streaming or watch-history changes</p>}
 {choosing&&item&&<ResumePrompt item={episodeDetails.item??item} title={title} online={episodeDetails.online} position={startTicks/10000000} onChoose={setEntry}/>}
 {!choosing&&(busy||state.error||data.error||!item)&&<div className="player-center" role="status">{state.error||data.error?<><h2>Unable To Play This Title</h2><p>{state.error||data.error}</p><button className="button primary" onClick={()=>{if(data.error)data.retry();else setAttempt(a=>a+1);}}>Try again</button><button className="button secondary" onClick={()=>window.location.reload()}>Reload frame.</button><button className="button secondary" onClick={leave}>Back to details</button></>:<><LoaderCircle className="player-spinner" size={36}/><p>{state.phase==='negotiating'?'Preparing your stream…':state.phase==='buffering'?'Buffering…':'Loading…'}</p></>}</div>}
 <CompletedScreen active={state.phase==='ended'&&!episodeBrowser&&!settings} title={title} context={item?.Type==='Episode'?[item.SeriesName??episodeDetails.series?.Name,episodeLabel(item)].filter(Boolean).join(' · '):item?.ProductionYear?String(item.ProductionYear):undefined} description={episodeDetails.item?.Overview||item?.Overview} duration={state.duration} episodes={item?.Type==='Episode'&&!!item.SeriesId} replay={()=>{void runtime.current?.change({startTicks:0});}} browse={openEpisodes} leave={leave}/>
 <SkipButton segment={segment} visible={!!segment&&skipPreferences[segment.type]==='button'&&!choosing&&!settings&&!episodeBrowser&&['playing','paused','ready'].includes(state.phase)} seek={target=>runtime.current?.seek(target)}/>
 <div className="player-bottom player-chrome">
 {(state.notice||uiError)&&<p className="player-notice" role="status">{uiError||state.notice}</p>}
 {settings&&<PlayerSettings state={state} initialTab={playerTab} segmentInfo={segments.itemId===itemId?segments.info:undefined} skipping={skipPreferences} changeSkipping={changeSkipping} refreshSegments={()=>setSegmentRevision(value=>value+1)} caption={caption} changeCaption={value=>{setCaption(value);saveCaptionPreferences(value);}} change={value=>void runtime.current?.change(value)} sync={value=>runtime.current?.subtitleDelay(value)} close={closeSettings}/>}
 <label className="player-timeline"><span className="sr-only">Playback position</span><input aria-label="Playback position" type="range" min={0} max={state.duration||1} step={.1} value={Math.min(state.position,state.duration||1)} disabled={!ready||!state.duration} onChange={e=>runtime.current?.seek(Number(e.target.value))}/></label>
 <div className="player-controls"><button className="player-icon" disabled={!ready} aria-label="Back 10 seconds" onClick={()=>runtime.current?.seek(state.position-10)}><RotateCcw size={25}/><span className="player-skip-seconds">10</span></button><button className="player-icon" disabled={!ready} aria-label={state.paused?'Play':'Pause'} onClick={()=>runtime.current?.toggle()}>{state.paused?<Play fill="currentColor"/>:<Pause fill="currentColor"/>}</button><button className="player-icon" disabled={!ready} aria-label="Forward 10 seconds" onClick={()=>runtime.current?.seek(state.position+10)}><RotateCw size={25}/><span className="player-skip-seconds">10</span></button><button className="player-time-pill" aria-label={remaining?'Show elapsed and total time':'Show remaining time'} aria-pressed={remaining} onClick={()=>setRemaining(value=>!value)}><span className="player-time">{remaining?`${formatPlaybackClock(remainingSeconds(state.position,state.duration))} left`:<>{formatPlaybackClock(state.position)} <span>/ {formatPlaybackClock(state.duration)}</span></>}</span>{end!==undefined?<span className="player-end-time">Ends at {new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(end)}</span>:null}</button><div className="player-volume"><button className="player-icon" aria-label={state.muted?'Unmute':'Mute'} onClick={()=>runtime.current?.mute()}>{state.muted||state.volume===0?<VolumeX/>:<Volume2/>}</button><input aria-label="Volume" type="range" min={0} max={1} step={.01} value={state.muted?0:state.volume} onChange={e=>{if(state.muted)runtime.current?.mute();runtime.current?.volume(Number(e.target.value));}}/></div><span className="player-control-spacer"/><button className="player-icon" title="Settings" aria-label="Settings" aria-expanded={settings} onClick={()=>settings?closeSettings():openSettings('audio')}><Settings size={23}/></button><button className="player-icon" aria-label="Subtitles and appearance" onClick={()=>{openSettings('captions');}}><Captions/></button>{canFullscreen&&<button className="player-icon" aria-label={fullscreen?'Exit fullscreen':'Enter fullscreen'} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize/>:<Maximize/>}</button>}</div>
 </div>{episodeBrowser&&item&&<EpisodeBrowser current={item} series={episodeDetails.series} position={state.position} duration={state.duration} close={closeEpisodes} choose={chooseEpisode}/>}</div>;
}


