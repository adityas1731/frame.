import {test} from 'node:test';import assert from 'node:assert/strict';
import {JellyfinClient,parseItem,JellyfinError} from '../src/jellyfin/client.ts';
import {libraryNavigation,activeLibrary} from '../src/app/libraryNavigation.ts';
import {audioPlan,audioProfile} from '../src/music/protocol.ts';
import {MusicController} from '../src/music/controller.ts';
import {emptyQueue,nextEntry,shuffleQueue,insertQueue,moveQueue,removeQueue} from '../src/music/queue.ts';
import {musicTitle,musicArtist,collectMusic,musicDestination} from '../src/music/presentation.ts';
import {MediaFocus,mediaFocus} from '../src/playback/mediaFocus.ts';
import {PlaybackRuntime} from '../src/playback/runtime.ts';
import {cleanMediaUrl,gatewayPath,mediaPathAllowed} from '../public/frame-stream-policy.js';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const song=(id='one',extra={})=>({Id:id,Name:id,Type:'Audio',RunTimeTicks:300000000,...extra});
const source={Id:'audio-source',Container:'mp3',RunTimeTicks:300000000,SupportsDirectPlay:true,SupportsTranscoding:true,MediaStreams:[{Type:'Audio',Index:0,Codec:'mp3',Channels:2}]};
const info=(id='session',extra={})=>({PlaySessionId:id,MediaSources:[{...source,...extra}]});
const session={baseUrl:'https://music-fixture.invalid',token:'private-credential',user:{Id:'user'},server:{Id:'fixture',Version:'12.3.0'},deviceId:'test-device',created:1};
class AudioElement extends EventTarget {
 currentTime=0;duration=30;paused=true;ended=false;readyState=0;volume=.7;muted=false;src='';preload='';
 canPlayType(mime){return /mpeg|mp4/.test(mime)?'probably':'';}
 play(){this.paused=false;this.emit('playing');return Promise.resolve();}
 pause(){if(!this.paused){this.paused=true;this.emit('pause');}}
 removeAttribute(){this.src='';}
 load(){this.currentTime=0;this.ended=false;this.readyState=this.src?1:0;if(this.src)queueMicrotask(()=>{if(this.src)this.emit('loadedmetadata');});}
 emit(name){this.dispatchEvent(new Event(name));}
}
function harness(options={}){
 const audio=new AudioElement(),reports=[],encodings=[],requests=[],grants=[],cleanup=new Set();let time=1000,serial=0;
 const client={beforeLogout:task=>{cleanup.add(task);return()=>cleanup.delete(task);},playbackInfo:async(_user,id,body,signal)=>{requests.push({id,body,signal});return options.info?options.info(id,body,signal):info('session-'+(++serial));},reportPlayback:async(kind,report,keepalive)=>{reports.push({kind,...report,keepalive});await options.report?.(kind,report);},stopEncoding:async id=>encodings.push(id)};
 const controller=new MusicController(client,session,{audio:()=>audio,focus:options.focus??new MediaFocus(),now:()=>time,random:()=>0,timeout:options.timeout??10000,gateway:async(_session,id,signal)=>{const grant={id,closed:0,url:raw=>'https://page.invalid/'+raw,close(){this.closed++;}};grants.push(grant);return grant;}});controller.mount();
 return {audio,client,controller,reports,encodings,requests,grants,cleanup,advance:ms=>time+=ms};
}

test('music discovery uses accessible views, preserves custom names and empty libraries',()=>{
 const links=libraryNavigation([{Id:'a',Name:'Records',CollectionType:'music',ChildCount:0},{Id:'b',Name:'Jazz',CollectionType:'music'},{Id:'m',Name:'Cinema',CollectionType:'movies'}]);
 assert.deepEqual(links.map(l=>[l.title,l.to]),[['Records','/music?library=a'],['Jazz','/music?library=b'],['Cinema','/movies?library=m']]);
 assert.equal(activeLibrary('a','music','/music/artist/person','?library=a'),true);assert.equal(activeLibrary('b','music','/music','?library=a'),false);
 assert.deepEqual(libraryNavigation([]),[]);assert.equal(libraryNavigation([{Id:'m',CollectionType:'movies'}]).some(l=>l.mode==='music'),false);
});
test('audio DTOs retain validated music metadata without requiring artist or album fields',()=>{
 const bare=parseItem(song('standalone'));assert.equal(bare.Type,'Audio');assert.equal(musicTitle(bare),'standalone');assert.equal(musicArtist(bare),'Unknown artist');assert.equal(bare.Album,undefined);
 const item=parseItem({...song(),Album:'Record',AlbumId:'album',AlbumPrimaryImageTag:'image',Artists:['Artist',null],ArtistItems:[{Id:'artist',Name:'Artist'},{}],AlbumArtists:[{Id:'a',Name:'Album Artist'}],PlaylistItemId:'entry'});
 assert.equal(item.Album,'Record');assert.deepEqual(item.Artists,['Artist']);assert.deepEqual(item.ArtistItems,[{Id:'artist',Name:'Artist'}]);assert.equal(item.PlaylistItemId,'entry');
 assert.equal(musicTitle(song('x',{Name:' '})),'Untitled track');assert.equal(musicArtist(song('x',{AlbumArtists:[{Id:'a',Name:'Album Artist'}]})),'Album Artist');
});
test('music requests scope user/library, use the artist endpoint with audio item counts and preserve playlist order',async()=>{
 const calls=[];const client=new JellyfinClient(session.baseUrl,'device',async(url,init)=>{calls.push({url:new URL(url),init});return new Response(JSON.stringify({Items:[song()],TotalRecordCount:1}),{status:200});});client.restore(session);
 try{await client.musicItems('user',{kind:'Audio',parentId:'records',search:'bare mp3',start:40,sort:'DateCreated'});await client.musicItems('user',{kind:'MusicArtist',parentId:'records'});await client.musicItems('user',{kind:'MusicAlbum',artistId:'artist',parentId:'records'});await client.playlistTracks('user','playlist',100);
  assert.equal(calls[0].url.searchParams.get('includeItemTypes'),'Audio');assert.equal(calls[0].url.searchParams.get('parentId'),'records');assert.equal(calls[0].url.searchParams.get('searchTerm'),'bare mp3');assert.equal(calls[0].url.searchParams.get('startIndex'),'40');assert.equal(calls[0].url.searchParams.get('sortOrder'),'Descending');
  assert.equal(calls[1].url.pathname,'/Artists');assert.equal(calls[1].url.searchParams.get('includeItemTypes'),'Audio,MusicAlbum');assert.equal(calls[2].url.searchParams.get('artistIds'),'artist');
  assert.equal(calls[3].url.pathname,'/Playlists/playlist/Items');assert.equal(calls[3].url.searchParams.get('startIndex'),'100');assert.equal(calls[3].url.searchParams.has('sortBy'),false);
  for(const call of calls){assert.equal(call.url.searchParams.get('userId'),'user');assert.ok(!call.url.href.includes(session.token));assert.match(call.init.headers.Authorization,/Token=/);}
 }finally{client.dispose();}
});
test('album and playlist collection loading spans pages and keeps duplicate playlist occurrences',async()=>{
 const starts=[];const rows=[song('a'),song('a'),{Id:'not-audio',Type:'Movie'},song('b')];
 const tracks=await collectMusic(async start=>{starts.push(start);return {Items:rows.slice(start,start+2),TotalRecordCount:4};});assert.deepEqual(starts,[0,2]);assert.deepEqual(tracks.map(t=>t.Id),['a','a','b']);
 await assert.rejects(collectMusic(async()=>({Items:[],TotalRecordCount:5})),/changed/);
 await assert.rejects(collectMusic(async()=>({Items:rows,TotalRecordCount:10}),2),/smaller/);
 assert.equal(musicDestination({Id:'album',Type:'MusicAlbum'},'lib & x'),'/music/album/album?library=lib%20%26%20x');
});
test('audio negotiation uses direct MP3 or permission-respecting progressive MP3 transcoding',()=>{
 const canPlay=mime=>mime==='audio/mpeg'?'probably':'';const direct=audioPlan('one',info(),canPlay,'device');assert.equal(direct.transcoded,false);assert.match(direct.url,/Audio\/one\/stream.mp3\?static=true/);assert.ok(!direct.url.includes(session.token));
 const transcode=audioPlan('one',info('second',{Container:'flac'}),canPlay,'device',false,9);assert.equal(transcode.transcoded,true);assert.equal(transcode.offset,9);assert.match(transcode.url,/startTimeTicks=90000000/);assert.match(transcode.url,/audioCodec=mp3/);
 assert.throws(()=>audioPlan('one',info('x',{Container:'flac',SupportsTranscoding:false}),canPlay,'device'),/compatible/);
 assert.throws(()=>audioPlan('one',info('x',{RequiresOpening:true}),canPlay,'device'),/compatible/);
 assert.ok(audioProfile(canPlay).DirectPlayProfiles.every(profile=>profile.Type==='Audio'));assert.equal(audioProfile(canPlay,true).DirectPlayProfiles.length,0);
});
test('audio gateway remains item scoped, strips credentials and respects server BaseUrl',()=>{
 const item='12345678901234567890123456789012';const url=cleanMediaUrl(`/Audio/${item}/stream.mp3?api_key=secret&static=true`,'https://server.invalid/jellyfin',item);
 assert.equal(url,`Audio/${item}/stream.mp3?static=true`);assert.match(gatewayPath('a-nonce',url,'/Frame/Web/'),/stream.mp3$/);
 for(const bad of [`Audio/other/stream.mp3`,`Audio/${item}/file.mp3`,`Audio/${item}/../stream.mp3`,`Audio/${item}/master.m3u8`,`Items/${item}/stream.mp3`])assert.equal(mediaPathAllowed(bad,item),false);
 assert.throws(()=>cleanMediaUrl(`https://outside.invalid/Audio/${item}/stream.mp3`,'https://server.invalid',item));
});
test('queue operations preserve occurrences, explicit play-next, shuffle identity and repeat modes',()=>{
 let q={...emptyQueue(),entries:[1,2,3,4].map(key=>({key,item:song(String(key))})),base:[1,2,3,4],current:1};q=insertQueue(q,[{key:5,item:song('1')}],true);assert.deepEqual(q.entries.map(e=>e.key),[1,5,2,3,4]);
 const shuffled=shuffleQueue(q,true,()=>0);assert.equal(shuffled.current,1);assert.deepEqual(new Set(shuffled.entries.map(e=>e.key)),new Set([1,2,3,4,5]));assert.deepEqual(shuffleQueue(shuffled,false).entries.map(e=>e.key),[1,5,2,3,4]);
 assert.equal(nextEntry({...q,repeat:'one'},true).key,1);assert.equal(nextEntry({...q,repeat:'one'},false).key,5);assert.equal(nextEntry({...q,current:4,repeat:'off'}),undefined);assert.equal(nextEntry({...q,current:4,repeat:'all'}).key,1);
 assert.deepEqual(moveQueue(q,5,1).entries.map(e=>e.key),[1,2,5,3,4]);assert.equal(removeQueue(q,1).current,undefined);
});
test('single-track playback reports started, pause/resume/seek progress and exactly one stopped event',async()=>{
 const h=harness();try{await h.controller.play([song()]);await settle();assert.equal(h.controller.snapshot().phase,'playing');assert.equal(h.controller.snapshot().duration,30);
  h.audio.currentTime=7;h.advance(11000);h.audio.emit('timeupdate');h.controller.pause();await settle();assert.equal(h.controller.snapshot().phase,'paused');assert.equal(h.controller.snapshot().position,7);await h.controller.resume();h.controller.seek(12);h.controller.volume(.25);h.controller.mute();await h.controller.stop();await h.controller.stop();
  assert.equal(h.reports.filter(r=>r.kind==='started').length,1);assert.equal(h.reports.filter(r=>r.kind==='stopped').length,1);assert.equal(h.reports.at(-1).PositionTicks,120000000);assert.ok(h.reports.some(r=>r.kind==='progress'));assert.equal(h.grants[0].closed,1);
 }finally{await h.controller.dispose();}
});
test('natural end advances queue and repeat-one restarts with a fresh session; manual next still advances',async()=>{
 const h=harness();try{await h.controller.play([song('one'),song('two')]);h.audio.currentTime=30;h.audio.ended=true;h.audio.emit('ended');await settle();assert.equal(h.controller.snapshot().entries.find(e=>e.key===h.controller.snapshot().current).item.Id,'two');
  h.controller.repeat();h.controller.repeat();const previous=h.requests.length;h.audio.currentTime=30;h.audio.ended=true;h.audio.emit('ended');await settle();assert.equal(h.requests.length,previous+1);assert.equal(h.requests.at(-1).id,'two');
  h.controller.repeat();h.controller.repeat();await h.controller.next();await settle();assert.equal(h.requests.at(-1).id,'one');
 }finally{await h.controller.dispose();}
});
test('queue additions and reordering do not restart the current audio stream',async()=>{
 const h=harness();try{await h.controller.play([song('one')]);h.controller.enqueue([song('two')]);h.controller.enqueue([song('next')],true);assert.equal(h.requests.length,1);assert.deepEqual(h.controller.snapshot().entries.map(e=>e.item.Id),['one','next','two']);
  h.controller.shuffle();assert.equal(h.requests.length,1);h.controller.shuffle();const key=h.controller.snapshot().entries[1].key;h.controller.move(key,1);assert.deepEqual(h.controller.snapshot().entries.map(e=>e.item.Id),['one','two','next']);await h.controller.next();assert.equal(h.requests.at(-1).id,'two');
 }finally{await h.controller.dispose();}
});
test('slow collection lookup cannot replace a newer single-track playback intent',async()=>{
 const h=harness(),pending=deferred();try{const slow=h.controller.playCollection(()=>pending.promise);await h.controller.play([song('new')]);pending.resolve([song('old')]);await slow;assert.equal(h.requests.length,1);assert.equal(h.requests[0].id,'new');}finally{await h.controller.dispose();}
});
test('superseded audio negotiation cannot create a stream or reports for an old track',async()=>{
 const pending=deferred();const h=harness({info:id=>id==='old'?pending.promise:info('new')});try{const old=h.controller.play([song('old')]);await h.controller.play([song('new')]);pending.resolve(info('old'));await old;await settle();assert.equal(h.grants.length,1);assert.equal(h.grants[0].id,'new');assert.ok(h.reports.every(r=>r.ItemId==='new'));assert.ok(h.encodings.includes('old'));}finally{await h.controller.dispose();}
});
test('one bounded direct-play failure retries as MP3 transcode and transcoded seeking keeps total position',async()=>{
 const h=harness();try{await h.controller.play([song()]);h.audio.currentTime=8;h.audio.emit('error');await settle();assert.equal(h.requests.length,2);assert.equal(h.requests[1].body.EnableDirectPlay,false);assert.equal(h.controller.snapshot().position,8);assert.match(h.audio.src,/static=false/);
  h.controller.seek(15);await settle();assert.equal(h.requests.length,3);assert.equal(h.controller.snapshot().position,15);h.audio.emit('error');assert.equal(h.controller.snapshot().phase,'failed');await settle();assert.equal(h.requests.length,3);assert.ok(h.encodings.length>=2);
 }finally{await h.controller.dispose();}
});
for(const status of [401,403,404])test(`audio HTTP ${status} becomes a clear failure without playback history`,async()=>{
 const h=harness({info:async()=>{throw new JellyfinError(status,status===404?'Audio not found.':'Sign in or check audio playback permissions.');}});try{await h.controller.play([song()]);assert.equal(h.controller.snapshot().phase,'failed');assert.match(h.controller.snapshot().error,status===404?/not found/:/Sign in/);assert.equal(h.reports.length,0);assert.equal(h.grants.length,0);}finally{await h.controller.dispose();}
});
test('music yields to another media owner and cannot restart itself on a late playing event',async()=>{
 const focus=new MediaFocus(),h=harness({focus}),video={};try{await h.controller.play([song()]);focus.claim(video,()=>{});assert.equal(h.controller.snapshot().phase,'paused');assert.equal(h.audio.paused,true);h.audio.play();assert.equal(h.audio.paused,true);assert.equal(focus.owns(video),true);}finally{await h.controller.dispose();}
});
test('previous restarts a progressed track, removal advances, and background ownership requires no route state',async()=>{
 const h=harness();try{await h.controller.play([song('one'),song('two')]);h.audio.currentTime=8;h.audio.emit('timeupdate');await h.controller.previous();assert.equal(h.audio.currentTime,0);assert.equal(h.requests.length,1);
  // Browsing/route changes make no controller calls; its element and queue stay alive.
  const before=h.controller.snapshot();await settle();assert.equal(h.controller.snapshot(),before);assert.equal(h.audio.paused,false);
  h.controller.remove(before.current);await settle();assert.equal(h.requests.at(-1).id,'two');assert.equal(h.controller.snapshot().entries.length,1);
 }finally{await h.controller.dispose();}
});
test('reports coalesce during slow writes and progress never follows its stopped event',async()=>{
 const blocked=deferred();let hold=false;const h=harness({report:kind=>hold&&kind==='progress'?blocked.promise:undefined});try{await h.controller.play([song()]);await settle();hold=true;h.advance(11000);h.audio.emit('timeupdate');await settle();for(let n=0;n<15;n++){h.controller.pause();void h.controller.resume();}await h.controller.play([song('two')]);blocked.resolve();await settle();await h.controller.stop();const first=h.reports.filter(r=>r.ItemId==='one');assert.equal(first.filter(r=>r.kind==='stopped').length,1);assert.equal(first.at(-1).kind,'stopped');assert.ok(first.filter(r=>r.kind==='progress').length<=2);}finally{blocked.resolve();await h.controller.dispose();}
});
test('strict lifecycle cleanup removes pending media and supports the development remount',async()=>{
 const h=harness();await h.controller.dispose();assert.equal(h.cleanup.size,0);h.controller.mount();try{await h.controller.play([song()]);assert.equal(h.controller.snapshot().phase,'playing');assert.equal(h.cleanup.size,1);}finally{await h.controller.dispose();assert.equal(h.cleanup.size,0);}
});
test('stalled audio reaches a bounded retryable error without polling',async()=>{
 const h=harness({timeout:5,info:()=>new Promise(()=>{})});try{void h.controller.play([song()]);await new Promise(resolve=>setTimeout(resolve,20));assert.equal(h.controller.snapshot().phase,'failed');assert.match(h.controller.snapshot().error,/too long/);assert.equal(h.requests.length,1);}finally{await h.controller.dispose();}
});
test('real video runtime and music controller arbitrate playback in both directions',async()=>{
 const h=harness({focus:mediaFocus});class Video extends AudioElement{readyState=1;textTracks=[];load(){}}
 const video=new Video();const videoSource={...source,Id:'video',Container:'mp4',MediaStreams:[{Index:0,Type:'Video',Codec:'h264'},{Index:1,Type:'Audio',Codec:'aac'}]};
 const videoClient={...h.client,invalidate(){},playbackInfo:async()=>({PlaySessionId:'video-session',MediaSources:[videoSource]})};
 const runtime=new PlaybackRuntime(videoClient,session,'video-item',video,{updated(){},support:{nativeHls:false,mseHls:false,video:['h264'],audio:['aac'],containers:['mp4'],canDirect:async()=>true},gateway:async()=>({url:raw=>raw,close(){}})});
 try{await h.controller.play([song()]);await runtime.start({startTicks:0,maxBitrate:40000000});await settle();assert.equal(h.audio.paused,true);assert.equal(video.paused,false);await h.controller.resume();assert.equal(video.paused,true);assert.equal(h.audio.paused,false);await runtime.play();assert.equal(h.audio.paused,true);assert.equal(video.paused,false);}finally{await runtime.destroy();await h.controller.dispose();}
});


test('container support alone cannot direct-play an unsupported audio codec',()=>{
 const canPlay=mime=>mime==='audio/mp4'||mime==='audio/mpeg'?'probably':'';
 const unsupported=info('codec',{Container:'mp4',MediaStreams:[{Type:'Audio',Index:0,Codec:'alac'}]});
 assert.equal(audioPlan('one',unsupported,canPlay,'device').transcoded,true);
 assert.throws(()=>audioPlan('one',{...unsupported,MediaSources:unsupported.MediaSources.map(s=>({...s,SupportsTranscoding:false}))},canPlay,'device'),/compatible/);
});

test('seeking an ended queue item reopens paused and preserves the requested position',async()=>{
 const h=harness();try{await h.controller.play([song()]);await settle();h.audio.currentTime=30;h.audio.ended=true;h.audio.emit('ended');await settle();assert.equal(h.controller.snapshot().phase,'ended');
  h.controller.seek(9);await settle();assert.equal(h.controller.snapshot().phase,'paused');assert.equal(h.audio.currentTime,9);assert.equal(h.requests.length,2);await h.controller.resume();assert.equal(h.controller.snapshot().phase,'playing');
 }finally{await h.controller.dispose();}
});

test('queue capacity rejection leaves current playback intact and gives a notice',async()=>{
 const h=harness();try{await h.controller.play([song()]);assert.equal(h.controller.enqueue(Array.from({length:5000},()=>song('extra'))),false);assert.equal(h.controller.snapshot().entries.length,1);assert.match(h.controller.snapshot().notice,/5000/);assert.equal(h.requests.length,1);}finally{await h.controller.dispose();}
});

test('unavailable native audio construction becomes a recoverable failure',async()=>{
 const client={beforeLogout:()=>()=>{}};const controller=new MusicController(client,session,{audio:()=>{throw Error('Audio is unavailable.');},focus:new MediaFocus()});controller.mount();
 try{await controller.play([song()]);assert.equal(controller.snapshot().phase,'failed');assert.equal(controller.snapshot().error,'Audio is unavailable.');}finally{await controller.dispose();}
});


test('paused audio retains system control ownership but late playing cannot override pause',async()=>{
 const focus=new MediaFocus(),h=harness({focus}),owners=[];const unsubscribe=focus.subscribe(()=>owners.push(focus.snapshot()));
 try{await h.controller.play([song()]);h.controller.pause();assert.equal(focus.owns(h.controller),true);h.audio.play();assert.equal(h.audio.paused,true);await h.controller.resume();assert.equal(h.audio.paused,false);const video={};focus.claim(video,()=>{});assert.equal(h.audio.paused,true);assert.equal(owners.at(-1),video);await h.controller.stop();assert.equal(focus.owns(video),true);focus.release(video);assert.equal(owners.at(-1),undefined);}finally{unsubscribe();await h.controller.dispose();}
});


test('an audio item with an embedded cover stream still negotiates its audio endpoint',()=>{
 const cover=info('cover',{MediaStreams:[...source.MediaStreams,{Type:'Video',Index:1,Codec:'mjpeg'}]});
 const plan=audioPlan('one',cover,()=> 'probably','device');assert.equal(plan.transcoded,false);assert.match(plan.url,/^Audio\/one\/stream.mp3/);
});
