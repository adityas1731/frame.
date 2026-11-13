import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackRuntime} from '../src/playback/runtime.ts';
import {parseCustomSubtitle} from '../src/playback/customSubtitles.ts';
import {attachEngine} from '../src/playback/hls.ts';
const saved={document:globalThis.document,VTTCue:globalThis.VTTCue,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
const blobs=new Map(),revoked=[];let serial=0;
URL.createObjectURL=blob=>{const url=`blob:synthetic-${++serial}`;blobs.set(url,blob);return url;};
URL.revokeObjectURL=url=>{revoked.push(url);blobs.delete(url);};
globalThis.VTTCue=class {constructor(startTime,endTime,text){Object.assign(this,{startTime,endTime,text});}};
const textTrack=(language='en')=>({kind:'subtitles',label:'Embedded',language,mode:'disabled',cues:[],activeCues:null,addCue(cue){this.cues.push(cue);},removeCue(cue){this.cues.splice(this.cues.indexOf(cue),1);}});
class Track extends EventTarget{
 track=Object.assign(new EventTarget(),textTrack());src='';srclang='';remove(){if(this.owner){this.owner.textTracks.splice(this.owner.textTracks.indexOf(this.track),1);this.owner=undefined;}}
}
globalThis.document={createElement(name){assert.equal(name,'track');return new Track();}};
after(()=>{globalThis.document=saved.document;globalThis.VTTCue=saved.VTTCue;URL.createObjectURL=saved.create;URL.revokeObjectURL=saved.revoke;});
class Video extends EventTarget{
 currentTime=0;duration=30;readyState=1;paused=true;ended=false;volume=1;muted=false;src='';textTracks=[];
 appendChild(track){track.owner=this;this.textTracks.push(track.track);queueMicrotask(async()=>{const text=blobs.has(track.src)?await blobs.get(track.src).text():'WEBVTT\n\n00:00:01.000 --> 00:00:20.000\nJellyfin cue';track.track.cues=[new VTTCue(1,20,text.split('\n').slice(3).join('\n').trim())];track.dispatchEvent(new Event('load'));});}
 play(){this.paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();}
 pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}load(){}removeAttribute(){this.src='';}addTextTrack(_kind,_label,language){const track=textTrack(language);this.textTracks.push(track);return track;}
}
function harness({hls=false,burned=false}={}){
 const video=new Video();let negotiations=0,captionCallbacks;const selections=[];
 const source={Id:'source',Container:'mp4',SupportsDirectPlay:true,SupportsDirectStream:true,SupportsTranscoding:true,TranscodingUrl:'/Videos/item/master.m3u8',RunTimeTicks:300000000,DefaultSubtitleStreamIndex:3,MediaStreams:[{Type:'Video',Index:0,Codec:'h264'},{Type:'Audio',Index:1,Codec:'aac'},{Type:'Subtitle',Index:3,Codec:burned?'pgssub':'subrip',Language:'dan',DeliveryMethod:burned?'Encode':'External'}]};
 const client={beforeLogout:()=>()=>{},playbackInfo:async()=>({PlaySessionId:`session-${++negotiations}`,MediaSources:[source]}),reportPlayback:async()=>{},stopEncoding:async()=>{},invalidate(){}};
 const runtime=new PlaybackRuntime(client,{user:{Id:'user'},deviceId:'device',server:{Id:'server'},baseUrl:'https://example.invalid',token:'not-for-custom-URLs'},'item',video,{support:{nativeHls:false,mseHls:hls||burned,video:['h264'],audio:['aac'],containers:['mp4'],canDirect:async()=>!hls},gateway:async()=>({url:()=>'/local-vtt',close(){}}),updated(){},hls:async(...args)=>{captionCallbacks=args[7];return Object.assign(()=>{},{selectSubtitle:index=>selections.push(index)});}});
 return {runtime,video,selections,get negotiations(){return negotiations;},get captionCallbacks(){return captionCallbacks;}};
}
const input=name=>parseCustomSubtitle(new TextEncoder().encode('1\n00:00:01,000 --> 00:00:20,000\nCustom cue'),name);
const settle=()=>new Promise(r=>setImmediate(r));
for(const hls of [false,true])test(`custom subtitles: ${hls?'HLS':'Direct Play'} switching, seek, Off, replacement and URL cleanup`,async()=>{
 const h=harness({hls});try{
  await h.runtime.start({startTicks:80000000,maxBitrate:40000000});await settle();h.runtime.pause();
  await h.runtime.loadCustomSubtitle(input('one.en.srt'));await settle();assert.equal(h.runtime.state.customSubtitleSelected,true);assert.equal(h.runtime.state.plan.subtitleIndex,-1);assert.equal(h.video.currentTime,8);assert.equal(h.video.paused,true);assert.deepEqual(h.runtime.state.captions,['Custom cue']);
  await h.runtime.change({maxBitrate:20000000,subtitleIndex:undefined});await settle();assert.equal(h.runtime.state.plan.subtitleIndex,-1);assert.equal(h.runtime.state.customSubtitleSelected,true);assert.deepEqual(h.runtime.state.captions,['Custom cue']);
  h.runtime.seek(10);h.video.dispatchEvent(new Event('seeked'));assert.deepEqual(h.runtime.state.captions,['Custom cue']);
  h.video.dispatchEvent(new Event('webkitbeginfullscreen'));assert.equal(h.video.textTracks.filter(t=>t.mode==='showing').length,1);h.video.dispatchEvent(new Event('webkitendfullscreen'));assert.equal(h.video.textTracks.filter(t=>t.mode==='showing').length,0);
  await h.runtime.change({subtitleIndex:-1});await settle();assert.equal(h.runtime.state.customSubtitleSelected,false);assert.deepEqual(h.runtime.state.captions,[]);
  await h.runtime.selectCustomSubtitle();await settle();assert.deepEqual(h.runtime.state.captions,['Custom cue']);const before=revoked.length;
  const revision=h.runtime.state.customSubtitle.revision;await h.runtime.loadCustomSubtitle(input('two.srt'));await settle();assert.equal(revoked.length,before+1);assert.equal(h.runtime.state.customSubtitle.name,'two.srt');assert.ok(h.runtime.state.customSubtitle.revision>revision);
  await h.runtime.change({subtitleIndex:3});await settle();assert.equal(h.runtime.state.customSubtitleSelected,false);assert.deepEqual(h.runtime.state.captions,['Jellyfin cue']);
  await h.runtime.selectCustomSubtitle();await settle();h.video.ended=true;h.video.dispatchEvent(new Event('ended'));assert.equal(h.runtime.state.customSubtitle,undefined);assert.equal(blobs.size,0);
 }finally{await h.runtime.destroy();}
});
test('custom subtitles remove burned-in source via renegotiation, preserving pause and position',async()=>{
 const h=harness({burned:true});try{await h.runtime.start({startTicks:80000000,maxBitrate:40000000});await settle();h.runtime.pause();const before=h.negotiations;await h.runtime.loadCustomSubtitle(input('custom.srt'));await settle();assert.equal(h.negotiations,before+1);assert.equal(h.runtime.state.plan.subtitleIndex,-1);assert.equal(h.runtime.state.plan.selection.subtitleIndex,-1);assert.equal(h.video.currentTime,8);assert.equal(h.video.paused,true);}finally{await h.runtime.destroy();assert.equal(blobs.size,0);}
});
test('custom URLs are released on removal and runtime destruction',async()=>{
 const h=harness();try{await h.runtime.start({startTicks:0,maxBitrate:40000000});await h.runtime.loadCustomSubtitle(input('a.srt'));await settle();h.runtime.removeCustomSubtitle();assert.equal(blobs.size,0);assert.deepEqual(h.runtime.state.captions,[]);await h.runtime.loadCustomSubtitle(input('b.srt'));await settle();}finally{await h.runtime.destroy();}assert.equal(blobs.size,0);
});
test('HLS manifest-only subtitles appear in state, render cues, and Off disables the engine track',async()=>{
 const h=harness({hls:true});try{await h.runtime.start({startTicks:0,maxBitrate:40000000,subtitleIndex:-1});await settle();h.captionCallbacks.tracks([{id:'hls:0',label:'Finnish',language:'fi',source:'hls'}]);await h.runtime.selectAdditionalSubtitle('hls:0');assert.equal(h.selections.at(-1),0);h.video.currentTime=4;h.captionCallbacks.cues([new VTTCue(1,10,'Manifest caption')]);assert.deepEqual(h.runtime.state.captions,['Manifest caption']);assert.equal(h.runtime.state.additionalSubtitleSelected,'hls:0');await h.runtime.change({subtitleIndex:-1});await settle();assert.equal(h.selections.at(-1),-1);assert.equal(h.runtime.state.additionalSubtitleSelected,undefined);assert.deepEqual(h.runtime.state.captions,[]);}finally{await h.runtime.destroy();}
});
test('HLS adapter exposes manifest tracks and cue events without enabling native drawing',()=>{
 let engine;class Engine{static Events={ERROR:'error',SUBTITLE_TRACKS_UPDATED:'tracks',CUES_PARSED:'cues'};static ErrorTypes={};handlers={};constructor(){engine=this;}on(name,fn){this.handlers[name]=fn;}attachMedia(){}loadSource(){}destroy(){this.destroyed=true;}}
 let tracks,cues;const close=attachEngine(Engine,{},new Video(),'/fixture',()=>{},undefined,undefined,{tracks:value=>{tracks=value;return 0;},cues:value=>{cues=value;}});
 engine.handlers.tracks('tracks',{subtitleTracks:[{name:'English SDH',lang:'en',forced:false}]});assert.equal(tracks[0].id,'hls:0');assert.equal(engine.subtitleTrack,0);assert.equal(engine.subtitleDisplay,false);const cue=new VTTCue(0,2,'hi');engine.handlers.cues('cues',{type:'subtitles',cues:[cue]});assert.deepEqual(cues,[cue]);close.selectSubtitle(-1);assert.equal(engine.subtitleTrack,-1);close();assert.equal(engine.destroyed,true);
});

test('HLS subtitle switches discard late cue events from the old track and after cleanup',()=>{
 let engine;class Engine{static Events={ERROR:'error',SUBTITLE_TRACKS_UPDATED:'tracks',CUES_PARSED:'cues'};static ErrorTypes={};handlers={};subtitleTracks=[{name:'Danish'},{name:'Finnish'}];constructor(){engine=this;}on(name,fn){this.handlers[name]=fn;}attachMedia(){}loadSource(){}destroy(){}}
 const received=[];const close=attachEngine(Engine,{},new Video(),'/fixture',()=>{},undefined,undefined,{tracks:()=>-1,cues:value=>received.push(value)});
 close.selectSubtitle(1);const cue=new VTTCue(0,2,'Finnish');
 engine.handlers.cues('cues',{type:'subtitles',track:'subtitles0',subtitleTrack:engine.subtitleTracks[0],cues:[cue]});assert.equal(received.length,0);
 engine.handlers.cues('cues',{type:'subtitles',track:'subtitles1',subtitleTrack:engine.subtitleTracks[1],cues:[cue]});assert.equal(received.length,1);
 close.selectSubtitle(-1);engine.handlers.cues('cues',{type:'subtitles',track:'subtitles1',cues:[cue]});assert.equal(received.length,1);
 close();engine.handlers.cues('cues',{type:'subtitles',cues:[cue]});assert.equal(received.length,1);
});
