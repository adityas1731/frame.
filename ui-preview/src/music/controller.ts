import type {JellyfinClient} from '../jellyfin/client.ts';
import type {ItemDto,Session} from '../jellyfin/types.ts';
import {createMediaGateway,type MediaGateway} from '../playback/gateway.ts';
import {secondsToTicks} from '../playback/foundation.ts';
import type {PlayingReport} from '../playback/protocol.ts';
import {mediaFocus,type MediaFocus} from '../playback/mediaFocus.ts';
import {audioPlan,audioProfile,type AudioPlan} from './protocol.ts';
import {emptyQueue,nextEntry,shuffleQueue,insertQueue,moveQueue,removeQueue,type MusicQueue,type QueueEntry} from './queue.ts';
export interface MusicState extends MusicQueue {phase:'idle'|'negotiating'|'ready'|'playing'|'paused'|'buffering'|'ended'|'failed';position:number;duration:number;volume:number;muted:boolean;error?:string;notice?:string}
export const emptyMusicState=():MusicState=>({...emptyQueue(),phase:'idle',position:0,duration:0,volume:.7,muted:false});
export interface MusicDependencies {audio?:()=>HTMLAudioElement;gateway?:typeof createMediaGateway;focus?:MediaFocus;now?:()=>number;random?:()=>number;timeout?:number}
interface Operation {id:number;entry:QueueEntry;abort:AbortController;plan?:AudioPlan;gateway?:MediaGateway;started:boolean;stopped:boolean;duration:number;remove:(()=>void)[];timer?:ReturnType<typeof setTimeout>;wantsPlay:boolean;lastProgress:number;progress?:PlayingReport;progressQueued?:boolean}
/** Persistent queue + one media element. All async work is bound to a track operation. */
export class MusicController {
 private state=emptyMusicState();private listeners=new Set<()=>void>();private serial=0;private generation=0;private selection=0;private active=false;
 private audio?:HTMLAudioElement;private operation?:Operation;private reports=Promise.resolve();private unregister?:()=>void;
 private focus:MediaFocus;private now:()=>number;
 private client:JellyfinClient;private session:Session;private dependencies:MusicDependencies;
 constructor(client:JellyfinClient,session:Session,dependencies:MusicDependencies={}){this.client=client;this.session=session;this.dependencies=dependencies;this.focus=dependencies.focus??mediaFocus;this.now=dependencies.now??Date.now;}
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(patch:Partial<MusicState>){this.state={...this.state,...patch};this.listeners.forEach(listener=>listener());}
 mount(){this.active=true;this.unregister??=this.client.beforeLogout(()=>this.stop(true));}
 private owns(operation:Operation){return this.active&&this.operation===operation&&operation.id===this.generation&&!operation.abort.signal.aborted;}
 private entries(items:ItemDto[]){if(items.length>5000)throw Error('Queues support up to 5000 entries.');return items.filter(item=>item.Type==='Audio').map(item=>({key:++this.serial,item}));}
 async play(items:ItemDto[],index=0){
  if(!this.active)return;++this.selection;const entries=this.entries(items);if(!entries.length)throw Error('No audio tracks are available in this collection.');
  const current=entries[Math.max(0,Math.min(entries.length-1,index))];this.finish();
  let queue:MusicQueue={entries,base:entries.map(entry=>entry.key),current:current.key,shuffle:this.state.shuffle,repeat:this.state.repeat};if(queue.shuffle)queue=shuffleQueue(queue,true,this.dependencies.random);
  this.publish({...queue,error:undefined,notice:undefined});await this.open(current);
 }
 async playCollection(load:()=>Promise<ItemDto[]>){const selection=++this.selection;try{const items=await load();if(this.active&&this.selection===selection)await this.play(items);}catch(error){if(this.active&&this.selection===selection)throw error;}}
 enqueue(items:ItemDto[],next=false){if(!this.active)return false;if(this.state.entries.length+items.length>5000){this.publish({notice:'Queues support up to 5000 entries.'});return false;}const entries=this.entries(items);this.publish(insertQueue(this.state,entries,next));return entries.length>0;}
 shuffle(){this.publish(shuffleQueue(this.state,!this.state.shuffle,this.dependencies.random));}
 repeat(){const repeat=this.state.repeat==='off'?'all':this.state.repeat==='all'?'one':'off';this.publish({repeat});}
 move(key:number,direction:number){this.publish(moveQueue(this.state,key,direction));}
 remove(key:number){const current=this.state.current===key;const next=current?nextEntry({...this.state,repeat:this.state.repeat==='all'?'all':'off'}):undefined;const queue=removeQueue(this.state,key);if(current)this.finish();this.publish(queue);if(current&&next&&next.key!==key)void this.select(next.key);else if(current)this.publish({phase:'idle',position:0,duration:0});}
 async select(key:number){++this.selection;const entry=this.state.entries.find(e=>e.key===key);if(entry){this.publish({current:key});await this.open(entry);}}
 async next(ended=false){++this.selection;const entry=nextEntry(this.state,ended);if(entry){this.publish({current:entry.key});await this.open(entry);}else if(ended){const duration=this.state.duration;this.finish();this.focus.release(this);this.publish({phase:'ended',position:duration});}}
 async previous(){if(this.state.position>3){this.seek(0);return;}const index=this.state.entries.findIndex(entry=>entry.key===this.state.current);const target=this.state.entries[index-1]??(this.state.repeat==='all'?this.state.entries.at(-1):this.state.entries[0]);if(target)await this.select(target.key);}
 pause(){if(this.operation)this.operation.wantsPlay=false;this.audio?.pause();if(this.state.phase!=='idle'&&this.state.phase!=='ended'&&this.state.phase!=='failed')this.publish({phase:'paused'});}
 async resume(){
  if(!this.active)return;const entry=this.state.entries.find(e=>e.key===this.state.current)??this.state.entries[0];if(!entry)return;
  if(!this.operation||this.state.phase==='failed'||this.state.phase==='ended'){this.publish({current:entry.key});await this.open(entry,false,this.state.phase==='ended'?0:this.state.position);return;}
  const operation=this.operation;operation.wantsPlay=true;this.focus.claim(this,()=>this.pause());
  if(!operation.plan||!this.audio)return;
  try{await this.audio.play();}catch{if(this.owns(operation))this.publish({phase:'paused',notice:'Press Play to begin. Your browser may require a playback gesture.'});}
 }
 toggle(){if(this.state.phase==='playing'||this.state.phase==='buffering')this.pause();else void this.resume();}
 seek(position:number){
  const operation=this.operation;if(!Number.isFinite(position))return;if(!operation?.plan||!this.audio){const entry=this.state.entries.find(e=>e.key===this.state.current);if(entry&&['ended','failed'].includes(this.state.phase))void this.open(entry,false,Math.max(0,Math.min(this.state.duration||Infinity,position)),true);return;}
  const target=Math.max(0,Math.min(this.state.duration||Infinity,position));
  if(operation.plan.transcoded){void this.open(operation.entry,true,target,this.audio.paused);return;}
  try{this.audio.currentTime=target;this.publish({position:target});this.progress(operation,true);}catch{this.publish({notice:'This audio stream cannot seek yet. Wait for it to load.'});}
 }
 volume(value:number){if(!Number.isFinite(value))return;const volume=Math.max(0,Math.min(1,value));if(this.audio)this.audio.volume=volume;this.publish({volume});}
 mute(){const muted=!this.state.muted;if(this.audio)this.audio.muted=muted;this.publish({muted});}
 private currentPosition(operation:Operation){return Math.max(0,Math.min(operation.duration||Infinity,(this.audio?.currentTime??0)+(operation.plan?.offset??0)));}
 private report(operation:Operation):PlayingReport|undefined {const plan=operation.plan;if(!plan)return;return {ItemId:plan.itemId,MediaSourceId:plan.source.Id,PlaySessionId:plan.sessionId,PositionTicks:secondsToTicks(this.currentPosition(operation)),IsPaused:this.audio?.paused??true,IsMuted:this.state.muted,VolumeLevel:Math.round(this.state.volume*100),CanSeek:operation.duration>0,PlayMethod:plan.transcoded?'Transcode':'DirectPlay',AudioStreamIndex:plan.source.MediaStreams.find(s=>s.Type==='Audio')?.Index,SubtitleStreamIndex:-1};}
 private send(kind:'started'|'progress',operation:Operation,force=false){
  if(!this.owns(operation)||operation.stopped||kind==='progress'&&(!operation.started||!force&&this.now()-operation.lastProgress<10000))return;
  const report=this.report(operation);if(!report)return;operation.lastProgress=this.now();
  if(kind==='progress'){operation.progress=report;if(operation.progressQueued)return;operation.progressQueued=true;}
  this.reports=this.reports.then(async()=>{if(kind==='progress'){operation.progressQueued=false;const latest=operation.progress;operation.progress=undefined;if(!operation.stopped&&latest)await this.client.reportPlayback(kind,latest);}else await this.client.reportPlayback(kind,report);}).catch(()=>{if(this.owns(operation))this.publish({notice:'Playback progress could not be saved to Jellyfin.'});});
 }
 private progress(operation:Operation,force=false){this.send('progress',operation,force);}
 private finish(unloading=false){
  const operation=this.operation;if(!operation)return;this.operation=undefined;operation.stopped=true;
  clearTimeout(operation.timer);const report=this.report(operation);operation.remove.splice(0).forEach(remove=>remove());operation.abort.abort();operation.gateway?.close();
  if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();}
  const cleanup=async()=>{try{if(operation.started&&report)await this.client.reportPlayback('stopped',report,unloading);}finally{if(operation.plan?.transcoded)await this.client.stopEncoding(operation.plan.sessionId);}};
  if(unloading){const finish=cleanup().catch(()=>{});this.reports=Promise.allSettled([this.reports,finish]).then(()=>{});}
  else this.reports=this.reports.then(cleanup).catch(()=>{});
 }
 private arm(operation:Operation){clearTimeout(operation.timer);operation.timer=setTimeout(()=>{if(this.owns(operation))this.fail(operation,'Audio took too long to load. Check your connection and try again.');},this.dependencies.timeout??45000);}
 private fail(operation:Operation,error:string){if(!this.owns(operation))return;this.finish();this.focus.release(this);this.publish({phase:'failed',error});}
 private async open(entry:QueueEntry,force=false,start=0,paused=false){
  if(!this.active)return;this.finish();const operation:Operation={id:++this.generation,entry,abort:new AbortController(),started:false,stopped:false,duration:0,remove:[],wantsPlay:!paused,lastProgress:0};this.operation=operation;
  if(!paused)this.focus.claim(this,()=>this.pause());
  this.publish({phase:'negotiating',position:start,duration:(entry.item.RunTimeTicks??0)/10000000,error:undefined,notice:undefined});
  try{
   this.audio??=(this.dependencies.audio??(()=>new Audio()))();const audio=this.audio;audio.volume=this.state.volume;audio.muted=this.state.muted;audio.preload='metadata';this.arm(operation);
   const canPlay=(mime:string)=>audio.canPlayType(mime);
   const info=await this.client.playbackInfo(this.session.user.Id,entry.item.Id,{DeviceProfile:audioProfile(canPlay,force),EnableDirectPlay:!force,EnableDirectStream:false,EnableTranscoding:true,AllowAudioStreamCopy:!force,AutoOpenLiveStream:false,IsPlayback:true,StartTimeTicks:secondsToTicks(start),MaxStreamingBitrate:40000000},operation.abort.signal);
   if(!this.owns(operation)){if(info.PlaySessionId)void this.client.stopEncoding(info.PlaySessionId).catch(()=>{});return;}
   let plan:AudioPlan;
   try{plan=audioPlan(entry.item.Id,info,canPlay,this.session.deviceId,force,start);}catch(error){if(info.PlaySessionId)void this.client.stopEncoding(info.PlaySessionId).catch(()=>{});throw error;}
   operation.plan=plan;operation.duration=plan.duration||(entry.item.RunTimeTicks??0)/10000000;
   const gateway=await (this.dependencies.gateway??createMediaGateway)(this.session,entry.item.Id,operation.abort.signal);
   if(!this.owns(operation)){gateway.close();return;}operation.gateway=gateway;
   const listen=(name:string,listener:()=>void)=>{const guarded=()=>{if(this.owns(operation))listener();};audio.addEventListener(name,guarded);operation.remove.push(()=>audio.removeEventListener(name,guarded));};
   listen('loadedmetadata',()=>{clearTimeout(operation.timer);operation.duration=plan.transcoded?operation.duration||(Number.isFinite(audio.duration)?audio.duration+plan.offset:0):Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:operation.duration;this.publish({phase:'ready',duration:operation.duration});if(!plan.transcoded&&start>0)try{audio.currentTime=Math.min(start,Math.max(0,operation.duration-.01));}catch{/* Browser may need more buffered data. */}if(operation.wantsPlay&&this.focus.owns(this))void this.resume();else this.publish({phase:'paused'});});
   listen('playing',()=>{if(!operation.wantsPlay||!this.focus.owns(this)){audio.pause();return;}clearTimeout(operation.timer);this.publish({phase:'playing',error:undefined,notice:undefined});if(!operation.started){operation.started=true;this.send('started',operation);}else this.progress(operation,true);});
   listen('pause',()=>{clearTimeout(operation.timer);if(audio.ended)return;this.publish({phase:'paused',position:this.currentPosition(operation)});this.progress(operation,true);});
   listen('durationchange',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0){operation.duration=plan.transcoded?operation.duration||audio.duration+plan.offset:audio.duration;this.publish({duration:operation.duration});}});
   listen('volumechange',()=>{this.publish({volume:audio.volume,muted:audio.muted});if(this.now()-operation.lastProgress>=250)this.progress(operation,true);});
   listen('timeupdate',()=>{this.publish({position:this.currentPosition(operation)});this.progress(operation);});
   listen('seeked',()=>{this.publish({position:this.currentPosition(operation)});this.progress(operation,true);});
   listen('waiting',()=>{this.publish({phase:'buffering'});this.arm(operation);});
   listen('ended',()=>{this.publish({position:operation.duration});void this.next(true);});
   listen('error',()=>{if(!force&&!plan.transcoded&&plan.source.SupportsTranscoding)void this.open(entry,true,this.currentPosition(operation),!operation.wantsPlay);else this.fail(operation,'This audio file could not play. Try another track or check Jellyfin’s audio transcoding settings.');});
   audio.src=gateway.url(plan.url);audio.load();
  }catch(error){if(this.owns(operation))this.fail(operation,error instanceof Error?error.message:'Audio could not start. Check your connection and sign-in.');}
 }
 async stop(unloading=false){++this.selection;++this.generation;this.finish(unloading);this.focus.release(this);this.publish({...emptyMusicState(),volume:this.state.volume,muted:this.state.muted});await this.reports;}
 async dispose(){this.active=false;this.unregister?.();this.unregister=undefined;await this.stop();}
}
