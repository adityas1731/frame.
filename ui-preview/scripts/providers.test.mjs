import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FreeMetadataClient,plainSummary} from '../src/providers/free.ts';
import {mergeMetadata,episodeLabel,episodeTitle} from '../src/providers/metadata.ts';
import {episodeScheduleCompatible} from '../src/providers/episodeIdentity.ts';
import {episodeArtworkSource,episodeArtworkCandidates} from '../src/components/episodeArtworkPolicy.ts';
import {JellyfinClient} from '../src/jellyfin/client.ts';
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});
const series={Id:'private-jellyfin-id',Type:'Series',ProviderIds:{Tvmaze:'123',Imdb:'tt1234567',Tvdb:'77'}};
const show={id:123,name:'Original test show',summary:'<p>A fictional &amp; safe synopsis.</p>',rating:{average:8.4},externals:{imdb:'tt1234567',thetvdb:77},_embedded:{cast:[{person:{name:'Avery Vale',image:{original:'https://static.tvmaze.com/uploads/images/original_untouched/1/1.jpg'}},character:{name:'Explorer'}}]}};
function setup(respond=()=>json(show),now=Date.now){const calls=[];const server={remoteBackdrop:async()=>null,invalidateRemoteImages(){}};const client=new FreeMetadataClient(server,async(url,init)=>{calls.push({url,init});return respond(url,init);},u=>u,now);return{client,calls,server};}
test('free TV reads require no key and never send Jellyfin credentials, IDs or title searches',async()=>{
 const {client,calls}=setup();const result=await client.enrich(series);assert.equal(result.name,show.name);assert.equal(result.cast[0].name,'Avery Vale');assert.equal(result.overview,'A fictional & safe synopsis.');
 assert.ok(calls.every(c=>new URL(c.url).origin==='https://api.tvmaze.com'&&c.init.method==='GET'&&c.init.credentials==='omit'&&!c.init.headers.Authorization&&!c.url.includes(series.Id)&&!c.url.includes('/search')));client.dispose();
});
test('exact IMDb lookup cross-checks returned IMDb and TVDB IDs',async()=>{
 const {client,calls}=setup();assert.equal((await client.enrich({...series,ProviderIds:{Imdb:'tt1234567',Tvdb:'77'}})).id,123);assert.ok(calls[0].url.endsWith('lookup/shows?imdb=tt1234567'));client.dispose();
 const conflict=setup(()=>json({...show,externals:{imdb:'tt7654321'}}));await assert.rejects(conflict.client.enrich(series),/conflict/);conflict.client.dispose();
});
test('missing and malformed IDs fail closed; movies never query TVmaze',async()=>{const {client,calls}=setup();assert.equal(await client.enrich({...series,ProviderIds:{}}),null);assert.equal(await client.enrich({...series,Type:'Movie'}),null);await assert.rejects(client.enrich({...series,ProviderIds:{Tvmaze:'../123'}}),/review/);assert.equal(calls.length,0);client.dispose();});
test('episodes require their own TVmaze ID; series ID and numbers cannot guess an episode',async()=>{
 const {client,calls}=setup(()=>json({...show,id:456,_embedded:{guestcast:[]}}));const episode={Id:'e',Type:'Episode',ParentIndexNumber:0,IndexNumber:1,ProviderIds:{Tmdb:'456'}};
 assert.equal(await client.enrich(episode,series),null);assert.equal(calls.length,0);
 const value=await client.enrich({...episode,ProviderIds:{Tvmaze:'456'}});assert.equal(value.kind,'episode');assert.match(calls[0].url,/episodes\/456\?embed=guestcast/);client.dispose();
});
test('display merge preserves server values including zero and leaves DTO immutable',()=>{const item={...series,CommunityRating:0,Overview:'Server description',People:[{Name:'Server actor',Type:'Actor'}]};const original=structuredClone(item);const merged=mergeMetadata(item,{id:123,kind:'tv',cast:[{name:'Provider actor'}],rating:9,overview:'Other',source:''});assert.equal(merged.item.CommunityRating,0);assert.equal(merged.item.Overview,item.Overview);assert.deepEqual(item,original);assert.deepEqual(merged.item.People,item.People);});
test('numbering supports specials and filename-like names stay hidden',()=>{assert.equal(episodeLabel({ParentIndexNumber:0,IndexNumber:1}),'Season 0 · Episode 1');assert.equal(episodeTitle({Name:'show.s01e01'}),undefined);assert.equal(episodeTitle({Name:'A proper chapter'}),'A proper chapter');assert.equal(plainSummary('<b>Text</b> &amp; more'),'Text & more');});
test('successes and failures deduplicate; clear and dispose work',async()=>{
 const {client,calls}=setup();await Promise.all([client.enrich(series),client.enrich(series)]);assert.equal(calls.length,1);client.clearCache();await client.enrich(series);assert.equal(calls.length,2);client.dispose();await assert.rejects(client.enrich(series),/disabled/);
 const bad=setup(()=>json({},503));await assert.rejects(bad.client.enrich(series));await assert.rejects(bad.client.enrich(series));assert.equal(bad.calls.length,1);bad.client.dispose();
});
test('rate limiting prevents repeated requests across different items',async()=>{const {client,calls}=setup(()=>json({},429,{'Retry-After':'120'}));await assert.rejects(client.enrich(series));await assert.rejects(client.enrich({...series,Id:'other',ProviderIds:{Tvmaze:'124'}}));assert.equal(calls.length,1);client.dispose();});
test('provider reads cap concurrency at three',async()=>{let active=0,max=0;const {client}=setup(async(url,init)=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,10));active--;return json({...show,id:Number(new URL(url).pathname.split('/').at(-1)),externals:{}});});await Promise.all(Array.from({length:9},(_,i)=>client.enrich({...series,Id:String(i),ProviderIds:{Tvmaze:String(i+1)}})));assert.equal(max,3);client.dispose();});
const art={ProviderName:'TheMovieDb',Type:'Backdrop',Width:3840,Height:2160,Url:'https://image.tmdb.org/t/p/original/wide.jpg'};
function artwork(images=[art],status=200){const calls=[];const client=new JellyfinClient('https://jellyfin.invalid','device',async(url,init)=>{calls.push({url,init});return json({Images:images},status);});return{client,calls};}
test('HD artwork uses only the read-only Jellyfin catalogue and caches it',async()=>{const {client,calls}=artwork();const movie={Id:'movie',Type:'Movie',ProviderIds:{Tmdb:'123'}};const image=await client.remoteBackdrop(movie);assert.equal(image.width,3840);await client.remoteBackdrop(movie);assert.equal(calls.length,1);assert.match(calls[0].url,/RemoteImages\?/);assert.equal(new URL(calls[0].url).searchParams.get('providerName'),'TheMovieDb');assert.equal(calls[0].init.method,'GET');assert.ok(!calls[0].url.includes('/Download'));client.dispose();});
test('artwork rejects arbitrary hosts, credentials, query strings, portrait/SD and other providers',async()=>{
 for(const bad of [{Url:'https://evil.invalid/x.jpg'},{Url:'https://user@image.tmdb.org/t/p/original/a.jpg'},{Url:art.Url+'?token=x'},{Width:800,Height:450},{Width:2000,Height:3000},{ProviderName:'Other'}]){const {client}=artwork([{...art,...bad}]);assert.equal(await client.remoteBackdrop({Id:'x',Type:'Movie',ProviderIds:{Tmdb:'123'}}),null);client.dispose();}
 const {client,calls}=artwork();assert.equal(await client.remoteBackdrop({Id:'x',Type:'Movie'}),null);assert.equal(await client.remoteBackdrop({Id:'x',Type:'Episode',ProviderIds:{Tmdb:'123'}}),null);assert.equal(calls.length,0);client.dispose();
});
test('unavailable provider catalogue preserves TV details; available artwork keeps separate provenance',async()=>{
 const {client,server}=setup();server.remoteBackdrop=async()=>{throw Error('403');};assert.equal((await client.enrich(series)).label,'TVmaze');client.dispose();
 const other=setup();other.server.remoteBackdrop=async()=>({url:art.Url,width:3840});const value=await other.client.enrich({...series,ProviderIds:{...series.ProviderIds,Tmdb:'55'}});assert.equal(value.label,'TVmaze');assert.equal(value.artworkLabel,'TMDB via Jellyfin');assert.equal(value.artworkSource,'https://www.themoviedb.org/tv/55');other.client.dispose();
});

test('disposing public metadata cancels an in-flight request without disposing Jellyfin',async()=>{
 let aborted=false,started;const requested=new Promise(resolve=>{started=resolve;});const {client,server}=setup((_url,init)=>new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Aborted','AbortError'));},{once:true});started();}));
 server.dispose=()=>assert.fail('Provider disposal must not dispose the Jellyfin session');
 const pending=client.enrich(series);await requested;client.dispose();await assert.rejects(pending);assert.equal(aborted,true);
});


test('person artwork requires a person TMDB ID and accepts only safe provider portraits',async()=>{
 const portrait={ProviderName:'TheMovieDb',Type:'Primary',Url:'https://image.tmdb.org/t/p/original/face.jpg'};
 const {client,calls}=artwork([portrait]);
 assert.equal(await client.remotePortrait({Id:'p',Type:'Person'}),null);
 assert.equal(await client.remotePortrait({Id:'m',Type:'Movie',ProviderIds:{Tmdb:'123'}}),null);
 assert.equal(calls.length,0);
 assert.equal((await client.remotePortrait({Id:'p',Type:'Person',ProviderIds:{Tmdb:'123'}})).url,portrait.Url);
 await client.remotePortrait({Id:'p',Type:'Person',ProviderIds:{Tmdb:'123'}});assert.equal(calls.length,1);
 assert.equal(new URL(calls[0].url).searchParams.get('type'),'Primary');assert.equal(calls[0].init.method,'GET');client.dispose();
 for(const bad of [{Url:'https://evil.invalid/face.jpg'},{Url:portrait.Url+'?token=x'},{ProviderName:'Other'},{Type:'Backdrop'}]){const fixture=artwork([{...portrait,...bad}]);assert.equal(await fixture.client.remotePortrait({Id:'p',Type:'Person',ProviderIds:{Tmdb:'1'}}),null);fixture.client.dispose();}
});
test('person lookup is scoped, deduplicated, bounded and never searches an actor name',async()=>{
 const {client,server,calls}=setup();let active=0,max=0,lookups=0,portraits=0;
 server.item=async(user,id)=>{assert.equal(user,'user');lookups++;active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return{Id:id,Type:'Person',ProviderIds:{Tmdb:'1'}};};
 server.remotePortrait=async()=>{portraits++;return{url:'https://image.tmdb.org/t/p/original/face.jpg'};};
 const result=await Promise.all(Array.from({length:9},(_,i)=>client.portrait('user',String(i))));
 assert.equal(max,3);assert.equal(lookups,9);assert.equal(portraits,9);assert.equal(result.length,9);assert.equal(calls.length,0);
 await client.portrait('user','1');assert.equal(lookups,9);
 server.item=async()=>({Id:'unexpected',Type:'Person'});assert.equal(await client.portrait('user','mismatch'),null);
 client.dispose();await assert.rejects(client.portrait('user','1'),/disabled/);
});
test('missing local cast cache tags still permit authenticated image requests',async()=>{
 const calls=[];const client=new JellyfinClient('https://jellyfin.invalid','device',async(url,init)=>{calls.push({url,init});return new Response('original fixture',{headers:{'Content-Type':'image/png'}});});
 await client.image('person','Primary','',320);await client.image('person','Primary','',320);
 assert.equal(calls.length,1);assert.match(calls[0].url,/Items\/person\/Images\/Primary/);assert.equal(calls[0].init.method,'GET');client.dispose();
});

test('missing identity, empty provider results and permission failures are bounded and do not trigger guesses',async()=>{
 const {client,server,calls}=setup();let count=0;
 server.item=async(_user,id)=>{count++;return{Id:id,Type:'Person'};};
 server.remotePortrait=async()=>assert.fail('No provider lookup without a verified ID');
 await assert.rejects(client.portrait('u','no-id'),/no verified TMDB person ID/);
 await assert.rejects(client.portrait('u','no-id'),/no verified TMDB person ID/);assert.equal(count,1);
 server.item=async(_user,id)=>({Id:id,Type:'Person',ProviderIds:{Tmdb:'1'}});
 server.remotePortrait=async()=>null;await assert.rejects(client.portrait('u','no-image'),/returned no portrait/);
 server.item=async()=>{throw Error('403');};await assert.rejects(client.portrait('u','denied'),/403/);
 assert.equal(calls.length,0);client.dispose();
});


test('numbered fallback uses verified parent identity and one cached episode list across cards',async()=>{
 const rows=[1,2].map(number=>({id:700+number,season:1,number,name:`Original episode ${number}`,summary:'<p>A safe description</p>',airdate:'2025-02-01',runtime:44,rating:{average:8.1},_links:{show:{href:'https://api.tvmaze.com/shows/123'}}}));
 const {client,calls}=setup(url=>json(url.includes('/episodes?')?rows:show));
 const episode=number=>({Id:`e${number}`,SeriesId:series.Id,Type:'Episode',Name:`Episode ${number}`,ParentIndexNumber:1,IndexNumber:number});
 const [a,b]=await Promise.all([client.enrich(episode(1),series),client.enrich(episode(2),series)]);
 assert.equal(a.name,'Original episode 1');assert.equal(b.name,'Original episode 2');assert.equal(a.overview,'A safe description');assert.equal(calls.filter(c=>c.url.includes('/episodes?')).length,1);assert.equal(calls.length,2);assert.ok(calls.every(c=>!c.url.includes('/search')));
 const merged=mergeMetadata(episode(1),a);assert.equal(merged.item.Name,a.name);assert.equal(episode(1).Name,'Episode 1');
 const preserved=mergeMetadata({...episode(1),Name:'Server supplied title'},a);assert.equal(preserved.item.Name,'Server supplied title');client.dispose();
});

test('numbered fallback rejects ambiguous numbering, wrong series, alternate order and conflicting dates',async()=>{
 const episode={Id:'e',SeriesId:series.Id,Type:'Episode',ParentIndexNumber:1,IndexNumber:1};
 for(const rows of [[],[{id:1,season:1,number:1},{id:2,season:1,number:1}],[{id:1,season:2,number:1}]]){
  const {client}=setup(url=>json(url.includes('/episodes?')?rows:show));assert.equal(await client.enrich(episode,series),null);client.dispose();
 }
 const cases=[{...episode,SeriesId:'other'},{...episode,IndexNumberEnd:2},{...episode,ParentIndexNumber:0}];
 for(const item of cases){const {client,calls}=setup();assert.equal(await client.enrich(item,series),null);assert.equal(calls.length,0);client.dispose();}
 const alternate=setup();assert.equal(await alternate.client.enrich(episode,{...series,DisplayOrder:'Dvd'}),null);assert.equal(alternate.calls.length,0);alternate.client.dispose();
 const conflict=setup(url=>json(url.includes('/episodes?')?[{id:1,season:1,number:1,airdate:'2025-02-02'}]:show));assert.equal(await conflict.client.enrich({...episode,PremiereDate:'2025-02-01'},series),null);conflict.client.dispose();
});

test('generic episode names are replaceable but real chapter names remain visible',()=>{
 for(const Name of ['Episode 1','Season 2 · Episode 3','S01E02','series.s01e01.mkv'])assert.equal(episodeTitle({Name}),undefined);
 assert.equal(episodeTitle({Name:'Episode One: The Beginning'}),'Episode One: The Beginning');
});

test('verified aired episode still enriches a filename-only item with an adjacent-day non-midnight timestamp',async()=>{
 const rows=[3,4].map(number=>({id:700+number,season:1,number,name:`Original chapter ${number}`,summary:'<p>An original episode description.</p>',airdate:'2026-10-20',airstamp:'2026-10-20T12:00:00Z',image:{original:`https://static.tvmaze.com/uploads/images/original_untouched/1/${number}.jpg`},_links:{show:{href:'https://api.tvmaze.com/shows/123'}}}));
 const {client,calls}=setup(url=>json(url.includes('/episodes?')?rows:show));
 const source=number=>({Id:`sample-${number}`,Type:'Episode',Name:`fictional.series.s01e0${number}`,SeriesId:series.Id,ParentIndexNumber:1,IndexNumber:number,PremiereDate:'2026-10-21T07:44:33Z',ImageTags:{Primary:'portrait'},PrimaryImageAspectRatio:2/3});
 const originals=[source(3),source(4)],before=structuredClone(originals);
 const rich=await Promise.all(originals.map(item=>client.enrich(item,series)));
 assert.ok(rich.every(r=>r.overview==='An original episode description.'));assert.notEqual(rich[0].still,rich[1].still);
 const merged=mergeMetadata(originals[0],rich[0]);assert.equal(merged.item.PremiereDate,originals[0].PremiereDate);assert.equal(merged.item.ImageTags.Primary,'portrait');assert.deepEqual(originals,before);
 assert.equal(calls.filter(c=>c.url.includes('/episodes?')).length,1);client.dispose();
});
test('adjacent-day handling rejects uncertain chronology and insufficient parent identity',()=>{
 const item={Name:'sample.s01e03',PremiereDate:'2026-10-21T07:44:33Z'},provider={airdate:'2026-10-20',airstamp:'2026-10-20T12:00:00Z'};
 for(const patch of [{Name:'A conflicting proper title'},{PremiereDate:'2026-10-21'},{PremiereDate:'2026-10-21T00:00:00Z'},{PremiereDate:'2026-10-22T07:44:33Z'}])assert.equal(episodeScheduleCompatible({...item,...patch},series,provider),false);
 assert.equal(episodeScheduleCompatible(item,{...series,ProviderIds:{Imdb:'tt1234567'}},provider),false);
 assert.equal(episodeScheduleCompatible(item,series,{...provider,airstamp:undefined}),false);
 assert.equal(episodeScheduleCompatible(item,series,{...provider,airstamp:'2026-10-19T00:00:00Z'}),false);
});
test('episode image selection excludes inherited posters and portrait Primaries',()=>{
 assert.equal(episodeArtworkSource({SeriesId:'series',SeriesPrimaryImageTag:'poster'}),null);
 assert.equal(episodeArtworkSource({ImageTags:{Primary:'poster'},PrimaryImageAspectRatio:2/3}),null);
 assert.equal(episodeArtworkSource({ImageTags:{Primary:'poster',Thumb:'still'},PrimaryImageAspectRatio:2/3}),'Thumb');
 assert.equal(episodeArtworkSource({ImageTags:{Primary:'still'},PrimaryImageAspectRatio:16/9}),'Primary');
});

test('proper episode titles corroborate adjacent-day timestamps without replacing server metadata',async()=>{
 const names=['An exact chapter','Another exact chapter'];
 const rows=names.map((name,i)=>({id:705+i,season:1,number:5+i,name,summary:'<p>A provider description.</p>',airdate:'2026-10-27',airstamp:'2026-10-27T12:00:00Z',image:{original:`https://static.tvmaze.com/uploads/images/original_untouched/1/${105+i}.jpg`}}));
 const {client,calls}=setup(url=>json(url.includes('/episodes?')?rows:show));
 const items=names.map((Name,i)=>({Id:`proper-${i}`,Type:'Episode',Name,SeriesId:series.Id,ParentIndexNumber:1,IndexNumber:5+i,PremiereDate:'2026-10-26T18:30:00Z',Overview:'Correct server description.',ProviderIds:{Imdb:`tt123456${i}`,Tmdb:String(800+i)}}));
 try{const before=structuredClone(items);const rich=await Promise.all(items.map(item=>client.enrich(item,series)));assert.ok(rich.every(value=>value?.still));assert.notEqual(rich[0].still,rich[1].still);items.forEach((item,i)=>{const merged=mergeMetadata(item,rich[i]).item;assert.equal(merged.Name,item.Name);assert.equal(merged.Overview,item.Overview);assert.equal(merged.PremiereDate,item.PremiereDate);assert.deepEqual(merged.ProviderIds,item.ProviderIds);});assert.deepEqual(items,before);assert.equal(calls.filter(call=>call.url.includes('/episodes?')).length,1);}finally{client.dispose();}
});

test('exact title corroboration never bypasses date, broadcast or parent-ID guards',()=>{
 const item={Name:'Exact chapter',PremiereDate:'2026-10-26T18:30:00Z'},value={name:'Exact chapter',airdate:'2026-10-27',airstamp:'2026-10-27T12:00:00Z'};
 assert.equal(episodeScheduleCompatible(item,series,value),true);
 for(const change of [{name:'Different chapter'},{name:undefined},{airstamp:undefined},{airstamp:'2026-10-29T12:00:00Z'}])assert.equal(episodeScheduleCompatible(item,series,{...value,...change}),false);
 for(const date of ['2026-10-26','2026-10-26T00:00:00Z','2026-10-25T18:30:00Z'])assert.equal(episodeScheduleCompatible({...item,PremiereDate:date},series,value),false);
 assert.equal(episodeScheduleCompatible(item,{...series,ProviderIds:{Tvmaze:'123',Imdb:'tt1234567'}},value),false);
});
test('an empty episode catalogue is briefly cached instead of hiding newly available metadata for six hours',async()=>{
 let time=0,rows=[];const {client,calls}=setup(url=>json(url.includes('/episodes?')?rows:show),()=>time);
 const item={Id:'e',SeriesId:series.Id,Type:'Episode',ParentIndexNumber:1,IndexNumber:1};
 assert.equal(await client.enrich(item,series),null);rows=[{id:701,season:1,number:1,summary:'<p>Now available</p>'}];
 time=1000;assert.equal(await client.enrich(item,series),null);time=121000;assert.equal((await client.enrich(item,series)).overview,'Now available');
 assert.equal(calls.filter(c=>c.url.includes('/episodes?')).length,2);client.dispose();
});


test('episode artwork tries both owned landscape sources and never includes an inherited poster',()=>{
 assert.deepEqual(episodeArtworkCandidates({ImageTags:{Thumb:'bad-thumb',Primary:'good-still'},PrimaryImageAspectRatio:16/9}),['Thumb','Primary']);
 assert.deepEqual(episodeArtworkCandidates({ImageTags:{Thumb:'still',Primary:'portrait'},PrimaryImageAspectRatio:2/3}),['Thumb']);
 assert.deepEqual(episodeArtworkCandidates({SeriesPrimaryImageTag:'poster',SeriesId:'series'}),[]);
});
test('safe medium episode image survives a missing or disallowed original image URL',async()=>{
 const medium='https://static.tvmaze.com/uploads/images/medium_landscape/1/105.jpg';
 const {client}=setup(url=>json(url.includes('/episodes?')?[{id:705,season:1,number:5,name:'Chapter five',image:{original:'https://untrusted.invalid/image.jpg',medium}}]:show));
 try{const result=await client.enrich({Id:'e',Type:'Episode',SeriesId:series.Id,ParentIndexNumber:1,IndexNumber:5},series);assert.equal(result.still,medium);assert.equal(result.stillFallback,medium);}finally{client.dispose();}
});
test('missing episode images expire quickly and refresh without losing existing descriptions',async()=>{
 let time=0,available=false;const image='https://static.tvmaze.com/uploads/images/original_untouched/1/105.jpg';
 const {client,calls}=setup(url=>json(url.includes('/episodes?')?[{id:705,season:1,number:5,name:'Chapter five',summary:'<p>Valid description</p>',image:available?{original:image}:null}]:show),()=>time);
 const item={Id:'e',Type:'Episode',SeriesId:series.Id,ParentIndexNumber:1,IndexNumber:5};
 try{assert.equal((await client.enrich(item,series)).still,undefined);available=true;time=121000;assert.equal((await client.enrich(item,series)).still,image);assert.equal(calls.filter(call=>call.url.includes('/episodes?')).length,2);}finally{client.dispose();}
});
