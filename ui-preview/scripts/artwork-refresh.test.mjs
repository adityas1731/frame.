import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JellyfinClient} from '../src/jellyfin/client.ts';
import {FreeMetadataClient} from '../src/providers/free.ts';
const image={ProviderName:'TheMovieDb',Type:'Backdrop',Width:3840,Height:2160,Url:'https://image.tmdb.org/t/p/original/show.jpg'};
test('explicit artwork refresh reloads cached provider IDs, remote candidates and failed image requests using GET only',async()=>{
 let ready=false,reads=0,imageReads=0;const calls=[];
 const client=new JellyfinClient('https://fixture.invalid','device',async(url,init)=>{
  const path=new URL(url).pathname;calls.push(init.method);
  if(path.endsWith('/Images/Backdrop/0')){imageReads++;return ready?new Response(new Uint8Array([255,216,255]),{headers:{'Content-Type':'image/jpeg'}}):new Response(null,{status:404});}
  if(path.endsWith('/RemoteImages'))return Response.json({Images:ready?[image]:[]});
  if(path.endsWith('/Items/show')){reads++;return Response.json({Id:'show',Type:'Series',ProviderIds:ready?{Tmdb:'94997'}:{},BackdropImageTags:ready?['new-tag']:[]});}
  throw Error('Unexpected route');
 });
 try{
  await assert.rejects(client.image('show','Backdrop','old',1920));
  await assert.rejects(client.image('show','Backdrop','old',1920));assert.equal(imageReads,1);
  const old=await client.item('viewer','show');assert.deepEqual(old.ProviderIds,{});
  await client.item('viewer','show');assert.equal(reads,1);
  await client.remoteBackdrops({...old,ProviderIds:{Tmdb:'94997'}});
  ready=true;
  const fresh=await client.refreshItemArtwork('viewer','show');assert.equal(fresh.ProviderIds.Tmdb,'94997');assert.deepEqual(fresh.BackdropImageTags,['new-tag']);assert.equal(reads,2);
  assert.equal((await client.remoteBackdrops(fresh)).length,1);
  await client.image('show','Backdrop','old',1920);assert.equal(imageReads,2);
  assert.ok(calls.every(method=>method==='GET'));
 }finally{client.dispose();}
});
test('a show with overview and cast but missing backdrop retries after two minutes instead of six hours',async()=>{
 let now=0,artReads=0;const server={remoteBackdrop:async()=>++artReads===1?null:{url:image.Url,width:3840},invalidateRemoteImages(){}};
 const store={get:async()=>undefined,put:async()=>{},clear:async()=>{}};
 const client=new FreeMetadataClient(server,async()=>Response.json({id:123,name:'Show',summary:'An overview',_embedded:{cast:[{person:{name:'Actor'}}]}}),url=>url,()=>now,store);
 const item={Id:'show',Type:'Series',ProviderIds:{Tvmaze:'123',Tmdb:'94997'}};
 try{
  const first=await client.enrich(item);assert.equal(first.overview,'An overview');assert.equal(first.cast.length,1);assert.equal(first.backdrop,undefined);
  now=10000;await client.enrich(item);assert.equal(artReads,1);
  now=120001;assert.equal((await client.enrich(item)).backdrop,image.Url);assert.equal(artReads,2);
 }finally{client.dispose();}
});
test('explicit provider refresh discards the cached incomplete enrichment immediately',async()=>{
 let ready=false;const server={remoteBackdrop:async()=>ready?{url:image.Url,width:3840}:null,remoteBackdrops:async()=>ready?[image]:[],remotePosters:async()=>[],invalidateRemoteImages(){}};
 const client=new FreeMetadataClient(server,async()=>{throw Error('No external metadata expected')});
 const item={Id:'movie',Type:'Movie',ProviderIds:{Tmdb:'123'}};
 try{assert.equal(await client.enrich(item),null);ready=true;await client.refreshArtwork(item);assert.equal((await client.enrich(item)).backdrop,image.Url);}finally{client.dispose();}
});

test('empty Jellyfin RemoteImages cache expires alongside missing provider enrichment',async()=>{
 let now=0,reads=0;
 const client=new JellyfinClient('https://fixture.invalid','device',async()=>{reads++;return Response.json({Images:reads===1?[]:[image]});},()=>{},()=>now);
 const item={Id:'show',Type:'Series',ProviderIds:{Tmdb:'94997'}};
 try{
  assert.deepEqual(await client.remoteBackdrops(item),[]);
  now=10000;assert.deepEqual(await client.remoteBackdrops(item),[]);assert.equal(reads,1);
  now=120001;assert.equal((await client.remoteBackdrops(item)).length,1);assert.equal(reads,2);
 }finally{client.dispose();}
});
