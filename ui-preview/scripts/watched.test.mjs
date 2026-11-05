import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JellyfinClient} from '../src/jellyfin/client.ts';
import {createFixtureFetch} from '../src/jellyfin/fixtures.ts';
async function fixture(){const calls=[],fetcher=createFixtureFetch('10.11.9');const client=new JellyfinClient('https://frame-fixture.invalid','device',async(url,init)=>{calls.push({url,init});return fetcher(url,init);});const server=await client.probe(),session=await client.authenticate(server,'demo','demo');calls.length=0;return{client,calls,session};}
test('watched and unwatched use authenticated user-scoped writes and invalidate stale item state',async()=>{
 const {client,calls,session}=await fixture();try{
  assert.equal((await client.item(session.user.Id,'fixture-1')).UserData.Played,false);
  assert.ok(calls.every(call=>call.init.method==='GET'));
  assert.equal(await client.setWatched(session.user.Id,'fixture-1',true),true);
  assert.equal((await client.item(session.user.Id,'fixture-1')).UserData.Played,true);
  assert.equal(await client.setWatched(session.user.Id,'fixture-1',false),false);
  assert.equal((await client.item(session.user.Id,'fixture-1')).UserData.Played,false);
  const writes=calls.filter(call=>call.init.method!=='GET');assert.deepEqual(writes.map(call=>call.init.method),['POST','DELETE']);
  for(const call of writes){const url=new URL(call.url);assert.equal(url.pathname,'/UserPlayedItems/fixture-1');assert.equal(url.searchParams.get('userId'),session.user.Id);assert.equal(url.searchParams.has('api_key'),false);assert.match(JSON.stringify(call.init.headers),/Authorization/);}
 }finally{client.dispose();}
});
test('episode watched updates persist in fixture reads without altering identifying metadata',async()=>{
 const {client,session}=await fixture();try{const before=await client.item(session.user.Id,'episode-1');await client.setWatched(session.user.Id,'episode-1',true);const after=await client.item(session.user.Id,'episode-1');assert.equal(after.UserData.Played,true);assert.equal(after.UserData.PlaybackPositionTicks,0);assert.equal(after.Name,before.Name);assert.deepEqual(after.ProviderIds,before.ProviderIds);}finally{client.dispose();}
});
test('permission failures never retry a mutation or falsify cached watched state',async()=>{
 let writes=0;const client=new JellyfinClient('https://fixture.invalid','device',async(url,init)=>{if(init.method!=='GET'){writes++;return new Response('{}',{status:403});}return new Response(JSON.stringify({Id:'movie',Type:'Movie',UserData:{Played:false}}));});
 try{await client.item('user','movie');await assert.rejects(client.setWatched('user','movie',true),error=>error.status===403);assert.equal(writes,1);assert.equal((await client.item('user','movie')).UserData.Played,false);}finally{client.dispose();}
});
test('concurrent duplicate watched clicks share one in-flight mutation',async()=>{
 let writes=0,finish;const client=new JellyfinClient('https://fixture.invalid','device',async()=>{writes++;await new Promise(resolve=>{finish=resolve;});return new Response(JSON.stringify({Played:true}));});
 try{const first=client.setWatched('user','movie',true),second=client.setWatched('user','movie',true);await new Promise(resolve=>setImmediate(resolve));finish();assert.deepEqual(await Promise.all([first,second]),[true,true]);assert.equal(writes,1);}finally{client.dispose();}
});


test('episode navigation uses server adjacency, respects boundaries and sends only scoped reads',async()=>{
 const {client,session}=await fixture();
 const middle=await client.adjacentEpisodes(session.user.Id,'fixture-2','episode-2');assert.equal(middle.previous.Id,'episode-1');assert.equal(middle.next.Id,'episode-3');
 const first=await client.adjacentEpisodes(session.user.Id,'fixture-2','episode-0');assert.equal(first.previous,undefined);assert.equal(first.next.Id,'episode-1');
 const last=await client.adjacentEpisodes(session.user.Id,'fixture-2','episode-5');assert.equal(last.next,undefined);assert.equal(last.previous.Id,'episode-4');
 const missing=await client.adjacentEpisodes(session.user.Id,'fixture-2','missing');assert.deepEqual(missing,{});
});
