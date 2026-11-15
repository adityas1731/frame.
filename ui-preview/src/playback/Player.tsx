import {initialPresentation,presentationTransition,canPauseIdle,canHideControls,shouldResumeEpisodeBrowser} from './presentationMachine';
import {useInstalledFont} from '../appearance/useInstalledFont';
import {PlayerLoading} from './PlayerLoading';
import {formatPlaybackClock,formatPlaybackTime} from '../platform/duration';
import {readEarlyProgress,earlyResumeTicks,earlyProgressStore} from './earlyProgress';
import {CompletedScreen} from './CompletedScreen';
import {PlayerStory} from './PlayerStory';
import {SkipButton} from './SkipButton';
import {useStudio} from '../studio/context';
import {activeSegment,loadSkipping,SegmentSkipper,saveSkipping,type SegmentInfo,type SkippingPreferences} from './segments';
import {ResumePrompt} from './ResumePrompt';
import {useEffect,useRef,useState,useReducer} from 'react';
import {Link,useNavigate,useParams,useSearchParams} from 'react-router';
import {ArrowLeft,Play,Pause,Volume2,VolumeX,Maximize,Minimize,Settings,RotateCcw,Captions,RotateCw} from 'lucide-react';
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
import type {SubtitleSaveOptions} from '../jellyfin/subtitleUpload';
const initial:PlayerSnapshot={phase:'idle',position:0,duration:0,paused:true,volume:1,muted:false,canHls:false};
export const clock=formatPlaybackTime;
export function PlayerRoute(){
 const {itemId=''}=useParams();const {session}=useConnection();
 if(!session)return <div className="player-unavailable"><h1>Sign In To Watch</h1><Link className="button primary" to="/connect">Connect to Jellyfin</Link></div>;
 return <Player key={JSON.stringify([session.baseUrl,session.server.Id,session.user.Id,itemId])} itemId={itemId}/>;
}
export function Player({itemId,preview}:{itemId:string;preview?:{item:ItemDto;snapshot:()=>PlayerSnapshot;controls:typeof previewControls;segmentInfo?:SegmentInfo;initialTab?:PlayerTab}}){
 const {scope}=useStudio();const [segments,setSegments]=useState<{itemId:string;info?:SegmentInfo}>({itemId:''});
 const [skipPreferences,setSkipPreferences]=useState(()=>loadSkipping(scope,localStorage));
 useEffect(()=>setSkipPreferences(loadSkipping(scope,localStorage)),[scope]);
 const [segmentRevision,setSegmentRevision]=useState(0);
 const skipper=useRef(new SegmentSkipper());
 const [remaining,setRemaining]=useState(false);const [,updateWallClock]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>updateWallClock(n=>n+1),60000);return()=>clearInterval(timer);},[]);
 const [caption,setCaption]=useState(loadCaptionPreferences);useInstalledFont(caption.customFont??'',caption.font==='custom');const [playerTab,setPlayerTab]=useState<PlayerTab>(preview?.initialTab??'audio');
 const {client,session}=useConnection();const [params]=useSearchParams();const navigate=useNavigate();const video=useRef<HTMLVideoElement>(null);const host=useRef<HTMLDivElement>(null);const runtime=useRef<Pick<PlaybackRuntime,'subtitleDelay'|'toggle'|'seek'|'mute'|'volume'|'change'|'destroy'|'state'|'loadCustomSubtitle'|'selectCustomSubtitle'|'removeCustomSubtitle'|'selectAdditionalSubtitle'|'getCustomSubtitle'>|null>(null);
 useEffect(()=>{let active=true;skipper.current=new SegmentSkipper();setSegments({itemId:''});
  if(preview)setSegments({itemId,info:preview.segmentInfo??{status:'ready',segments:[]}});
  else if(client)void (segmentRevision?client.refreshMediaSegments(itemId):client.mediaSegmentInfo(itemId)).then(info=>{if(active)setSegments({itemId,info});});
  return()=>{active=false;};
 },[client,itemId,preview,scope,segmentRevision]);
 const [state,setState]=useState(preview?preview.snapshot:initial);const [presentation,send]=useReducer(presentationTransition,!!preview?.initialTab,initialPresentation);const [rate,setRate]=useState(1);const settingsOpener=useRef<HTMLElement|null>(null);const [fullscreen,setFullscreen]=useState(false);const [uiError,setUiError]=useState('');const [attempt,setAttempt]=useState(0);const inactivity=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const [canFullscreen,setCanFullscreen]=useState(false);
 const pauseIdle=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const data=useRemote(`player-item:${itemId}`,()=>preview?Promise.resolve(preview.item):client!.item(session!.user.Id,itemId),false);const item=data.data;
 const episodeDetails=useEpisodeDetails(item);
 const episodesOpener=useRef<HTMLElement|null>(null);
 const localStart=useRef<{key:string;ticks:number}>({key:'unloaded',ticks:0});
 const progressScope=session?JSON.stringify([session.baseUrl,session.server.Id,session.user.Id,itemId]):`preview:${itemId}`;
 if(item&&localStart.current.key!==progressScope){localStart.current={key:progressScope,ticks:!preview&&session?earlyResumeTicks(item,readEarlyProgress(session,earlyProgressStore()).find(row=>row.id===itemId)):item.UserData?.PlaybackPositionTicks??0};}
 const entry=presentation.entry;const choosing=!!item&&['Episode','Movie'].includes(item.Type??'')&&(localStart.current.ticks>0||params.has('choose'))&&!params.has('restart')&&!entry;
 const startTicks=params.has('restart')||entry==='restart'?0:localStart.current.ticks;
 const media={phase:state.phase,paused:state.paused,hasPlan:!!state.plan,error:!!(state.error||data.error),choosing,sessionId:state.plan?.sessionId};
 // Project immediately during render; no stale pause/completion frame before the effect commits.
 const ui=presentationTransition(presentation,{type:'media',media});
 const settings=ui.panel==='settings',episodeBrowser=ui.panel==='episodes',pauseScreen=ui.surface==='pause',visible=ui.surface!=='hidden';
 useEffect(()=>{send({type:'media',media});},[state.phase,state.paused,!!state.plan,state.plan?.sessionId,!!state.error,!!data.error,choosing]);

 useEffect(()=>{
  if(preview){runtime.current=preview.controls(setState);return()=>{runtime.current=null;};}
  if(!item||choosing||!video.current||!client||!session)return;
  let active=true;let player:PlaybackRuntime|undefined;let unsubscribe:(()=>void)|undefined;
  // StrictMode's discarded effect must not create a second server playback negotiation.
  queueMicrotask(()=>{if(!active||!video.current)return;host.current?.focus();player=new PlaybackRuntime(client,session,itemId,video.current);runtime.current=player;unsubscribe=player.subscribe(setState);void player.start({startTicks,maxBitrate:40000000});});
  const stop=()=>{void player?.destroy(true);};window.addEventListener('pagehide',stop);
  return()=>{active=false;window.removeEventListener('pagehide',stop);unsubscribe?.();if(runtime.current===player)runtime.current=null;void player?.destroy();};
 },[item,client,session,itemId,startTicks,attempt,preview,choosing]);
 function wake(input?:'pointer'|'keyboard'){send({type:'activity',input});}
 useEffect(()=>{
  const activity=ui.activity;
  clearTimeout(inactivity.current);clearTimeout(pauseIdle.current);
  if(canPauseIdle(ui))pauseIdle.current=setTimeout(()=>{send({type:'pause-idle',activity,keyboardFocus:!!host.current?.querySelector('.player-chrome:focus-within')});},6000);
  if(canHideControls(ui))inactivity.current=setTimeout(()=>{
   const focused=!!host.current?.querySelector('.player-chrome:focus-within');
   send({type:'idle',activity,keyboardFocus:focused});
  },3000);
  return()=>{clearTimeout(inactivity.current);clearTimeout(pauseIdle.current);};
 },[ui.activity,ui.media.phase,ui.panel,ui.media.paused,ui.media.error,ui.media.choosing,ui.media.hasPlan,ui.leaving]);
 // Move pointer focus only after the timeout was accepted. Its focus event must not wake the UI again.
 const idleFocus=useRef(false);
 useEffect(()=>{if(ui.surface==='pause'||ui.surface==='hidden'&&ui.input==='pointer'&&host.current?.querySelector('.player-chrome:focus-within')){idleFocus.current=true;host.current?.focus({preventScroll:true});idleFocus.current=false;}},[ui.surface,ui.input]);
 useEffect(()=>{const media=video.current as SafariVideo|null;const change=()=>{setFullscreen(!!document.fullscreenElement||!!media?.webkitDisplayingFullscreen);setCanFullscreen(fullscreenAvailable(document,host.current,media));};const begin=()=>setFullscreen(true);const end=()=>{setFullscreen(false);wake();};change();document.addEventListener('fullscreenchange',change);media?.addEventListener('loadedmetadata',change);media?.addEventListener('webkitbeginfullscreen',begin);media?.addEventListener('webkitendfullscreen',end);return()=>{document.removeEventListener('fullscreenchange',change);media?.removeEventListener('loadedmetadata',change);media?.removeEventListener('webkitbeginfullscreen',begin);media?.removeEventListener('webkitendfullscreen',end);};},[]);
 async function toggleFullscreen(){setUiError('');try{await toggleVideoFullscreen(document,host.current,video.current,matchMedia('(pointer: coarse)').matches);}catch(error){setUiError(error instanceof Error&&error.message.startsWith('Wait for the video')?error.message:'Fullscreen is unavailable. Try rotating your phone to landscape.');}}
 const plan=state.plan;const title=item?item.Type==='Episode'?episodeTitle(episodeDetails.item??item)||episodeLabel(item):itemTitle(item):'Loading video';const busy=['idle','negotiating','buffering','seeking'].includes(state.phase);
 async function saveCustomSubtitle(options:SubtitleSaveOptions){
  const subtitle=runtime.current?.getCustomSubtitle(),sourceId=state.plan?.source.Id;
  if(!subtitle||!sourceId)throw new Error('Load a subtitle file before saving.');
  if(preview)return;
  if(!client||!session)throw new Error('Sign in to Jellyfin before saving subtitles.');
  await client.saveSubtitle(itemId,sourceId,subtitle,options);
 }
 function openSettings(tab:PlayerTab){settingsOpener.current=document.activeElement as HTMLElement;setPlayerTab(tab);send({type:'settings'});}
 function closeSettings(){send({type:'close-settings'});settingsOpener.current?.focus();}
 function openEpisodes(){episodesOpener.current=document.activeElement as HTMLElement;send({type:'episodes'});if(runtime.current?.state.phase==='playing'&&!runtime.current.state.paused)runtime.current.toggle();}
 function closeEpisodes(){const current=runtime.current?.state;const resume=current&&shouldResumeEpisodeBrowser(ui,{phase:current.phase,paused:current.paused,hasPlan:!!current.plan,error:!!current.error,choosing:false,sessionId:current.plan?.sessionId});send({type:'close-episodes'});if(resume)runtime.current?.toggle();requestAnimationFrame(()=>episodesOpener.current?.focus());}
 function chooseEpisode(target:ItemDto){send({type:'leave'});void runtime.current?.destroy();navigate(`/play/${encodeURIComponent(target.Id)}`);}
 function changeSkipping(value:SkippingPreferences){try{saveSkipping(scope,value,localStorage);setSkipPreferences(value);setUiError('');}catch{setUiError('Skip preference could not be saved on this device.');}}
 const segment=segments.itemId===itemId?activeSegment(segments.info?.segments??[],state.position,state.duration,skipPreferences,state.plan?.duration):undefined;
 useEffect(()=>{const target=skipper.current.automatic(segment,skipPreferences,state.phase==='playing'&&!state.paused&&!settings&&!episodeBrowser&&!choosing&&!preview);if(target!==undefined)runtime.current?.seek(target);},[segment,skipPreferences.Intro,skipPreferences.Recap,skipPreferences.Outro,skipPreferences.Preview,skipPreferences.Commercial,state.phase,state.paused,settings,episodeBrowser,choosing,preview]);
 const end=projectedEnd(Date.now(),state.position,state.duration,rate,!state.paused&&state.phase==='playing');
 function leave(){send({type:'leave'});if(preview){navigate('/settings');return;}const destination=item?.Type==='Episode'&&item.SeriesId?item.SeriesId:itemId;void runtime.current?.destroy();navigate(`/item/${encodeURIComponent(destination)}`);}
 const ready=!!plan&&state.phase!=='failed';
 return <div ref={host} data-resume-ticks={startTicks} data-plan-start-ticks={plan?.selection.startTicks} className={`frame-player ${state.phase==='ended'?'player-is-ended':''} ${choosing?'player-is-choosing':''} ${pauseScreen?'pause-screen-visible':''} ${preview?'player-ui-preview':''} ${visible||state.paused||settings||episodeBrowser||state.error?'controls-visible':'controls-hidden'}`} onPointerMove={()=>wake('pointer')} onPointerDown={()=>{if(host.current)host.current.dataset.inputMode='pointer';wake('pointer');}} onFocusCapture={()=>{if(!idleFocus.current)wake();}} onBlurCapture={()=>{if(!idleFocus.current)wake();}} tabIndex={-1} onKeyDownCapture={()=>{if(host.current)host.current.dataset.inputMode='keyboard';wake('keyboard');}} onKeyDown={e=>{
  if((e.target as HTMLElement).closest('input,select,textarea,[role=combobox],.player-settings,.player-episode-browser')||(e.target as HTMLElement).matches('button,a')&&[' ','Enter'].includes(e.key))return;wake();
  if([' ','k','ArrowLeft','ArrowRight','j','l','m','f'].includes(e.key)){e.preventDefault();if(e.key===' '||e.key==='k')runtime.current?.toggle();if(['ArrowLeft','j'].includes(e.key))runtime.current?.seek(state.position-10);if(['ArrowRight','l'].includes(e.key))runtime.current?.seek(state.position+10);if(e.key==='m')runtime.current?.mute();if(e.key==='f')void toggleFullscreen();}
 }}>
 <video ref={video} aria-hidden={!!preview||undefined} onRateChange={()=>{setRate(video.current?.playbackRate??1);updateWallClock(n=>n+1);}} playsInline preload="metadata" onClick={()=>{host.current?.focus();runtime.current?.toggle();wake();}} onDoubleClick={()=>void toggleFullscreen()} aria-label={title}/>
 {state.captions?.length ? <div className="player-captions" style={{fontSize:`${caption.size/100*24}px`}} aria-live="off">{state.captions.map((text,index)=><span key={index} style={captionAppearance(caption)}>{text}</span>)}</div> : null}
 {<div className="player-pause-screen player-idle-screen" aria-hidden={!pauseScreen} role="status" aria-live="off"><PlayerStory title={title} context={item?.Type==='Episode'?[item.SeriesName??episodeDetails.series?.Name,episodeLabel(item)].filter(Boolean).join(' · '):item?.ProductionYear?String(item.ProductionYear):undefined} metadata={state.duration?`${clock(state.position)} / ${clock(state.duration)}`:undefined} description={episodeDetails.item?.Overview||item?.Overview}/></div>}
 <div className="player-top player-chrome" inert={pauseScreen}><button className="player-icon" aria-label="Return to details" onClick={leave}><ArrowLeft/></button><div className="player-title"><h1>{title}</h1>{item?.Type==='Episode'&&<p>{[item.SeriesName??episodeDetails.series?.Name,episodeLabel(item)].filter(Boolean).join(' · ')}</p>}</div>{item?.Type==='Episode'&&item.SeriesId&&<button className="player-episodes-trigger" aria-label="Browse episodes" aria-expanded={episodeBrowser} onClick={openEpisodes}>Episodes</button>}</div>
 {preview&&<p className="player-preview-note">Original UI preview · no streaming or watch-history changes</p>}
 {choosing&&item&&<ResumePrompt item={episodeDetails.item??item} title={title} online={episodeDetails.online} position={startTicks/10000000} onChoose={entry=>send({type:'entry',entry})}/>}
 <PlayerLoading active={!choosing&&!state.error&&!data.error&&(busy||!item)} phase={state.phase}/>
 {!choosing&&(state.error||data.error)&&<div className="player-center" role="alert"><h2>Unable To Play This Title</h2><p>{state.error||data.error}</p><button className="button primary" onClick={()=>{if(data.error)data.retry();else setAttempt(a=>a+1);}}>Try again</button><button className="button secondary" onClick={leave}>Back to details</button></div>}
 <CompletedScreen active={state.phase==='ended'&&!episodeBrowser&&!settings} title={title} context={item?.Type==='Episode'?[item.SeriesName??episodeDetails.series?.Name,episodeLabel(item)].filter(Boolean).join(' · '):item?.ProductionYear?String(item.ProductionYear):undefined} description={episodeDetails.item?.Overview||item?.Overview} duration={state.duration} episodes={item?.Type==='Episode'&&!!item.SeriesId} replay={()=>{void runtime.current?.change({startTicks:0});}} browse={openEpisodes} leave={leave}/>
 <SkipButton segment={segment} visible={!!segment&&skipPreferences[segment.type]==='button'&&!pauseScreen&&!choosing&&!settings&&!episodeBrowser&&['playing','paused','ready'].includes(state.phase)} seek={target=>runtime.current?.seek(target)}/>
 <div className="player-bottom player-chrome" inert={pauseScreen}>
 {(state.notice||uiError)&&<p className="player-notice" role="status">{uiError||state.notice}</p>}
 {settings&&<PlayerSettings state={state} initialTab={playerTab} segmentInfo={segments.itemId===itemId?segments.info:undefined} skipping={skipPreferences} changeSkipping={changeSkipping} refreshSegments={()=>setSegmentRevision(value=>value+1)} caption={caption} changeCaption={value=>{setCaption(value);saveCaptionPreferences(value);}} change={value=>void runtime.current?.change(value)} sync={value=>runtime.current?.subtitleDelay(value)} close={closeSettings} loadCustom={async value=>{await runtime.current?.loadCustomSubtitle(value);}} selectCustom={()=>void runtime.current?.selectCustomSubtitle()} removeCustom={()=>runtime.current?.removeCustomSubtitle()} selectAdditional={id=>void runtime.current?.selectAdditionalSubtitle(id)} saveCustom={saveCustomSubtitle} subtitleSaveTarget={item?.Type==='Episode'?`${item.SeriesName??''} · Season ${item.ParentIndexNumber??'?'} · Episode ${item.IndexNumber??'?'} · ${title}`:title} subtitleSavePreview={!!preview} subtitleSaveUnavailable={!preview&&!(session?.user.Policy?.IsAdministrator||session?.user.Policy?.EnableSubtitleManagement)?'Your Jellyfin account needs permission to manage subtitles. Temporary loading still works.':undefined}/>}
 <label className="player-timeline"><span className="sr-only">Playback position</span><input aria-label="Playback position" type="range" min={0} max={state.duration||1} step={.1} value={Math.min(state.position,state.duration||1)} disabled={!ready||!state.duration} onChange={e=>runtime.current?.seek(Number(e.target.value))}/></label>
 <div className="player-controls"><button className="player-icon" disabled={!ready} aria-label="Back 10 seconds" onClick={()=>runtime.current?.seek(state.position-10)}><RotateCcw size={25}/><span className="player-skip-seconds">10</span></button><button className="player-icon" disabled={!ready} aria-label={state.paused?'Play':'Pause'} onClick={()=>runtime.current?.toggle()}>{state.paused?<Play fill="currentColor"/>:<Pause fill="currentColor"/>}</button><button className="player-icon" disabled={!ready} aria-label="Forward 10 seconds" onClick={()=>runtime.current?.seek(state.position+10)}><RotateCw size={25}/><span className="player-skip-seconds">10</span></button><div className="player-volume"><button className="player-icon" aria-label={state.muted?'Unmute':'Mute'} onClick={()=>runtime.current?.mute()}>{state.muted||state.volume===0?<VolumeX/>:<Volume2/>}</button><input aria-label="Volume" type="range" min={0} max={1} step={.01} value={state.muted?0:state.volume} onChange={e=>{if(state.muted)runtime.current?.mute();runtime.current?.volume(Number(e.target.value));}}/></div><button className="player-time-pill" aria-label={remaining?'Show elapsed and total time':'Show remaining time'} aria-pressed={remaining} onClick={()=>setRemaining(value=>!value)}><span className="player-time">{remaining?`${formatPlaybackClock(remainingSeconds(state.position,state.duration))} left`:<>{formatPlaybackClock(state.position)} <span>/ {formatPlaybackClock(state.duration)}</span></>}</span>{end!==undefined&&<span className="player-end-time">{`Ends at ${new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(end)}`}</span>}</button><span className="player-control-spacer"/><button className="player-icon" title="Settings" aria-label="Settings" aria-expanded={settings} onClick={()=>settings?closeSettings():openSettings('audio')}><Settings size={23}/></button><button className="player-icon" aria-label="Subtitles and appearance" onClick={()=>{openSettings('captions');}}><Captions/></button>{canFullscreen&&<button className="player-icon" aria-label={fullscreen?'Exit fullscreen':'Enter fullscreen'} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize/>:<Maximize/>}</button>}</div>
 </div>{episodeBrowser&&item&&<EpisodeBrowser current={item} series={episodeDetails.series} position={state.position} duration={state.duration} close={closeEpisodes} choose={chooseEpisode}/>}</div>;
}


