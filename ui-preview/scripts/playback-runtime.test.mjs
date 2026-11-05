import {readEarlyProgress} from '../src/playback/earlyProgress.ts';
import {DIAGNOSTICS_ENABLED} from '../src/build/flags.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackRuntime} from '../src/playback/runtime.ts';
import {parsePlaybackInfo,playbackBody,selectedTracks} from '../src/playback/protocol.ts';
import {runtimePlan,negotiatedHls} from '../src/playback/planner.ts';
import {JellyfinClient} from '../src/jellyfin/client.ts';
import {createFixtureFetch} from '../src/jellyfin/fixtures.ts';
import {parseSegments,activeSegment,SegmentSkipper,skippingPreferences} from '../src/playback/segments.ts';
import {cleanMediaUrl,rewritePlaylist,mediaPathAllowed} from '../public/frame-stream-policy.js';
const source={Id:'source',Container:'mp4',RunTimeTicks:300000000,Bitrate:1500000,SupportsDirectPlay:true,SupportsDirectStream:true,SupportsTranscoding:true,TranscodingSubProtocol:'hls',TranscodingUrl:'/Videos/item/master.m3u8?api_key=secret&StartTimeTicks=80000000',DefaultAudioStreamIndex:1,DefaultSubtitleStreamIndex:-1,MediaStreams:[{Index:0,Type:'Video',Codec:'h264'},{Index:1,Type:'Audio',Codec:'aac'},{Index:2,Type:'Audio',Codec:'aac'},{Index:3,Type:'Subtitle',Codec:'vtt',IsExternal:true}]};
const support={nativeHls:false,mseHls:false,video:['h264'],audio:['aac'],containers:['mp4'],canDirect:async()=>true};
const info=()=>parsePlaybackInfo({PlaySessionId:crypto.randomUUID(),MediaSources:[source]});
const session={user:{Id:'user'},deviceId:'device',token:'never-in-URL',baseUrl:'https://server.invalid',server:{Id:'server',Version:'10.11.9'},created:0};
const selection={startTicks:80000000,maxBitrate:40000000};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
class Video extends EventTarget{
 currentTime=0;duration=30;readyState=1;paused=true;ended=false;volume=1;muted=false;src='';textTracks=[];
 play(){this.paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();}
 pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
 removeAttribute(){this.src='';}load(){}canPlayType(){return 'probably';}
}
function harness(options={}){
 const reports=[],encodings=[],grants=[];let cleanups=new Set();let invalidations=0;
 const client={beforeLogout:task=>{cleanups.add(task);return()=>cleanups.delete(task);},playbackInfo:async()=>info(),reportPlayback:async(kind,body)=>{reports.push({kind,body});if(options.failStop&&kind==='stopped')throw Error('offline');},stopEncoding:async id=>{encodings.push(id);},invalidate:()=>invalidations++};
 const video=new Video();if(options.textTracks)video.textTracks=options.textTracks;const player=new PlaybackRuntime(client,session,options.itemId??'item',video,{support:options.support??support,startupTimeoutMs:options.startupTimeoutMs,gateway:async(_s,_i,signal)=>{const grant={closed:false};grants.push(grant);signal.addEventListener('abort',()=>grant.closed=true);return{url:()=>'/__frame_media/opaque',close:()=>grant.closed=true};},hls:options.hls??(async()=>()=>{}),updated:()=>{}});
 return{client,video,player,reports,encodings,grants,cleanups,get invalidations(){return invalidations;}};
}

test('replay resets the media clock and pause publishes the current session position without timeupdate',async()=>{
 const h=harness();
 try{
  await h.player.start(selection);await settle();
  h.video.currentTime=30;h.video.ended=true;h.video.dispatchEvent(new Event('ended'));
  await settle();
  h.video.ended=false;
  await h.player.start({...selection,startTicks:0});await settle();
  assert.equal(h.video.currentTime,0);
  assert.equal(h.player.state.position,0);
  h.video.currentTime=4.5;h.video.pause();
  assert.equal(h.player.state.position,4.5);
  assert.equal(h.player.state.duration,30);
 }finally{await h.player.destroy();}
});

for(const [nativeHls,mseHls,expectedAdapter] of [[true,true,true],[false,true,true],[true,false,false]])test(`HLS uses the verified adapter when available (native=${nativeHls}, MSE=${mseHls})`,async()=>{
 let attached=0,detached=0;const h=harness({support:{...support,nativeHls,mseHls,canDirect:async()=>false},hls:async()=>{attached++;return()=>detached++;}});
 try{await h.player.start(selection);await settle();assert.notEqual(h.player.state.plan.mode,'direct');assert.equal(attached,expectedAdapter?1:0);await h.player.destroy();assert.equal(detached,attached);assert.ok(h.grants.every(g=>g.closed));}finally{await h.player.destroy();}
});
test('native and MSE capability does not replace genuine Direct Play with an HLS adapter',async()=>{
 let attached=0;const h=harness({support:{...support,nativeHls:true,mseHls:true},hls:async()=>{attached++;return()=>{};}});
 try{await h.player.start(selection);assert.equal(h.player.state.plan.mode,'direct');assert.equal(attached,0);}finally{await h.player.destroy();}
});

for(const hls of [false,true])test(`segment seek uses normal ${hls?'HLS':'Direct Play'} runtime reporting and cleanup`,async()=>{
 const h=harness({support:hls?{...support,mseHls:true,canDirect:async()=>false}:support});
 const segments=parseSegments({Items:[{ItemId:'item',Type:'Intro',StartTicks:0,EndTicks:150000000}]},'item');
 try{
  await h.player.start(selection);await settle();
  const prefs={...skippingPreferences(null),Intro:'auto'};const skipper=new SegmentSkipper();
  const active=activeSegment(segments,h.player.state.position,h.player.state.duration,prefs);assert.ok(active);
  const end=skipper.automatic(active,prefs,true);h.player.seek(end);
  assert.equal(h.video.currentTime,15-(h.player.state.plan.offset??0));
  h.video.dispatchEvent(new Event('seeked'));await settle();
  assert.equal(h.reports.find(r=>r.body.EventName==='seek').body.PositionTicks,150000000);
  assert.equal(activeSegment(segments,h.player.state.position,h.player.state.duration,prefs),undefined);
  assert.equal(skipper.automatic(active,prefs,true),undefined);
  await h.player.destroy();assert.equal(h.grants[0].closed,true);assert.equal(h.cleanups.size,0);
 }finally{await h.player.destroy();}
});
test('DTO boundary rejects server errors, ignores filesystem paths and retains API track indexes',()=>{
 assert.throws(()=>parsePlaybackInfo({ErrorCode:'NotAllowed'}),/compatible stream/);
 assert.throws(()=>parsePlaybackInfo({MediaSources:[source]}),/incomplete/);
 const result=parsePlaybackInfo({PlaySessionId:'id',MediaSources:[{...source,Path:'C:\\secret.mkv'}]});assert.equal(result.MediaSources[0].Path,undefined);
 assert.equal(selectedTracks(result.MediaSources[0],{...selection,subtitleIndex:-1}).subtitleIndex,-1);
 assert.throws(()=>selectedTracks(result.MediaSources[0],{...selection,audioIndex:88}),/not available/);
});
test('negotiation advertises only implemented streaming paths, exact selection and ticks',()=>{
 const body=playbackBody('user',{}, {...selection,audioIndex:2,subtitleIndex:-1},false);
 assert.equal(body.EnableTranscoding,false);assert.equal(body.EnableDirectStream,false);assert.equal(body.StartTimeTicks,80000000);assert.equal(body.AudioStreamIndex,2);assert.equal(body.SubtitleStreamIndex,-1);assert.equal(body.AutoOpenLiveStream,false);
});

test('failed negotiation retains a shareable status and stage without raw server errors',async()=>{
 const h=harness();h.client.playbackInfo=async()=>{throw Object.assign(new Error('private token and server path'),{status:403});};
 try{await h.player.start(selection);assert.equal(h.player.state.phase,'failed');const events=h.player.state.diagnostics;if(DIAGNOSTICS_ENABLED){assert.ok(events.some(e=>e.stage==='negotiation-request'));assert.equal(events.at(-1).facts.status,403);assert.doesNotMatch(JSON.stringify(events),/private token|server path/);}else assert.equal(events,undefined);}finally{await h.player.destroy();}
});
test('runtime plan distinguishes direct/remux/transcode, alternate audio and image burn-in',async()=>{
 const direct=await runtimePlan('item',info(),support,selection,'device');assert.equal(direct.mode,'direct');assert.doesNotMatch(direct.stream,/api_key|never-in/);
 const hls={...support,mseHls:true};assert.equal((await runtimePlan('item',info(),hls,{...selection,audioIndex:2},'device')).mode,'remux');
 assert.equal((await runtimePlan('item',info(),hls,{...selection,forceTranscode:true},'device')).mode,'transcode');
 await assert.rejects(runtimePlan('item',info(),support,{...selection,audioIndex:2},'device'),/No compatible/);
 const denied=info();denied.MediaSources[0]={...denied.MediaSources[0],SupportsDirectPlay:false,SupportsDirectStream:false,SupportsTranscoding:false};await assert.rejects(runtimePlan('item',denied,hls,selection,'device'),/No compatible/);
 const text=await runtimePlan('item',info(),support,{...selection,subtitleIndex:3},'device');assert.match(text.subtitle,/source\/Subtitles\/3\/Stream.vtt$/);
});
test('10.11 HLS URL works with missing or HTTP-default SubProtocol, without bypassing permissions',async()=>{
 const hls={...support,mseHls:true,canDirect:async()=>false};
 for(const protocol of [undefined,'http','hls']){
  const response=parsePlaybackInfo({PlaySessionId:'negotiated',MediaSources:[{...source,Container:'mkv',SupportsDirectPlay:false,SupportsDirectStream:false,TranscodingSubProtocol:protocol}]});
  assert.equal((await runtimePlan('item',response,hls,selection,'device')).mode,'transcode');
  response.MediaSources[0].SupportsTranscoding=false;
  await assert.rejects(runtimePlan('item',response,hls,selection,'device'),/No compatible/);
 }
 for(const raw of ['/Videos/other/master.m3u8','/Videos/item/stream.mp4?file=master.m3u8','/Videos/item/master.m3u8/extra','javascript:master.m3u8','https://user:pass@server.invalid/Videos/item/master.m3u8'])assert.equal(negotiatedHls('item',raw),false);
 assert.equal(negotiatedHls('item','/jellyfin/Videos/item/master.m3u8?api_key=secret'),true);
 // Path detection is not URL authorization: the existing gateway still rejects external origins.
 assert.throws(()=>cleanMediaUrl('https://evil.invalid/Videos/item/master.m3u8','https://server.invalid','item'));
});

test('fixture with HTTP-default protocol reaches HLS runtime rather than the compatibility error',async()=>{
 const fixture=createFixtureFetch('10.11.9');const client=new JellyfinClient('https://frame-fixture.invalid','device',fixture);
 const server=await client.probe();const session=await client.authenticate(server,'fiction','fiction');
 const response=await client.playbackInfo(session.user.Id,'fixture-1',playbackBody(session.user.Id,{},selection,true));
 assert.equal(response.MediaSources[0].TranscodingSubProtocol,'http');
 const h=harness({itemId:'fixture-1',support:{...support,mseHls:true,canDirect:async()=>false}});
 h.client.playbackInfo=async()=>response;
 try{await h.player.start(selection);assert.equal(h.player.state.plan.mode,'transcode');assert.notEqual(h.player.state.phase,'failed');assert.equal(h.grants.length,1);}finally{await h.player.destroy();client.dispose();}
});

test('Jellyfin Guid.ToString stream IDs match compact API IDs through planning and gateway policy',async()=>{
 const item='11111111222243338444555555555555',dashed='11111111-2222-4333-8444-555555555555';
 const response=parsePlaybackInfo({PlaySessionId:'session',MediaSources:[{...source,Container:'mkv',SupportsDirectPlay:false,SupportsDirectStream:false,TranscodingUrl:`/videos/${dashed}/master.m3u8?api_key=secret`}]});
 const plan=await runtimePlan(item,response,{...support,mseHls:true,canDirect:async()=>false},selection,'device');assert.equal(plan.mode,'transcode');
 assert.equal(cleanMediaUrl(plan.stream,'https://server.invalid',item),`videos/${dashed}/master.m3u8`);
 const playlist=rewritePlaylist('#EXTM3U\nhls1/main/0.ts?api_key=secret\n',`https://server.invalid/videos/${dashed}/main.m3u8`,'https://server.invalid',item,'nonce');assert.match(playlist,/stream.ts/);assert.doesNotMatch(playlist,/secret/);
 assert.throws(()=>cleanMediaUrl(`/videos/${dashed.replace('1111','2111')}/master.m3u8`,'https://server.invalid',item));
});

test('gateway strips credentials, retains scoped range paths and HLS has full timeline',()=>{
 const base='https://server.invalid/jellyfin';const relative=cleanMediaUrl('/jellyfin/Videos/item/master.m3u8?api_key=secret&StartTimeTicks=80000000&AudioStreamIndex=2',base,'item');assert.equal(relative,'Videos/item/master.m3u8?AudioStreamIndex=2');
 for(const url of ['https://evil.invalid/Videos/item/stream.mp4','/jellyfin/Items/item','/jellyfin/Videos/other/stream.mp4','/jellyfin/Videos/item/../../Sessions/Playing','https://user:pass@server.invalid/jellyfin/Videos/item/stream.mp4'])assert.throws(()=>cleanMediaUrl(url,base,'item'));
 const rewritten=rewritePlaylist('#EXTM3U\n#EXT-X-MAP:URI="hls1/main/-1.mp4?api_key=secret"\nhls1/main/0.ts?api_key=secret\n','https://server.invalid/jellyfin/Videos/item/main.m3u8',base,'item','nonce');assert.doesNotMatch(rewritten,/secret/);assert.match(rewritten,/__frame_media/);
 assert.throws(()=>rewritePlaylist('#EXTM3U\nhttps://evil.invalid/key','https://server.invalid/Videos/item/master.m3u8','https://server.invalid','item','nonce'));
 assert.equal(mediaPathAllowed('Videos/item/hls1/main/-1.mp4','item'),true);assert.equal(mediaPathAllowed('Videos/ActiveEncodings','item'),false);
});
test('actual media events start once, report seeks/pauses in ticks and stop only once',async()=>{
 const h=harness();try{await h.player.start(selection);await settle();assert.equal(h.video.currentTime,8);assert.equal(h.reports.filter(r=>r.kind==='started').length,1);
 h.video.dispatchEvent(new Event('playing'));h.video.currentTime=12.5;h.video.dispatchEvent(new Event('seeked'));await settle();h.player.pause();await settle();
 assert.equal(h.reports.find(r=>r.body.EventName==='seek').body.PositionTicks,125000000);assert.equal(h.reports.find(r=>r.body.EventName==='pause').body.IsPaused,true);
 await h.player.destroy();await h.player.destroy();assert.equal(h.reports.filter(r=>r.kind==='stopped').length,1);assert.equal(h.grants[0].closed,true);assert.equal(h.video.src,'');assert.equal(h.cleanups.size,0);assert.equal(h.encodings.length,0);
 }finally{await h.player.destroy();}
});
test('opening without playing never marks watched; completion reports actual end position',async()=>{
 const h=harness();h.video.play=()=>Promise.reject(Error('gesture'));try{await h.player.start(selection);await settle();await h.player.destroy();assert.equal(h.reports.length,0);}finally{await h.player.destroy();}
 const completed=harness();try{await completed.player.start(selection);completed.video.currentTime=30;completed.video.ended=true;completed.video.dispatchEvent(new Event('ended'));await settle();await completed.player.destroy();assert.equal(completed.reports.filter(r=>r.kind==='stopped').length,1);assert.equal(completed.reports.at(-1).body.PositionTicks,300000000);}finally{await completed.player.destroy();}
});
test('page-exit HLS cleanup starts both keepalive requests without waiting for progress',async()=>{
 const h=harness({support:{...support,mseHls:true}});let releaseProgress;
 try{
  await h.player.start({...selection,forceTranscode:true});await settle();
  const original=h.client.reportPlayback;h.client.reportPlayback=(kind,body)=>kind==='progress'?new Promise(resolve=>{releaseProgress=resolve;}):original(kind,body);
  h.video.pause();await settle();assert.equal(typeof releaseProgress,'function');
  const id=h.player.state.plan.sessionId;const finishing=h.player.destroy(true);
  // These assertions run before the next microtask, as pagehide cannot rely on one.
  assert.deepEqual(h.encodings,[id]);assert.equal(h.reports.filter(r=>r.kind==='stopped').length,1);
  await finishing;releaseProgress();await settle();await h.player.destroy(true);
  assert.equal(h.reports.filter(r=>r.kind==='stopped').length,1);
 }finally{releaseProgress?.();await h.player.destroy();}
});

test('playing clears an obsolete autoplay gesture notice',async()=>{
 const h=harness();const play=h.video.play.bind(h.video);h.video.play=()=>Promise.reject(Error('gesture'));
 try{await h.player.start(selection);assert.match(h.player.state.notice,/Press Play/);h.video.play=play;await h.player.play();assert.equal(h.player.state.notice,undefined);}finally{await h.player.destroy();}
});

test('HLS cleanup targets only its own session if stop reporting fails',async()=>{
 const h=harness({support:{...support,mseHls:true},failStop:true});try{await h.player.start({...selection,forceTranscode:true});await settle();const id=h.player.state.plan.sessionId;await h.player.destroy();assert.deepEqual(h.encodings,[id]);assert.equal(h.reports.filter(r=>r.kind==='stopped').length,1);}finally{await h.player.destroy();}
});
test('replaying completed media negotiates a fresh session, and paused track changes stay paused',async()=>{
 const h=harness();try{await h.player.start(selection);h.video.currentTime=30;h.video.ended=true;h.video.paused=true;h.video.dispatchEvent(new Event('ended'));await settle();const old=h.player.state.plan.sessionId;h.video.ended=false;await h.player.play();await settle();assert.notEqual(h.player.state.plan.sessionId,old);assert.equal(h.reports.filter(r=>r.kind==='started').length,2);assert.equal(h.reports.filter(r=>r.kind==='stopped').length,1);
 h.player.pause();await h.player.change({maxBitrate:20000000});assert.equal(h.video.paused,true);await h.player.change({maxBitrate:40000000});assert.equal(h.video.paused,true);
 }finally{await h.player.destroy();}
});
test('stale PlaybackInfo cannot attach after navigating away; pending negotiation is cancelled',async()=>{
 const h=harness();let release;h.client.playbackInfo=()=>new Promise(resolve=>release=resolve);const starting=h.player.start(selection);await settle();await h.player.destroy();release(info());await starting;assert.equal(h.grants.length,0);assert.equal(h.reports.length,0);assert.equal(h.encodings.length,1);
});
test('HLS source changes capture the old stop position before the adapter clears the media element',async()=>{
 const h=harness({support:{...support,mseHls:true},hls:async(video,_url,_start,_error,signal)=>{signal.addEventListener('abort',()=>video.currentTime=0);return()=>{video.currentTime=0;};}});
 try{await h.player.start({...selection,forceTranscode:true});h.video.currentTime=12.5;await h.player.change({maxBitrate:8000000});const stop=h.reports.find(r=>r.kind==='stopped');assert.equal(stop.body.PositionTicks,125000000);assert.equal(h.player.state.plan.selection.startTicks,125000000);}finally{await h.player.destroy();}
});

test('track renegotiation retains negotiated MediaSourceId so Jellyfin applies track choices',async()=>{
 const h=harness({support:{...support,mseHls:true}});const bodies=[];
 h.client.playbackInfo=async(_user,_item,body)=>{bodies.push(body);return info();};
 try{await h.player.start(selection);h.player.pause();h.video.currentTime=12.5;await h.player.change({audioIndex:2,subtitleIndex:-1});
 assert.equal(bodies.at(-1).MediaSourceId,'source');assert.equal(bodies.at(-1).AudioStreamIndex,2);assert.equal(bodies.at(-1).SubtitleStreamIndex,-1);assert.equal(bodies.at(-1).StartTimeTicks,125000000);assert.equal(h.video.paused,true);
 }finally{await h.player.destroy();}
});
test('client playback contracts target 10.11.9, do not retry writes, and refresh only user caches',async()=>{
 const calls=[];const fixture=createFixtureFetch('10.11.9');const client=new JellyfinClient('https://frame-fixture.invalid','device',async(url,init)=>{calls.push({url,init});return fixture(url,init);});
 const server=await client.probe();const session=await client.authenticate(server,'fiction','fiction');const info=await client.playbackInfo(session.user.Id,'episode-0',playbackBody(session.user.Id,{},selection,false));assert.ok(info.PlaySessionId);
 const report={ItemId:'episode-0',MediaSourceId:info.MediaSources[0].Id,PlaySessionId:info.PlaySessionId,PositionTicks:123000000,IsPaused:true,IsMuted:false,VolumeLevel:50,CanSeek:true,PlayMethod:'DirectPlay',SubtitleStreamIndex:-1};await client.reportPlayback('started',report);await client.reportPlayback('progress',report);await client.reportPlayback('stopped',report);client.invalidate();assert.equal((await client.item(session.user.Id,'episode-0')).UserData.PlaybackPositionTicks,123000000);
 assert.equal((await client.nextEpisode(session.user.Id,'fixture-2','episode-0')).Id,'episode-1');await client.stopEncoding(info.PlaySessionId);const deletion=calls.at(-1);assert.match(deletion.url,/deviceId=device&playSessionId=/);assert.equal(deletion.init.method,'DELETE');
 for(const {url} of calls)assert.doesNotMatch(url,/fictional-session-token/);
 const failed=[];const broken=new JellyfinClient('https://server.invalid','device',async(url,init)=>{failed.push(url);return new Response('{}',{status:503});});await assert.rejects(broken.reportPlayback('progress',report));assert.equal(failed.length,1);broken.dispose();client.dispose();
});
test('fixture progress appears in Continue Watching and completion advances Next Up without a client metadata mutation',async()=>{
 const client=new JellyfinClient('https://frame-fixture.invalid','device',createFixtureFetch('10.11.9'));const server=await client.probe();const session=await client.authenticate(server,'fiction','fiction');
 const report={ItemId:'episode-1',MediaSourceId:'source-episode-1',PlaySessionId:'fake-session',PositionTicks:140000000,IsPaused:true,IsMuted:false,VolumeLevel:50,CanSeek:true,PlayMethod:'DirectPlay',SubtitleStreamIndex:-1};
 await client.reportPlayback('started',report);await client.reportPlayback('stopped',report);client.invalidate();
 assert.ok((await client.items(session.user.Id,{resume:true,kind:'Episode'})).Items.some(item=>item.Id==='episode-1'&&item.UserData.PlaybackPositionTicks===140000000));
 await client.reportPlayback('stopped',{...report,PositionTicks:300000000});client.invalidate();
 assert.ok(!(await client.items(session.user.Id,{resume:true,kind:'Episode'})).Items.some(item=>item.Id==='episode-1'));
 assert.equal((await client.nextUp(session.user.Id,1,undefined,'fixture-2')).Items[0].Id,'episode-2');client.dispose();
});

test('no-MSE AV1 MKV negotiates only explicitly compatible HTTP WebM and keeps resume/seek absolute',async()=>{
 const h=harness({support:{...support,mseHls:false,nativeHls:false,progressiveWebm:true,canDirect:async()=>false}});
 const requests=[];let serial=0;
 h.client.playbackInfo=async(_u,_i,body)=>{requests.push(body);return{PlaySessionId:`http-${++serial}`,MediaSources:[{...source,Container:'mkv',SupportsDirectPlay:false,SupportsDirectStream:false,SupportsTranscoding:true,TranscodingUrl:`Videos/item/stream.webm?VideoCodec=vp8&AudioCodec=vorbis&StartTimeTicks=${body.StartTimeTicks}`,MediaStreams:[{Index:0,Type:'Video',Codec:'av1',BitDepth:10},{Index:1,Type:'Audio',Codec:'opus',Channels:6}]}]};};
 try{
  await h.player.start({...selection,startTicks:80000000});
  assert.equal(requests[0].EnableTranscoding,true);assert.equal(h.player.state.plan.mode,'transcode');assert.equal(h.player.state.plan.offset,8);assert.equal(h.video.currentTime,0);assert.match(h.video.src,/__frame_media/);
  h.video.currentTime=3;h.video.dispatchEvent(new Event('timeupdate'));assert.equal(h.player.state.position,11);
  h.player.seek(20);await new Promise(resolve=>setTimeout(resolve,20));assert.equal(requests.at(-1).StartTimeTicks,200000000);assert.equal(h.player.state.plan.offset,20);
 }finally{await h.player.destroy();}
});

test('HTTP fallback rejects unnegotiated codecs, wrong items and non-WebM endpoints',async()=>{
 const {negotiatedWebm}=await import('../src/playback/planner.ts');
 assert.equal(negotiatedWebm('item','Videos/item/stream.webm?VideoCodec=vp8&AudioCodec=vorbis'),true);
 for(const url of ['Videos/other/stream.webm?VideoCodec=vp8&AudioCodec=vorbis','Videos/item/stream.webm?VideoCodec=av1&AudioCodec=opus','Videos/item/stream.webm','Videos/item/stream.mp4?VideoCodec=vp8&AudioCodec=vorbis'])assert.equal(negotiatedWebm('item',url),false);
 const {deviceProfile,browserSupport}=await import('../src/playback/capabilities.ts');
 const compatible=browserSupport({canPlayType:mime=>mime.includes('vp8')||mime.includes('vorbis')?'probably':''},false);
 assert.equal(compatible.progressiveWebm,true);assert.equal(deviceProfile(compatible,8000000).TranscodingProfiles[0].Protocol,'http');
 const unsupported=browserSupport({canPlayType:()=>''},false);assert.equal(unsupported.progressiveWebm,false);assert.deepEqual(deviceProfile(unsupported,8000000).TranscodingProfiles,[]);
});

test('runtime suppresses late native drawing without renegotiating and removes track listeners on close',async()=>{
 class Tracks extends EventTarget{items=[];[Symbol.iterator](){return this.items[Symbol.iterator]();}}
 const tracks=new Tracks();const h=harness({textTracks:tracks});let negotiations=0;
 h.client.playbackInfo=async()=>{negotiations++;return info();};
 try{
  await h.player.start(selection);const before=h.player.state.position;
  const late={mode:'showing'};tracks.items.push(late);tracks.dispatchEvent(new Event('addtrack'));
  assert.equal(late.mode,'disabled');assert.equal(negotiations,1);assert.equal(h.player.state.position,before);
  late.mode='showing';tracks.dispatchEvent(new Event('change'));assert.equal(late.mode,'disabled');
  await h.player.destroy();late.mode='showing';tracks.dispatchEvent(new Event('change'));assert.equal(late.mode,'showing');
 }finally{await h.player.destroy();}
});


test('startup without video metadata fails within a bounded deadline and releases its grant',async()=>{
 const h=harness({support:{...support,mseHls:true,canDirect:async()=>false},startupTimeoutMs:15});h.video.readyState=0;
 try{await h.player.start(selection);await new Promise(resolve=>setTimeout(resolve,50));assert.equal(h.player.state.phase,'failed');assert.match(h.player.state.error,/did not become ready/);if(DIAGNOSTICS_ENABLED)assert.ok(h.player.state.diagnostics.some(e=>e.stage==='media-error'&&e.facts.reason==='timeout'));else assert.equal(h.player.state.diagnostics,undefined);assert.ok(h.grants.every(g=>g.closed));}finally{await h.player.destroy();}
});

test('progressive transcode media errors are handled rather than buffering forever',async()=>{
 const h=harness({support:{...support,progressiveWebm:true,canDirect:async()=>false}});
 h.client.playbackInfo=async()=>parsePlaybackInfo({PlaySessionId:'progressive',MediaSources:[{...source,SupportsDirectPlay:false,SupportsDirectStream:false,TranscodingUrl:'/Videos/item/stream.webm?VideoCodec=vp8&AudioCodec=vorbis',TranscodingSubProtocol:'http',TranscodingContainer:'webm'}]});
 try{await h.player.start(selection);assert.equal(h.player.state.plan.mode,'transcode');h.video.error={code:3};h.video.dispatchEvent(new Event('error'));await settle();assert.equal(h.player.state.phase,'failed');assert.ok(h.grants.every(g=>g.closed));}finally{await h.player.destroy();}
});


test('a stall after metadata is bounded; pausing cancels the stall deadline',async()=>{
 const h=harness({support:{...support,mseHls:true,canDirect:async()=>false},startupTimeoutMs:15});
 try{await h.player.start(selection);h.video.dispatchEvent(new Event('waiting'));h.player.pause();await new Promise(resolve=>setTimeout(resolve,25));assert.equal(h.player.state.phase,'paused');h.video.dispatchEvent(new Event('waiting'));await new Promise(resolve=>setTimeout(resolve,35));assert.equal(h.player.state.phase,'failed');}finally{await h.player.destroy();}
});


test('subtitle retiming updates paused text immediately, preserves seek position and never renegotiates',async()=>{
 const h=harness();let requests=0;h.client.playbackInfo=async()=>{requests++;return info();};
 try{
  await h.player.start(selection);h.player.pause();
  // Stand-in for a loaded browser-owned external VTT track. No network/DOM needed.
  h.player.state.plan.subtitle='/Videos/item/source/Subtitles/3/Stream.vtt';
  h.player.state.plan.subtitleIndex=3;
  h.player.track={track:{cues:[{startTime:10,endTime:12,text:'In sync'}],activeCues:[]},remove(){}};
  h.video.currentTime=12;const position=h.video.currentTime;
  h.player.subtitleDelay(2);assert.deepEqual(h.player.state.captions,['In sync']);assert.equal(h.video.currentTime,position);assert.equal(requests,1);assert.equal(h.player.state.subtitleDelay,2);
  h.player.subtitleDelay(0);assert.deepEqual(h.player.state.captions,[]);assert.equal(requests,1);
  h.player.subtitleDelay(-2);h.video.currentTime=8;h.video.dispatchEvent(new Event('seeked'));assert.deepEqual(h.player.state.captions,['In sync']);assert.equal(requests,1);
  h.player.state.plan.subtitle=undefined;h.player.subtitleDelay(8);assert.equal(h.player.state.subtitleDelay,-2);
 }finally{await h.player.destroy();}
});


test('decoded resolution follows media resize; capped switching keeps pause, position and profile bounds',async()=>{
 const h=harness({support:{...support,mseHls:true}});const bodies=[];h.client.playbackInfo=async(_user,_item,body)=>{bodies.push(body);return info();};
 try{h.video.videoWidth=1920;h.video.videoHeight=800;await h.player.start(selection);assert.equal(h.player.state.videoWidth,1920);assert.equal(h.player.state.videoHeight,800);
 h.video.videoWidth=1280;h.video.videoHeight=532;h.video.dispatchEvent(new Event('resize'));assert.equal(h.player.state.videoWidth,1280);assert.equal(h.player.state.videoHeight,532);
 h.player.pause();const ticks=Math.round(h.video.currentTime*10000000);await h.player.change({maxHeight:720,forceTranscode:false});assert.equal(h.player.state.paused,true);assert.equal(h.player.state.plan.selection.startTicks,ticks);assert.equal(h.player.state.plan.selection.maxHeight,720);assert.equal(h.player.state.plan.mode,'transcode');
 assert.equal(bodies.at(-1).AllowVideoStreamCopy,false);assert.ok(bodies.at(-1).DeviceProfile.TranscodingProfiles[0].Conditions.some(c=>c.Property==='Height'&&c.Value==='720'));
 }finally{await h.player.destroy();}
});

test('native fullscreen mirrors selected captions and returns to a single Frame renderer without renegotiating',async()=>{
 const previous=globalThis.VTTCue;globalThis.VTTCue=class{constructor(startTime,endTime,text){Object.assign(this,{startTime,endTime,text});}};
 const h=harness();let requests=0;h.client.playbackInfo=async()=>{requests++;return info();};
 h.video.addTextTrack=()=>{const mirror={mode:'disabled',cues:[],addCue(cue){this.cues.push(cue);},removeCue(cue){this.cues.splice(this.cues.indexOf(cue),1);}};h.video.textTracks.push(mirror);return mirror;};
 try{
  await h.player.start(selection);h.player.pause();h.player.state.plan.offset=8;
  const owned={mode:'hidden',cues:[{startTime:10,endTime:12,text:'Caption'}],activeCues:[]};const other={mode:'showing'};h.video.textTracks.push(owned,other);
  h.player.track={track:owned,srclang:'en',remove(){}};
  h.video.dispatchEvent(new Event('webkitbeginfullscreen'));const mirror=h.player.nativeCaptionTrack;
  assert.equal(mirror.mode,'showing');assert.equal(owned.mode,'hidden');assert.equal(other.mode,'disabled');assert.equal(mirror.cues[0].startTime,2);
  h.player.state.plan.subtitle='/test.vtt';h.player.subtitleDelay(2);assert.equal(mirror.cues[0].startTime,4);assert.equal(owned.cues[0].startTime,10);assert.equal(requests,1);
  h.video.dispatchEvent(new Event('webkitendfullscreen'));assert.equal(mirror.mode,'disabled');assert.equal(mirror.cues.length,0);assert.equal(owned.mode,'hidden');
  await h.player.destroy();h.video.dispatchEvent(new Event('webkitbeginfullscreen'));assert.equal(mirror.mode,'disabled');
 }finally{await h.player.destroy();if(previous===undefined)delete globalThis.VTTCue;else globalThis.VTTCue=previous;}
});


test('actual runtime saves a five-second short start and clears it only after completion',async()=>{
 const id='five-second-runtime';const h=harness({itemId:id});
 try{
  await h.player.start({...selection,startTicks:0});
  assert.equal(readEarlyProgress(session).some(row=>row.id===id),false);
  h.video.currentTime=5;h.video.dispatchEvent(new Event('timeupdate'));h.video.pause();await settle();
  assert.equal(readEarlyProgress(session).find(row=>row.id===id)?.position,5);
  h.video.currentTime=30;h.video.ended=true;h.video.dispatchEvent(new Event('ended'));await settle();
  assert.equal(readEarlyProgress(session).some(row=>row.id===id),false);
 }finally{await h.player.destroy();}
});

test('leaving after five seconds flushes the local position even before a timeupdate event',async()=>{
 const id='short-start-on-exit';const h=harness({itemId:id});
 await h.player.start({...selection,startTicks:0});h.video.currentTime=5;await h.player.destroy();
 assert.equal(readEarlyProgress(session).find(row=>row.id===id)?.position,5);
 assert.equal(h.reports.filter(row=>row.kind==='stopped').length,1);
});
