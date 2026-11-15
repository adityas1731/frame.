import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JellyfinClient} from '../src/jellyfin/client.ts';
import {FreeMetadataClient} from '../src/providers/free.ts';
import {mergeMetadata} from '../src/providers/metadata.ts';
import {identificationQuery} from '../src/jellyfin/identification.ts';
import {exactMetadataMatch} from '../src/jellyfin/artworkIdentity.ts';
const item={Id:'new-title',Type:'Movie',Name:'My edited title',ProviderIds:{Imdb:'tt1234567'}};
const match={Name:'Provider title',Overview:'Provider description',ProductionYear:2024,SearchProviderName:'TheMovieDb',ProviderIds:{Imdb:'tt1234567',Tmdb:'123'},ImageUrl:'https://image.tmdb.org/t/p/original/poster.jpg'};
test('automatic exact-ID lookup uses the pasted IMDb-link identity without applying metadata; deduplicates artwork and details',async()=>{
 const calls=[];const c=new JellyfinClient('https://fixture.invalid','device',async(url,init)=>{calls.push({url,init});return Response.json([match]);});
 try{const [metadata,poster]=await Promise.all([c.metadataFromIdentity(item),c.artworkPosterFromIdentity(item)]);assert.equal(metadata.overview,match.Overview);assert.equal(poster.url,match.ImageUrl);assert.equal(calls.length,1);assert.deepEqual(JSON.parse(calls[0].init.body).SearchInfo,identificationQuery('https://www.imdb.com/title/tt1234567/','Movie'));assert.ok(calls.every(c=>!c.url.includes('/Apply/')&&!c.url.includes('/Refresh')&&!c.url.includes('/Images/')));}finally{c.dispose();}
});
test('metadata identity does not depend on an image, and rejects ambiguous or conflicting matches',()=>{
 assert.equal(exactMetadataMatch(item,[{...match,ImageUrl:undefined}]).overview,match.Overview);
 assert.equal(exactMetadataMatch(item,[{...match,ProviderIds:{Imdb:'tt9999999',Tmdb:'123'}}]),null);
 assert.equal(exactMetadataMatch(item,[match,{...match,ProviderIds:{Imdb:'tt1234567',Tmdb:'456'}}]),null);
 assert.equal(exactMetadataMatch({...item,ProviderIds:{}},[match]),null);
});
test('new titles receive missing details and art automatically while existing edits remain intact',async()=>{
 let reads=0;const c=new FreeMetadataClient({remoteBackdrop:async()=>({url:'https://image.tmdb.org/t/p/original/backdrop.jpg',width:1920,height:1080}),remotePosters:async()=>[],metadataFromIdentity:async()=>{reads++;return {tmdbId:'123',name:match.Name,overview:match.Overview,year:2024,url:match.ImageUrl};}});
 try{const original=structuredClone(item);const online=await c.enrich(item);assert.equal(online.poster,match.ImageUrl);assert.ok(online.backdrop);const merged=mergeMetadata(item,online).item;assert.equal(merged.Name,item.Name);assert.equal(merged.Overview,match.Overview);assert.equal(merged.ProductionYear,2024);assert.deepEqual(item,original);
 const edited={...item,Overview:'My description',ProductionYear:1999,ImageTags:{Primary:'custom'},BackdropImageTags:['custom']};assert.equal(mergeMetadata(edited,online).item.Overview,'My description');assert.equal(mergeMetadata(edited,online).item.ProductionYear,1999);await c.enrich(edited);assert.equal(reads,1,'complete titles do not repeat exact lookup');
 }finally{c.dispose();}
});
test('failed or empty exact lookup retries after the negative-cache interval and discovers newly added provider IDs',async()=>{
 let now=0,ready=false,requests=0;const c=new JellyfinClient('https://fixture.invalid','device',async()=>{requests++;return Response.json(ready?[match]:[]);},()=>{},()=>now);
 try{assert.equal(await c.metadataFromIdentity(item),null);ready=true;now=1000;assert.equal(await c.metadataFromIdentity(item),null);now=120001;assert.ok(await c.metadataFromIdentity(item));assert.equal(requests,2);assert.equal(await c.metadataFromIdentity({...item,Id:'unidentified',ProviderIds:{}}),null);assert.equal(requests,2);}finally{c.dispose();}
});
