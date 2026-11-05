import {saveEarlyProgress} from './earlyProgress.ts';
import {hosting} from '../build/hosting.ts';
import '../build/flags.ts';
import {resolutionCap} from './resolution.ts';
import type {JellyfinClient} from '../jellyfin/client.ts';
import type {Session} from '../jellyfin/types.ts';
import {browserSupport,deviceProfile,type BrowserSupport} from './capabilities.ts';
import {createMediaGateway,type MediaGateway} from './gateway.ts';
import {clampTicks,secondsToTicks,type Phase} from './foundation.ts';
import {attachHls,probeHls,type HlsFailure} from './hls.ts';
import {runtimePlan,negotiatedHls} from './planner.ts';
import {synchronizedCaptionText,subtitleDelaySeconds,reconcileCaptionTracks} from './subtitles.ts';
import {nativeCaptionTimeline} from './nativeCaptions.ts';
import {PlaybackDiagnostics,type DiagnosticEvent,type DiagnosticStage} from './diagnostics.ts';
import {PlaybackError,playbackBody,type PlaybackInfo,type PlaybackSelection,type PlayingReport,type RuntimePlan} from './protocol.ts';
export interface PlayerSnapshot {phase:Phase;position:number;duration:number;paused:boolean;volume:number;muted:boolean;plan?:RuntimePlan;error?:string;notice?:string;canHls:boolean;videoWidth?:number;videoHeight?:number;subtitleDelay?:number;captions?:string[];diagnostics?:DiagnosticEvent[]}
export interface RuntimeDependencies {support?:BrowserSupport;gateway?:typeof createMediaGateway;hls?:typeof attachHls;updated?:()=>void;startupTimeoutMs?:number}
/** Runtime lifecycle: one owner per media element, serial reports, generation-safe source replacement. */
export class PlaybackRuntime {
 private client:JellyfinClient;private session:Session;private video:HTMLVideoElement;private itemId:string;
 private controller=new AbortController();private generation=0;private gateway?:MediaGateway;private detachHls?:()=>void;
 private support:BrowserSupport;private listeners=new Set<(state:PlayerSnapshot)=>void>();private removeEvents:(()=>void)[]=[];
 private queue=Promise.resolve();private timer?:ReturnType<typeof setInterval>;private started=false;private stopped=new Set<string>();
 private dependencies:RuntimeDependencies;private finishes=new Map<string,Promise<void>>();
 private captionTimer?:ReturnType<typeof setInterval>;private captionDelays=new Map<string,number>();
 private nativeFullscreen=false;private nativeCaptionTrack?:TextTrack;
 private startupTimer?:ReturnType<typeof setTimeout>;
 private clearStartup(){if(this.startupTimer)clearTimeout(this.startupTimer);this.startupTimer=undefined;}
 private armStartup(){
  if(this.startupTimer)return;const turn=this.generation;
  this.startupTimer=setTimeout(()=>{this.startupTimer=undefined;if(!this.disposed&&turn===this.generation&&!this.controller.signal.aborted)void this.mediaError('timeout');},this.dependencies.startupTimeoutMs??45000);
 }
 private diagnostics=__FRAME_DIAGNOSTICS__?new PlaybackDiagnostics():undefined;
 private log(stage:DiagnosticStage,facts:Record<string,unknown>={}){if(this.diagnostics){this.diagnostics.add(stage,facts);this.publish({diagnostics:this.diagnostics.snapshot()});}}
 private pendingProgress?:PlayingReport;private progressQueued=false;
 private lastLocalSecond=-1;
 private rememberPosition(completed=false){
  if(!this.started&&!completed)return;
  const position=this.position(),second=Math.floor(position);
  if(!completed&&second===this.lastLocalSecond)return;this.lastLocalSecond=second;
  let store:Storage|undefined;try{store=globalThis.localStorage;}catch{/* Memory fallback. */}
  saveEarlyProgress(this.session,this.itemId,position,this.state.duration,completed,store);
 }
 private lastReport=0;private suppress=false;private disposed=false;private fallback=false;private unregister:()=>void;private destroyPromise?:Promise<void>;private track?:HTMLTrackElement;
 state:PlayerSnapshot={phase:'idle',position:0,duration:0,paused:true,volume:1,muted:false,canHls:false};
 constructor(client:JellyfinClient,session:Session,itemId:string,video:HTMLVideoElement,dependencies:RuntimeDependencies={}){
  this.dependencies=dependencies;this.client=client;this.session=session;this.itemId=itemId;this.video=video;this.support=dependencies.support??browserSupport(video,false);
  this.state={...this.state,canHls:this.support.nativeHls||this.support.mseHls};this.unregister=client.beforeLogout(()=>this.destroy());
  this.bind();
 }
 subscribe(listener:(state:PlayerSnapshot)=>void){this.listeners.add(listener);listener(this.state);return()=>{this.listeners.delete(listener);};}
 private publish(update:Partial<PlayerSnapshot>){if(this.disposed)return;this.state={...this.state,...update};this.listeners.forEach(listener=>listener(this.state));}
 private listen(name:keyof HTMLMediaElementEventMap,callback:()=>void){this.video.addEventListener(name,callback);this.removeEvents.push(()=>this.video.removeEventListener(name,callback));}
 private dimensions(){this.publish({videoWidth:this.video.videoWidth||0,videoHeight:this.video.videoHeight||0});}
 private bind(){
  this.listen('resize',()=>this.dimensions());
  // Embedded tracks can arrive after loadedmetadata or be reselected by the browser.
  // Keep native drawing off so only frame.'s styled, synchronized overlay is visible.
  const tracks=this.video.textTracks;const reconcile=()=>reconcileCaptionTracks(Array.from(tracks),this.track?.track,this.nativeFullscreen?this.nativeCaptionTrack:undefined);
  if(typeof tracks.addEventListener==='function'){tracks.addEventListener('addtrack',reconcile);tracks.addEventListener('change',reconcile);this.removeEvents.push(()=>{tracks.removeEventListener('addtrack',reconcile);tracks.removeEventListener('change',reconcile);});}
  const begin=()=>{this.nativeFullscreen=true;this.syncNativeCaptions();};const end=()=>{this.nativeFullscreen=false;this.clearNativeCaptions();reconcile();};
  this.video.addEventListener('webkitbeginfullscreen',begin);this.video.addEventListener('webkitendfullscreen',end);
  this.removeEvents.push(()=>{this.video.removeEventListener('webkitbeginfullscreen',begin);this.video.removeEventListener('webkitendfullscreen',end);this.clearNativeCaptions();});

  this.listen('playing',()=>{this.dimensions();this.clearStartup();__FRAME_DIAGNOSTICS__&&this.log('playing',{readyState:this.video.readyState});if(this.suppress||!this.state.plan||this.stopped.has(this.state.plan.sessionId))return;this.publish({phase:'playing',paused:false,position:this.position(),error:undefined,notice:undefined});if(!this.started&&this.state.plan){this.started=true;this.send('started');}else this.progress('unpause',true);});
  this.listen('pause',()=>{this.clearStartup();if(this.suppress||this.video.ended)return;this.publish({phase:'paused',paused:true,position:this.position()});this.progress('pause',true);});
  this.listen('waiting',()=>{__FRAME_DIAGNOSTICS__&&this.log('waiting',{readyState:this.video.readyState,networkState:this.video.networkState});if(!this.suppress){this.publish({phase:'buffering'});if(this.state.plan)this.armStartup();}});
  this.listen('timeupdate',()=>{if(this.suppress||!this.state.plan)return;this.publish({position:this.position(),captions:this.track?synchronizedCaptionText(this.track.track,this.video.currentTime,this.state.plan?.offset??0,this.state.subtitleDelay??0):[]});this.rememberPosition();this.progress('timeupdate');});
  this.listen('seeked',()=>{if(this.suppress)return;this.publish({phase:this.video.paused?'paused':'playing',position:this.position(),captions:this.track?synchronizedCaptionText(this.track.track,this.video.currentTime,this.state.plan?.offset??0,this.state.subtitleDelay??0):[]});this.progress('seek',true);});
  this.listen('volumechange',()=>{this.publish({volume:this.video.volume,muted:this.video.muted});this.progress('volumechange',true);});
  this.listen('ended',()=>{this.clearStartup();if(this.suppress)return;this.publish({phase:'ended',paused:true,position:this.state.duration});this.rememberPosition(true);void this.finishPlan();});
  // MSE recovery belongs to hls.js. A transient native error must not destroy its
  // session before the engine has recovered or emitted its terminal error.
  this.listen('error',()=>{if(!this.suppress&&this.video.error&&(this.state.plan?.mode==='direct'||this.support.nativeHls||!!this.state.plan&&!negotiatedHls(this.itemId,this.state.plan.stream)))void this.mediaError();});
  this.timer=setInterval(()=>this.progress('timeupdate'),10000);
  this.captionTimer=setInterval(()=>{if(!this.video.paused&&!this.suppress)this.refreshCaptions();},100);
 }
 private position(){return Math.max(0,Math.min(this.state.duration||Infinity,this.video.currentTime+(this.state.plan?.offset??0)));}
 private report(plan=this.state.plan,event?:PlayingReport['EventName']):PlayingReport|undefined {if(!plan)return;return{ItemId:plan.itemId,MediaSourceId:plan.source.Id,PlaySessionId:plan.sessionId,PositionTicks:clampTicks(secondsToTicks(this.state.phase==='ended'?this.state.duration:this.position()),secondsToTicks(this.state.duration)),IsPaused:this.video.paused,IsMuted:this.video.muted,VolumeLevel:Math.round(this.video.volume*100),CanSeek:plan.duration>0,PlayMethod:plan.mode==='direct'?'DirectPlay':plan.mode==='remux'?'DirectStream':'Transcode',AudioStreamIndex:plan.audioIndex,SubtitleStreamIndex:plan.subtitleIndex,...(event?{EventName:event}:{})};}
 private send(kind:'started'|'progress',event?:PlayingReport['EventName']){
  const report=this.report(undefined,event);if(!report)return;
  this.lastReport=Date.now();
  const failed=()=>{__FRAME_DIAGNOSTICS__&&this.log('report-failed');this.publish({notice:'Playback progress could not be saved to Jellyfin. Your current video continues; retry saving by pausing or resuming.'});};
  if(kind==='started'){this.queue=this.queue.then(()=>this.client.reportPlayback(kind,report)).catch(failed);return;}
  // At most one waiting progress write. Slow networks coalesce events rather than growing a report backlog.
  this.pendingProgress=report;if(this.progressQueued)return;this.progressQueued=true;
  this.queue=this.queue.then(async()=>{const latest=this.pendingProgress;this.pendingProgress=undefined;this.progressQueued=false;if(latest)await this.client.reportPlayback('progress',latest);}).catch(failed);
 }
 private progress(event:PlayingReport['EventName'],force=false){if(this.disposed||this.suppress||!this.started||this.state.phase==='ended'||event==='volumechange'&&Date.now()-this.lastReport<250||!force&&Date.now()-this.lastReport<10000)return;this.send('progress',event);}
 private detach(){this.clearStartup();this.suppress=true;this.clearNativeCaptions();this.detachHls?.();this.detachHls=undefined;this.track?.remove();this.track=undefined;this.publish({captions:[]});this.video.pause();this.video.removeAttribute('src');this.video.load();this.suppress=false;}
 private async finishPlan(unloading=false){
  const plan=this.state.plan;if(!plan)return;if(this.stopped.has(plan.sessionId))return this.finishes.get(plan.sessionId);
  this.rememberPosition(this.state.phase==='ended');this.stopped.add(plan.sessionId);const started=this.started;this.started=false;const report=this.report(plan);this.client.invalidate();
  if(unloading){
   // Launch both authenticated keepalive requests synchronously in pagehide.
   // Waiting behind progress, or awaiting Stopped before DELETE, loses cleanup
   // when a reload destroys this document's JavaScript continuation.
   const requests:Promise<unknown>[]=[];
   if(started&&report)requests.push(this.client.reportPlayback('stopped',report,true));
   if(plan.mode!=='direct')requests.push(this.client.stopEncoding(plan.sessionId));
   const finish=Promise.allSettled(requests).then(()=>{});this.finishes.set(plan.sessionId,finish);return finish;
  }
  this.queue=this.queue.then(async()=>{
   let stopped=false;
   if(started&&report){try{await this.client.reportPlayback('stopped',report,true);stopped=true;}catch{this.publish({notice:'Jellyfin could not confirm playback stopped. The server may need to expire this session.'});}}
   if(plan.mode!=='direct'&&!stopped)try{await this.client.stopEncoding(plan.sessionId);}catch{this.publish({notice:'Transcoding cleanup could not be confirmed. Check active playback in Jellyfin.'});}
   this.client.invalidate();if(this.dependencies.updated)this.dependencies.updated();else window.dispatchEvent(new Event('frame:playback-updated'));
  });this.finishes.set(plan.sessionId,this.queue);await this.queue;
 }
 async start(selection:PlaybackSelection,startPaused=false){
  if(this.disposed)return;const turn=++this.generation;__FRAME_DIAGNOSTICS__&&this.log('attempt',{attempt:turn,maxBitrate:selection.maxBitrate,startSeconds:selection.startTicks/10000000,forceTranscode:!!selection.forceTranscode});this.suppress=true;const previous=this.finishPlan();this.controller.abort();this.controller=new AbortController();
  const signal=this.controller.signal;this.detach();await previous;if(this.disposed||turn!==this.generation)return;
  this.publish({phase:'negotiating',videoWidth:0,videoHeight:0,error:undefined,notice:undefined,position:selection.startTicks/10000000,plan:undefined});
  let info:PlaybackInfo|undefined;
  try{
   if(!this.dependencies.support){const probe=await probeHls();__FRAME_DIAGNOSTICS__&&this.log('capabilities',{engineLoaded:probe.engineLoaded,engineLoadFailed:probe.engineLoadFailed,mediaSourceAvailable:probe.mediaSourceAvailable});const hls=probe.supported;if(signal.aborted||turn!==this.generation)return;this.support=browserSupport(this.video,hls,hosting(document.baseURI).serverUrl===this.session.baseUrl.replace(/\/+$/,''));this.publish({canHls:this.support.mseHls||this.support.nativeHls});}
   __FRAME_DIAGNOSTICS__&&this.log('capabilities',{mseHls:this.support.mseHls,nativeHls:this.support.nativeHls,h264:this.support.video.includes('h264'),aac:this.support.audio.includes('aac'),secureContext:globalThis.isSecureContext===true,serviceWorker:'serviceWorker' in navigator,progressiveWebm:!!this.support.progressiveWebm});
   const negotiate=async(force:boolean)=>{__FRAME_DIAGNOSTICS__&&this.log('negotiation-request',{forceTranscode:force});const result=await this.client.playbackInfo(this.session.user.Id,this.itemId,playbackBody(this.session.user.Id,deviceProfile(this.support,selection.maxBitrate,force,selection.maxHeight),{...selection,forceTranscode:force},this.state.canHls,this.state.canHls||!!this.support.progressiveWebm),signal);__FRAME_DIAGNOSTICS__&&this.log('negotiation-response',{sources:result.MediaSources.length});for(const [index,source] of result.MediaSources.entries())__FRAME_DIAGNOSTICS__&&this.log('source',{sourceNumber:index+1,videoCodec:source.MediaStreams.find(t=>t.Type==='Video')?.Codec,audioCodec:source.MediaStreams.find(t=>t.Type==='Audio')?.Codec,bitDepth:source.MediaStreams.find(t=>t.Type==='Video')?.BitDepth,channels:source.MediaStreams.find(t=>t.Type==='Audio')?.Channels,width:source.MediaStreams.find(t=>t.Type==='Video')?.Width,height:source.MediaStreams.find(t=>t.Type==='Video')?.Height,container:source.Container,protocol:source.TranscodingSubProtocol,directPlay:!!source.SupportsDirectPlay,directStream:!!source.SupportsDirectStream,transcoding:!!source.SupportsTranscoding,playlist:negotiatedHls(this.itemId,source.TranscodingUrl),requiresOpening:!!source.RequiresOpening,videoTracks:source.MediaStreams.filter(t=>t.Type==='Video').length,audioTracks:source.MediaStreams.filter(t=>t.Type==='Audio').length,subtitleTracks:source.MediaStreams.filter(t=>t.Type==='Subtitle').length});return result;};
   info=await negotiate(!!selection.forceTranscode||!!resolutionCap(selection.maxHeight));if(signal.aborted||turn!==this.generation){if(info.PlaySessionId)void this.client.stopEncoding(info.PlaySessionId).catch(()=>{});return;}
   let plan:RuntimePlan;
   try{plan=await runtimePlan(this.itemId,info,this.support,selection,this.session.deviceId);}catch(error){
    if(!(this.state.canHls||this.support.progressiveWebm)||selection.forceTranscode)throw error;
    __FRAME_DIAGNOSTICS__&&this.log('fallback',{reason:'stream'});await this.client.stopEncoding(info.PlaySessionId!).catch(()=>{});info=await negotiate(true);plan=await runtimePlan(this.itemId,info,this.support,{...selection,forceTranscode:true},this.session.deviceId);
   }
   if(signal.aborted||turn!==this.generation){if(info.PlaySessionId)void this.client.stopEncoding(info.PlaySessionId).catch(()=>{});return;}
   __FRAME_DIAGNOSTICS__&&this.log('plan',{mode:plan.mode,duration:plan.duration});__FRAME_DIAGNOSTICS__&&this.log('gateway');this.gateway?.close();this.gateway=await (this.dependencies.gateway??createMediaGateway)(this.session,this.itemId,signal);if(signal.aborted||turn!==this.generation)return;
   this.publish({subtitleDelay:this.captionDelays.get(`${plan.source.Id}:${plan.subtitleIndex}`)??0,phase:'buffering',plan,position:plan.selection.startTicks/10000000,duration:plan.duration,paused:true});
   const stream=this.gateway.url(plan.stream);__FRAME_DIAGNOSTICS__&&this.log('gateway',{authorized:true});
   this.armStartup();
   // A native "maybe" must not bypass a supported hls.js/MSE decoder. Native-only
   // devices still use the cookie-authorized media element path.
   if(plan.mode!=='direct'&&negotiatedHls(this.itemId,plan.stream)&&this.support.mseHls){const detach=await (this.dependencies.hls??attachHls)(this.video,stream,plan.selection.startTicks/10000000,reason=>{if(turn===this.generation&&!signal.aborted)void this.mediaError(reason);},signal,event=>__FRAME_DIAGNOSTICS__&&this.log('hls-error',event),this.gateway.authorizeHls);if(signal.aborted||turn!==this.generation){detach();return;}this.detachHls=detach;}
   else this.video.src=stream;
   const setStart=()=>{if(signal.aborted||turn!==this.generation)return;this.dimensions();this.clearStartup();__FRAME_DIAGNOSTICS__&&this.log('metadata',{readyState:this.video.readyState});const duration=plan.offset||!Number.isFinite(this.video.duration)?plan.duration:this.video.duration;this.publish({phase:'ready',duration:duration>0?duration:plan.duration});this.video.currentTime=Math.max(0,Math.min(plan.selection.startTicks/10000000,Math.max(0,duration-.1))-plan.offset);this.subtitle(plan);if(!startPaused){this.armStartup();void this.play();}};
   if(this.video.readyState>=1)setStart();else this.video.addEventListener('loadedmetadata',setStart,{once:true,signal});
  }catch(error){if(signal.aborted||turn!==this.generation)return;__FRAME_DIAGNOSTICS__&&this.log('failed',{category:error instanceof PlaybackError?'compatibility':'api',status:typeof (error as {status?:number})?.status==='number'?(error as {status:number}).status:0,mediaCode:this.video.error?.code,readyState:this.video.readyState,networkState:this.video.networkState});if(info?.PlaySessionId)void this.client.stopEncoding(info.PlaySessionId).catch(()=>{});this.detach();this.publish({phase:'failed',error:error instanceof PlaybackError?error.message:'Playback could not start. Check your connection, session, server transcoding permission and browser media support.'});}
 }
 private refreshCaptions(){
  if(this.suppress||!this.track||!this.state.plan)return;
  const captions=synchronizedCaptionText(this.track.track,this.video.currentTime,this.state.plan.offset,this.state.subtitleDelay??0);
  if(JSON.stringify(captions)!==JSON.stringify(this.state.captions??[]))this.publish({captions});
 }
 /** Local text timing only: never seeks video, renegotiates or modifies source cues. */
 subtitleDelay(seconds:number){
  const plan=this.state.plan;if(!plan?.subtitle||this.disposed)return;
  const delay=subtitleDelaySeconds(seconds);this.captionDelays.set(`${plan.source.Id}:${plan.subtitleIndex}`,delay);this.publish({subtitleDelay:delay});this.refreshCaptions();this.syncNativeCaptions();
 }
 private clearNativeCaptions(){const track=this.nativeCaptionTrack;if(!track)return;track.mode='disabled';for(const cue of Array.from(track.cues??[]))track.removeCue(cue);}
 private syncNativeCaptions(){
  this.clearNativeCaptions();if(!this.nativeFullscreen||!this.track||!this.state.plan||typeof this.video.addTextTrack!=='function'||typeof VTTCue==='undefined')return;
  this.nativeCaptionTrack??=this.video.addTextTrack('subtitles','frame. subtitles',this.track.srclang);
  for(const cue of nativeCaptionTimeline(Array.from(this.track.track.cues??[]),this.state.plan.offset,this.state.subtitleDelay??0))this.nativeCaptionTrack.addCue(new VTTCue(cue.start,cue.end,cue.text));
  reconcileCaptionTracks(Array.from(this.video.textTracks),this.track.track,this.nativeCaptionTrack);
 }
 private subtitle(plan:RuntimePlan){
  this.clearNativeCaptions();this.track?.remove();this.track=undefined;this.publish({captions:[]});for(const track of Array.from(this.video.textTracks))track.mode='disabled';if(!plan.subtitle||!this.gateway)return;
  const track=document.createElement('track');track.kind='subtitles';track.label='Selected subtitles';track.srclang=plan.source.MediaStreams.find(t=>t.Index===plan.subtitleIndex)?.Language??'und';track.src=this.gateway.url(plan.subtitle);track.default=true;
  let overlapLogged=false;const update=()=>{if(this.track!==track)return;const cues=Array.from(track.track.activeCues??[]);if(cues.length>1&&!overlapLogged){overlapLogged=true;__FRAME_DIAGNOSTICS__&&this.log('captions',{activeCues:cues.length,firstCueStart:cues[0].startTime,lastCueStart:cues.at(-1)?.startTime,lastCueEnd:cues.at(-1)?.endTime});}this.refreshCaptions();};
  track.addEventListener('load',()=>{if(this.track!==track)return;track.track.mode='hidden';update();this.syncNativeCaptions();});track.track.addEventListener('cuechange',update);track.addEventListener('error',()=>{if(this.track===track)this.publish({captions:[],notice:'Subtitles could not be loaded. Choose Off or select the track again.'});});this.track=track;this.video.appendChild(track);track.track.mode='hidden';
 }
 async play(){const plan=this.state.plan;if(plan&&this.stopped.has(plan.sessionId)){await this.start({...plan.selection,startTicks:this.state.phase==='ended'?0:secondsToTicks(this.position())});return;}const turn=this.generation;try{await this.video.play();}catch{if(turn!==this.generation)return;this.clearStartup();this.publish({phase:'ready',paused:true,notice:'Press Play to begin. Your browser may require a direct playback gesture.'});}}
 pause(){this.video.pause();}
 toggle(){this.video.paused?void this.play():this.pause();}
 seek(seconds:number){const position=Math.max(0,Math.min(seconds,this.state.duration));const plan=this.state.plan;if(plan&&(this.stopped.has(plan.sessionId)||plan.mode==='transcode'&&!negotiatedHls(this.itemId,plan.stream))){void this.start({...plan.selection,startTicks:secondsToTicks(position)},this.video.paused);return;}this.video.currentTime=position-(plan?.offset??0);this.publish({phase:'seeking',position});}
 volume(value:number){this.video.volume=Math.max(0,Math.min(1,value));}
 mute(){this.video.muted=!this.video.muted;}
 async change(value:Partial<PlaybackSelection>){const current=this.state.plan?.selection;if(!current)return;await this.start({...current,startTicks:secondsToTicks(this.position()),...value},this.video.paused&&this.state.phase!=='ended');}
 private async mediaError(reason?:HlsFailure){if(this.disposed||this.state.phase==='failed'||!this.state.plan||this.stopped.has(this.state.plan.sessionId))return;
  __FRAME_DIAGNOSTICS__&&this.log('media-error',{reason:reason??'unknown',mediaCode:this.video.error?.code,readyState:this.video.readyState,networkState:this.video.networkState});const plan=this.state.plan;if(plan?.mode==='direct'&&(this.state.canHls||this.support.progressiveWebm)&&!this.fallback){this.fallback=true;await this.start({...plan.selection,startTicks:secondsToTicks(this.position()),forceTranscode:true});return;}
  await this.finishPlan();this.suppress=true;this.controller.abort();this.gateway?.close();this.detach();this.publish({phase:'failed',paused:true,error:`${reason?`HLS ${reason} failed.`:'The video could not be decoded or streamed.'} ${reason==='timeout'?'The stream did not become ready within 45 seconds. Check Jellyfin transcode logs and the connection.':'Check server transcoding permissions, the connection and browser codec support.'}`});
 }
 async destroy(unloading=false){
  if(this.destroyPromise)return this.destroyPromise;__FRAME_DIAGNOSTICS__&&this.log('cleanup');this.generation++;if(this.timer)clearInterval(this.timer);if(this.captionTimer)clearInterval(this.captionTimer);this.removeEvents.splice(0).forEach(remove=>remove());const finish=this.finishPlan(unloading);this.disposed=true;this.controller.abort();this.gateway?.close();this.detach();this.unregister();this.listeners.clear();this.destroyPromise=finish;return finish;
 }
}
