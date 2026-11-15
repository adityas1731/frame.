import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JellyfinClient} from '../src/jellyfin/client.ts';
import {FreeMetadataClient,tvArtwork} from '../src/providers/free.ts';
import {exactArtworkPoster} from '../src/jellyfin/artworkIdentity.ts';
import {publicCacheKey} from '../src/providers/publicCache.ts';
const tvImage='https://static.tvmaze.com/uploads/images/original_untouched/218/547436.jpg';
const poster='https://image.tmdb.org/t/p/original/poster.jpg';
const gallery=[{type:'background',resolutions:{original:{url:tvImage,width:1920,height:1080}}},{type:'poster',main:true,resolutions:{original:{url:'https://static.tvmaze.com/uploads/images/original_untouched/392/981778.jpg',width:2025,height:3000}}}];
const item={Id:'show',Name:'Any show',Type:'Series',ProviderIds:{Imdb:'tt11198330'}};
const store=()=>{const rows=new Map();return {get:async key=>rows.get(key),put:async entry=>rows.set(entry.key,entry),remove:async key=>rows.delete(key),clear:async()=>rows.clear()};};
function tv({conflict=false,offline=false}={}){
 const calls=[];const transport=async(url,init)=>{calls.push({url,init});if(offline)throw Error('Offline');return Response.json(url.includes('/lookup/')?{id:44778}:url.endsWith('/images')?gallery:{id:44778,name:'Verified show',externals:{imdb:conflict?'tt9999999':'tt11198330'},summary:'An overview',_embedded:{cast:[]}});};
 const server={remoteBackdrop:async()=>{throw Error('TMDb unavailable');},remotePosters:async()=>[],remoteBackdrops:async()=>[],invalidateRemoteImages(){},artworkPosterFromIdentity:async()=>null};
 return {client:new FreeMetadataClient(server,transport,url=>url,Date.now,store()),calls};
}
test('IMDb-only series gets banner and poster from an exact verified show, including the reported show',async()=>{
 const {client,calls}=tv();try{
  const result=await client.enrich(item);assert.equal(result.backdrop,tvImage);assert.match(result.poster,/981778/);assert.equal(result.artworkLabel,'TVmaze');
  assert.ok(calls.some(call=>call.url.endsWith('/lookup/shows?imdb=tt11198330')));assert.ok(calls.every(call=>call.init.method==='GET'&&!('Authorization' in call.init.headers)));
  const another=await client.enrich({...item,Id:'unfamous',Name:'A different display name'});assert.equal(another.backdrop,tvImage);
 }finally{client.dispose();}
});
test('TVDB-only series uses exact TVDB identity, never a title search',async()=>{
 const calls=[];const client=new FreeMetadataClient({remoteBackdrop:async()=>null,remotePosters:async()=>[]},async url=>{calls.push(url);return Response.json(url.includes('lookup/')?{id:9}:url.endsWith('/images')?gallery:{id:9,externals:{thetvdb:42},_embedded:{cast:[]}});},url=>url,Date.now,store());
 try{assert.equal((await client.enrich({...item,ProviderIds:{Tvdb:'42'}})).backdrop,tvImage);assert.ok(calls[0].endsWith('thetvdb=42'));assert.ok(calls.every(url=>!url.includes('/search')));}finally{client.dispose();}
});
test('conflicting identity and unavailable providers cannot select unrelated artwork',async()=>{
 for(const options of [{conflict:true},{offline:true}]){const {client,calls}=tv(options);try{await assert.rejects(client.enrich(item));assert.ok(!calls.some(call=>call.url.endsWith('/images')));}finally{client.dispose();}}
});
test('gallery validation rejects unsafe URLs, portrait backgrounds and invalid dimensions',()=>{
 const bad=[...gallery.map(row=>({...row,resolutions:{original:{url:'https://evil.invalid/image.jpg',width:1920,height:1080}}})),{type:'background',resolutions:{original:{url:tvImage,width:500,height:1000}}},{type:'background',resolutions:{original:{url:tvImage,width:Infinity,height:1080}}}];
 assert.deepEqual(tvArtwork(bad),{backdrop:undefined,backdropFallback:undefined,poster:undefined,posterFallback:undefined});assert.equal(tvArtwork(gallery).backdrop.url,tvImage);assert.equal(publicCacheKey('api:shows/44778/images'),true);
});
test('movies and shows accept only one corroborated exact-ID poster match',()=>{
 const candidate={SearchProviderName:'TheMovieDb',ProviderIds:{Imdb:'tt11198330',Tmdb:'94997'},ImageUrl:poster};
 for(const Type of ['Movie','Series'])assert.equal(exactArtworkPoster({...item,Type},[candidate]).url,poster);
 assert.equal(exactArtworkPoster(item,[{...candidate,ProviderIds:{Imdb:'tt9999999',Tmdb:'94997'}}]),null);
 assert.equal(exactArtworkPoster(item,[candidate,{...candidate,ProviderIds:{Imdb:'tt11198330',Tmdb:'94998'}}]),null);
 assert.equal(exactArtworkPoster({...item,ProviderIds:{}},[candidate]),null);
 assert.equal(exactArtworkPoster(item,[{...candidate,ImageUrl:'https://evil.invalid/steal'}]),null);
 assert.equal(exactArtworkPoster(item,[{...candidate,SearchProviderName:'Unknown'}]),null);
});
test('exact-ID movie poster discovery never applies identification and deduplicates repeated requests',async()=>{
 const calls=[];const server=new JellyfinClient('https://fixture.invalid','device',async(url,init)=>{calls.push({url,init});assert.ok(url.endsWith('/Items/RemoteSearch/Movie'));assert.deepEqual(JSON.parse(init.body).SearchInfo,{ProviderIds:{Imdb:'tt11198330'}});return Response.json([{SearchProviderName:'TheMovieDb',ProviderIds:{Imdb:'tt11198330',Tmdb:'123'},ImageUrl:poster}]);});
 try{const movie={...item,Type:'Movie'};const values=await Promise.all([server.artworkPosterFromIdentity(movie),server.artworkPosterFromIdentity(movie)]);assert.equal(values[0].url,poster);assert.equal(calls.length,1);assert.ok(calls.every(call=>!call.url.includes('/Apply/')&&!call.url.includes('/Refresh')));}finally{server.dispose();}
});
test('movie enrichment retains a discovered poster even when backdrops fail',async()=>{
 const server={remoteBackdrop:async()=>{throw Error('Unavailable');},remotePosters:async()=>[],artworkPosterFromIdentity:async()=>({url:poster,tmdbId:'123'})};
 const client=new FreeMetadataClient(server,async()=>{throw Error('Movie must not use TV lookup')});try{const result=await client.enrich({...item,Type:'Movie'});assert.equal(result.poster,poster);assert.equal(result.backdrop,undefined);}finally{client.dispose();}
});
test('refresh invalidates the verified show gallery and rediscovers it without changing the item',async()=>{
 const {client,calls}=tv();const original=structuredClone(item);try{await client.enrich(item);await client.refreshArtwork(item);await client.enrich(item);assert.equal(calls.filter(call=>call.url.endsWith('/images')).length,2);assert.deepEqual(item,original);}finally{client.dispose();}
});


test('gallery selection avoids unnecessarily huge images when suitable banner and card sizes exist',()=>{
 const huge=gallery.map(row=>({...row,resolutions:{original:{...row.resolutions.original,width:row.type==='background'?10968:3543,height:row.type==='background'?6342:5315}}}));
 const result=tvArtwork([...huge,...gallery]);assert.equal(result.backdrop.width,1920);assert.equal(result.poster.width,2025);
});
test('a stalled Jellyfin image provider cannot indefinitely block the alternate banner', {timeout:5000},async()=>{
 const server={remoteBackdrop:()=>new Promise(()=>{}),remotePosters:()=>new Promise(()=>{})};
 const client=new FreeMetadataClient(server,async url=>Response.json(url.includes('lookup/')?{id:44778}:url.endsWith('/images')?gallery:{id:44778,externals:{imdb:'tt11198330'},_embedded:{cast:[]}}),url=>url,Date.now,store());
 try{assert.equal((await client.enrich(item)).backdrop,tvImage);}finally{client.dispose();}
});
test('cached verified artwork survives a subsequent public-provider network outage',async()=>{
 const saved=store();let now=Date.now();const server={remoteBackdrop:async()=>null,remotePosters:async()=>[]};
 const live=new FreeMetadataClient(server,async url=>Response.json(url.includes('lookup/')?{id:44778}:url.endsWith('/images')?gallery:{id:44778,externals:{imdb:'tt11198330'},_embedded:{cast:[]}}),url=>url,()=>now,saved);
 assert.equal((await live.enrich(item)).backdrop,tvImage);live.dispose();now+=3600001;
 const offline=new FreeMetadataClient(server,async()=>{throw Error('Network unavailable');},url=>url,()=>now,saved);
 try{assert.equal((await offline.enrich(item)).backdrop,tvImage);}finally{offline.dispose();}
});
test('unidentified movies do not trigger title guesses or arbitrary external lookups',async()=>{
 const server=new JellyfinClient('https://fixture.invalid','device',async()=>assert.fail('No identity, no lookup'));
 try{assert.equal(await server.artworkPosterFromIdentity({Id:'unknown',Name:'An ambiguous name',Type:'Movie'}),null);}finally{server.dispose();}
});

test('artwork picker and refresh include verified banner and poster alternatives when Jellyfin lists are empty',async()=>{
 const {client}=tv();try{
  const options=await client.artworkOptions(item);
  assert.ok(options.backdrops.some(image=>image.url===tvImage));
  assert.ok(options.posters.length>0);
  assert.equal(new Set(options.backdrops.map(image=>image.url)).size,options.backdrops.length);
  const refreshed=await client.refreshArtwork(item);
  assert.ok(refreshed.backdrops.some(image=>image.url===tvImage));assert.ok(refreshed.posters.length>0);
 }finally{client.dispose();}
});

test('picker exposes the complete verified gallery, beyond the two automatic fallback choices',async()=>{
 const rows=Array.from({length:7},(_,index)=>[
  {type:'background',resolutions:{original:{url:`https://static.tvmaze.com/uploads/images/original_untouched/1/${100+index}.jpg`,width:1920,height:1080}}},
  {type:'poster',resolutions:{original:{url:`https://static.tvmaze.com/uploads/images/original_untouched/2/${200+index}.jpg`,width:1000,height:1500}}}
 ]).flat();
 rows.push(rows[0],{type:'background',resolutions:{original:{url:'https://evil.invalid/image.jpg',width:1920,height:1080}}});
 let galleryReads=0;
 const client=new FreeMetadataClient({remoteBackdrop:async()=>null,remoteBackdrops:async()=>[],remotePosters:async()=>[]},async url=>{
  if(url.endsWith('/images')){galleryReads++;return Response.json(rows);}
  return Response.json(url.includes('lookup/')?{id:44778}:{id:44778,externals:{imdb:'tt11198330'},_embedded:{cast:[]}});
 },url=>url,Date.now,store());
 try{
  const auto=await client.enrich(item);assert.ok(auto.backdrop);assert.ok(auto.backdropFallback);
  const options=await client.artworkOptions(item);assert.equal(options.backdrops.length,7);assert.equal(options.posters.length,7);
  assert.ok(options.backdrops.every(image=>image.width===1920&&image.height===1080));
  assert.equal(galleryReads,1,'reuse the verified gallery without repeating its request');
 }finally{client.dispose();}
});

test('gallery excludes oversized and wrong-kind images, using a safe provider rendition where available',async()=>{
 const {supportedArtworkDimensions}=await import('../src/components/artworkLimits.ts');
 assert.equal(supportedArtworkDimensions(10968,6342),false);
 const image=(type,id,width,height,extra={})=>({type,resolutions:{original:{url:`https://static.tvmaze.com/uploads/images/original_untouched/1/${id}.jpg`,width,height},...extra}});
 const unsafe=[image('background',1,10968,6342),image('poster',2,6000,9000),image('poster',3,1920,1080),image('background',4,1000,1500)];
 assert.deepEqual(tvArtwork(unsafe),{backdrop:undefined,backdropFallback:undefined,poster:undefined,posterFallback:undefined});
 const variants=[image('background',1,10968,6342,{small:{url:tvImage,width:1920,height:1080}}),image('poster',2,6000,9000,{small:{url:'https://static.tvmaze.com/uploads/images/original/1/99.jpg',width:1000,height:1500}})];
 const result=tvArtwork(variants);assert.equal(result.backdrop.width,1920);assert.equal(result.poster.width,1000);
});

test('picker hides oversized originals with no safe rendition for both artwork kinds',async()=>{
 const rows=[...gallery,{type:'background',resolutions:{original:{url:'https://static.tvmaze.com/uploads/images/original/1/777.jpg',width:10968,height:6342}}},{type:'poster',resolutions:{original:{url:'https://static.tvmaze.com/uploads/images/original/1/888.jpg',width:6000,height:9000}}}];
 const client=new FreeMetadataClient({remoteBackdrop:async()=>null,remoteBackdrops:async()=>[],remotePosters:async()=>[]},async url=>Response.json(url.endsWith('/images')?rows:url.includes('lookup/')?{id:44778}:{id:44778,externals:{imdb:'tt11198330'},_embedded:{cast:[]}}),url=>url,Date.now,store());
 try{const options=await client.artworkOptions(item);assert.equal(options.backdrops.length,1);assert.equal(options.posters.length,1);for(const images of [options.backdrops,options.posters])assert.ok(images.every(image=>!image.disabledReason&&image.width*image.height<=40000000));assert.equal((await client.enrich(item)).backdrop,tvImage);}finally{client.dispose();}
});
