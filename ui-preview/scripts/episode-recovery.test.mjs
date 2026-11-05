import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FreeMetadataClient} from '../src/providers/free.ts';
import {EpisodeImageClient} from '../src/providers/episodeImages.ts';
import {PUBLIC_CACHE_MAX_AGE,cacheEvictions,publicCacheKey,usablePublicEntry} from '../src/providers/publicCache.ts';
import {preferEpisodeStill,serverArtworkWidth} from '../src/components/episodeArtworkPolicy.ts';
const image='https://static.tvmaze.com/uploads/images/original_untouched/1/105.jpg';
const series={Id:'local-series',Type:'Series',ProviderIds:{Tvmaze:'123',Imdb:'tt1234567',Tvdb:'77'}};
const episode={Id:'private-episode',Type:'Episode',SeriesId:series.Id,ParentIndexNumber:1,IndexNumber:5,Name:'Episode 5'};
const show={id:123,externals:{imdb:'tt1234567',thetvdb:77},_embedded:{cast:[]}};
const rows=[{id:705,season:1,number:5,name:'A verified chapter',summary:'<p>A verified description.</p>',airdate:'2026-10-20',image:{original:image}}];
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function store(){const entries=new Map();return{entries,async get(k){return entries.get(k);},async put(v){entries.set(v.key,structuredClone(v));},async remove(k){entries.delete(k);},async clear(){entries.clear();}};}
function client(storage,fetcher,now){return new FreeMetadataClient({remoteBackdrop:async()=>null,invalidateRemoteImages(){}},fetcher,u=>u,now,storage);}
const success=async url=>json(url.includes('/episodes?')?rows:show);

test('episode Primary and Thumb requests are not downscaled to poster-card resolution',()=>{
 assert.equal(serverArtworkWidth({Type:'Episode'},false,undefined,380,1),1920);
 assert.equal(serverArtworkWidth({Type:'Episode'},false,'Thumb',380,2),1920);
 assert.equal(serverArtworkWidth({Type:'Episode'},false,undefined,2200,2),3840);
 assert.equal(serverArtworkWidth({Type:'Movie'},false,undefined,380,1),480);
});
test('small decoded episode images permit a verified still upgrade while sharp local images remain authoritative',()=>{
 for(const width of [32,160,320,480,720])assert.equal(preferEpisodeStill(width,true),true);
 for(const width of [960,1920,3840,undefined,0])assert.equal(preferEpisodeStill(width,true),false);
 assert.equal(preferEpisodeStill(320,false),false,'retain a usable local image if both online candidates fail');
});

test('a full client reload preserves verified episode details during API network and 503 outages',async()=>{
 for(const failure of [async()=>{throw TypeError('Network unavailable');},async()=>json({},503),async()=>json({},429)]){
  const storage=store();let now=100;const first=client(storage,success,()=>now);
  assert.equal((await first.enrich(episode,series)).still,image);first.dispose();now+=3600001;
  const reloaded=client(storage,failure,()=>now);const recovered=await reloaded.enrich(episode,series);
  assert.equal(recovered.still,image);assert.equal(recovered.name,'A verified chapter');assert.equal(recovered.overview,'A verified description.');
  assert.ok([...storage.entries.keys()].every(k=>!k.includes(episode.Id)&&!k.includes(series.Id)));reloaded.dispose();
 }
});
test('fresh persisted public responses deduplicate cold-page loads without new provider calls',async()=>{
 const storage=store();const first=client(storage,success,()=>100);await first.enrich(episode,series);first.dispose();
 const second=client(storage,async()=>assert.fail('Fresh cache must avoid network'),()=>200);assert.equal((await second.enrich(episode,series)).still,image);second.dispose();
});
test('stale fallback rechecks parent IDs, date conflicts and episode numbering',async()=>{
 const storage=store();const first=client(storage,success,()=>100);await first.enrich(episode,series);first.dispose();
 const next=client(storage,async()=>{throw TypeError('Offline');},()=>3600200);
 await assert.rejects(next.enrich(episode,{...series,ProviderIds:{...series.ProviderIds,Imdb:'tt7654321'}}),/conflict/);
 assert.equal(await next.enrich({...episode,IndexNumber:6},series),null);
 assert.equal(await next.enrich({...episode,PremiereDate:'2026-11-01'},series),null);
 assert.equal(await next.enrich(episode,{...series,DisplayOrder:'Dvd'}),null);next.dispose();
});
test('404 removes obsolete snapshots, and expired snapshots never restore old metadata',async()=>{
 for(const expire of [false,true]){
  const storage=store();const first=client(storage,success,()=>100);await first.enrich(episode,series);first.dispose();
  const next=client(storage,async()=>expire?Promise.reject(TypeError('Offline')):json({},404),()=>expire?PUBLIC_CACHE_MAX_AGE+101:3600200);
  await assert.rejects(next.enrich(episode,series));if(!expire)assert.equal(storage.entries.has('api:shows/123?embed=cast'),false);next.dispose();
 }
});
test('a successful response with new artwork replaces an older snapshot',async()=>{
 const storage=store();const first=client(storage,success,()=>100);await first.enrich(episode,series);first.dispose();
 const changed=image.replace('105.jpg','106.jpg');const next=client(storage,async url=>json(url.includes('/episodes?')?[{...rows[0],image:{original:changed}}]:show),()=>3600200);
 assert.equal((await next.enrich(episode,series)).still,changed);next.dispose();
});
test('episode image bytes survive a new image client and unavailable CDN',async()=>{
 const storage=store();let calls=0;const first=new EpisodeImageClient(storage,async(_url,init)=>{calls++;assert.equal(init.credentials,'omit');assert.equal(init.referrerPolicy,'no-referrer');assert.equal(init.headers,undefined);return new Response('original test image',{headers:{'Content-Type':'image/jpeg'}});},()=>100);
 const [a,b]=await Promise.all([first.load(image),first.load(image)]);assert.equal(await a.text(),await b.text());assert.equal(calls,1);
 const second=new EpisodeImageClient(storage,async()=>assert.fail('Saved still must not depend on CDN'),()=>200);assert.equal(await (await second.load(image)).text(),'original test image');
 await second.clear();assert.equal(storage.entries.size,0);
});
test('image network failures are retryable and never stored as successful artwork',async()=>{
 const storage=store();let calls=0;const images=new EpisodeImageClient(storage,async()=>{if(++calls===1)throw TypeError('Offline');return new Response('image',{headers:{'Content-Type':'image/webp'}});},()=>100);
 await assert.rejects(images.load(image));assert.equal(storage.entries.size,0);assert.equal(await (await images.load(image)).text(),'image');assert.equal(calls,2);
});
test('public image requests reject credentials, other hosts, HTML and excessive payloads',async()=>{
 const storage=store();const images=new EpisodeImageClient(storage,async()=>new Response('<html>not an image</html>',{headers:{'Content-Type':'text/html'}}));
 for(const url of ['http://static.tvmaze.com/uploads/images/original/1/1.jpg',image+'?token=secret',image.replace('static.tvmaze.com','other.invalid'),image.replace('https://','https://user:pass@')])await assert.rejects(images.load(url),/Unsupported/);
 await assert.rejects(images.load(image),/Invalid/);assert.equal(storage.entries.size,0);
 const huge=new EpisodeImageClient(storage,async()=>new Response(new Uint8Array(5*1024*1024+1),{headers:{'Content-Type':'image/jpeg'}}));await assert.rejects(huge.load(image),/Invalid/);assert.equal(storage.entries.size,0);
});
test('the default browser fetch is invoked without binding it to the image client',async()=>{
 const original=globalThis.fetch;globalThis.fetch=function(){assert.ok(this===undefined||this===globalThis);return Promise.resolve(new Response('image',{headers:{'Content-Type':'image/jpeg'}}));};
 try{const images=new EpisodeImageClient(store());assert.equal(await (await images.load(image)).text(),'image');}finally{globalThis.fetch=original;}
});
test('image requests cap parallel downloads at three and expired bytes are refreshed',async()=>{
 const storage=store();let active=0,max=0,now=100,calls=0;
 const images=new EpisodeImageClient(storage,async()=>{calls++;active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return new Response('image',{headers:{'Content-Type':'image/jpeg'}});},()=>now);
 await Promise.all(Array.from({length:8},(_,i)=>images.load(image.replace('105.jpg',`${i}.jpg`))));assert.equal(max,3);
 now+=PUBLIC_CACHE_MAX_AGE+1;await images.load(image.replace('105.jpg','0.jpg'));assert.equal(calls,9);
});
test('storage denial still permits live provider and image reads',async()=>{
 const denied={get:async()=>{throw Error('Denied');},put:async()=>{throw Error('Quota');},remove:async()=>{},clear:async()=>{}};
 const c=client(denied,success,()=>100);assert.equal((await c.enrich(episode,series)).still,image);c.dispose();
 const images=new EpisodeImageClient(denied,async()=>new Response('image',{headers:{'Content-Type':'image/png'}}));assert.equal(await (await images.load(image)).text(),'image');
});
test('cache bounds evict expired, oversized totals and excess entries without touching private stores',()=>{
 const entries=Array.from({length:110},(_,i)=>({key:`image:${image.replace('105.jpg',`${i}.jpg`)}`,savedAt:100+i,freshUntil:999,value:'',bytes:1024*1024}));
 assert.equal(cacheEvictions(entries,300).length,62);assert.equal(publicCacheKey('api:Items/private?token=secret'),false);
 assert.equal(usablePublicEntry({...entries[0],savedAt:400},entries[0].key,300),false);
});
