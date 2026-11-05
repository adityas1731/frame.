import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personName,premiereDate,genreDestination} from '../src/components/detailPresentation.ts';
import {JellyfinClient} from '../src/jellyfin/client.ts';
import {createFixtureFetch,fixtureUser} from '../src/jellyfin/fixtures.ts';
const json=value=>new Response(JSON.stringify(value));

test('premiere display uses ordinal dates without timezone shifts or invented dates',()=>{
 for(const [day,suffix] of [[1,'st'],[2,'nd'],[3,'rd'],[4,'th'],[11,'th'],[12,'th'],[13,'th'],[21,'st'],[22,'nd'],[23,'rd'],[31,'st']])assert.equal(premiereDate(`2026-08-${String(day).padStart(2,'0')}T23:45:00-08:00`),`${day}${suffix} August 2026`);
 assert.equal(premiereDate('2024-02-29'),'29th February 2024');
 for(const input of [undefined,'2026','not a date','2026-02-29','2026-04-31','2026-13-01'])assert.equal(premiereDate(input),undefined);
});
test('director display capitalizes word starts while preserving internal casing and accents',()=>{
 assert.equal(personName('medo ishl'),'Medo Ishl');assert.equal(personName('jean-luc o’neill'),'Jean-Luc O’Neill');assert.equal(personName('éva McDonald'),'Éva McDonald');assert.equal(personName(undefined),undefined);
});
test('genre links preserve exact combined and punctuation-bearing server labels',async()=>{
 for(const label of ['Sci-Fi & Fantasy','Drama','Action/Adventure','TV + Film'])assert.equal(new URLSearchParams(genreDestination(label).split('?')[1]).get('genre'),label);
 const client=new JellyfinClient('https://fixture.invalid','device',createFixtureFetch());
 try{const page=await client.items(fixtureUser.Id,{genre:'Drama',limit:40});assert.ok(page.Items.length>1);assert.ok(page.Items.every(item=>item.Genres.includes('Drama')));assert.ok(page.Items.some(item=>item.Type==='Movie'));assert.ok(page.Items.some(item=>item.Type==='Series'));}finally{client.dispose();}
});
test('favorites persist through confirmed reads and lists without touching watch progress or metadata',async()=>{
 const calls=[],fixture=createFixtureFetch(),client=new JellyfinClient('https://fixture.invalid','device',(url,init)=>{calls.push({url,init});return fixture(url,init);});
 try{
  const server=await client.probe();const session=await client.authenticate(server,'synthetic','synthetic');const id='fixture-1';
  const before=await client.item(session.user.Id,id);const total=(await client.items(session.user.Id,{favorite:true})).TotalRecordCount;
  assert.equal(await client.setFavorite(session.user.Id,id,true),true);
  const after=await client.item(session.user.Id,id);assert.equal(after.UserData.IsFavorite,true);assert.equal(after.UserData.Played,before.UserData.Played);assert.equal(after.UserData.PlaybackPositionTicks,before.UserData.PlaybackPositionTicks);assert.equal(after.Name,before.Name);assert.deepEqual(after.ProviderIds,before.ProviderIds);
  assert.equal((await client.items(session.user.Id,{favorite:true})).TotalRecordCount,total+1);
  assert.equal(await client.setFavorite(session.user.Id,id,false),false);assert.equal((await client.items(session.user.Id,{favorite:true})).TotalRecordCount,total);
  const writes=calls.filter(c=>/UserFavoriteItems/.test(c.url));assert.deepEqual(writes.map(c=>c.init.method),['POST','DELETE']);
  for(const {url,init}of writes){assert.equal(new URL(url).searchParams.get('userId'),session.user.Id);assert.equal(new URL(url).searchParams.has('api_key'),false);assert.ok(init.headers.Authorization);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.body,undefined);}
  await assert.rejects(client.setFavorite('another-user',id,true),e=>e.status===403);
 }finally{client.dispose();}
});
test('failed favorite mutations are never retried and do not claim success',async()=>{
 let writes=0;const client=new JellyfinClient('https://fixture.invalid','device',async(url,init)=>init.method==='GET'?json({Id:'movie',UserData:{IsFavorite:false}}):(writes++,new Response('{}',{status:403})));
 try{await assert.rejects(client.setFavorite('u','movie',true),e=>e.status===403);assert.equal(writes,1);assert.equal((await client.item('u','movie')).UserData.IsFavorite,false);}finally{client.dispose();}
});
test('duplicate favorite actions share a write; a pre-write read cannot restore stale state',async()=>{
 let releaseRead,releaseWrite,writes=0,reads=0,confirmed=false;
 const client=new JellyfinClient('https://fixture.invalid','device',async(url,init)=>{
  if(init.method==='GET'){reads++;if(reads===1)await new Promise(resolve=>{releaseRead=resolve;});return json({Id:'movie',UserData:{IsFavorite:reads===1?false:confirmed}});}
  writes++;await new Promise(resolve=>{releaseWrite=resolve;});confirmed=true;return json({IsFavorite:true});
 });
 try{const stale=client.item('u','movie');const first=client.setFavorite('u','movie',true),second=client.setFavorite('u','movie',true);releaseWrite();assert.deepEqual(await Promise.all([first,second]),[true,true]);releaseRead();assert.equal((await stale).UserData.IsFavorite,true);assert.equal((await client.item('u','movie')).UserData.IsFavorite,true);assert.equal(writes,1);assert.equal(reads,2);}finally{client.dispose();}
});
