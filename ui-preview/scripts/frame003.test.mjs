import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseItem, JellyfinClient } from '../src/jellyfin/client.ts';
import { createFixtureFetch } from '../src/jellyfin/fixtures.ts';
import { itemCoverage, imageSource } from '../src/jellyfin/presentation.ts';
const fixture = JSON.parse(await readFile(new URL('./fixtures/jellyfin-10.11.9.json', import.meta.url), 'utf8'));
test('10.11.9 optional DTO, original title, premiere and read-only user data map without losing zeroes', () => {
  const item = parseItem(fixture.Movie);
  assert.equal(item.OriginalTitle,'An original feature'); assert.ok(item.PremiereDate.startsWith('2025-05-20'));
  assert.deepEqual(item.UserData,{ IsFavorite:true, Played:false, PlaybackPositionTicks:9000000000, PlayCount:0 });
  assert.equal(item.CommunityRating,0); assert.equal(imageSource(item,false,'Logo').type,'Logo');
  assert.equal(item.UserData.Key,undefined);
});
test('specials, multi-episode numbers and inherited landscape/portrait art stay distinct', () => {
  const item = parseItem(fixture.Episode);
  assert.equal(item.ParentIndexNumber,0); assert.equal(item.IndexNumberEnd,2);
  assert.equal(imageSource(item).type,'Primary'); assert.equal(imageSource(item,true).type,'Backdrop');
  assert.equal(itemCoverage(item,true).fields.find(f=>f.field==='season').state,'present');
});
test('10.11.9 browsing uses scoped GETs for counts, favorites and discovery', async () => {
  const fixtureFetch = createFixtureFetch('10.11.9'); const calls=[];
  const client = new JellyfinClient('https://contract.invalid','fixture',async (url,init) => { calls.push([url,init.method]); return fixtureFetch(url,init); });
  const server=await client.probe(); const session=await client.authenticate(server,'fixture','');
  const counts=await client.counts(session.user.Id); assert.deepEqual(counts,{ movies:50,series:30 });
  await client.libraries(session.user.Id); assert.ok(calls.some(([url])=>url.endsWith('/Users/fixture-user/Views')));
  const favorites=await client.items(session.user.Id,{ favorite:true }); assert.equal(favorites.TotalRecordCount,16); assert.ok(favorites.Items.every(i=>i.UserData.IsFavorite));
  assert.ok(calls.some(([url])=>new URL(url).searchParams.get('fields')?.includes('ProviderIds')));
  assert.ok(calls.every(([url,method])=>method==='GET'||url.endsWith('/Users/AuthenticateByName'))); client.dispose();
});

test('Cinema resume shelf requests only user-scoped resumable movies/episodes', async () => {
  const fetchFixture = createFixtureFetch('10.11.9'); const calls=[];
  const client = new JellyfinClient('https://contract.invalid','fixture',async(url,init)=>{calls.push([url,init]);return fetchFixture(url,init);});
  const server=await client.probe();const session=await client.authenticate(server,'fixture','');
  const page=await client.items(session.user.Id,{resume:true,limit:16});
  const request=new URL(calls.at(-1)[0]);
  assert.equal(request.searchParams.get('filters'),'IsResumable');assert.equal(request.searchParams.get('includeItemTypes'),'Movie,Episode');
  assert.equal(request.searchParams.get('userId'),session.user.Id);assert.ok(page.Items.length>0);assert.ok(page.Items.every(item=>item.UserData.PlaybackPositionTicks>0&&!item.UserData.Played));client.dispose();
});

test('HD backdrop requests retain server authentication and bound dimensions without a token URL', async () => {
  const fetchFixture=createFixtureFetch('10.11.9');let request;
  const client=new JellyfinClient('https://contract.invalid','fixture',async(url,init)=>{request={url,init};return fetchFixture(url,init);});
  const server=await client.probe();await client.authenticate(server,'fixture','');
  await client.image('fixture-0','Backdrop','original-art',9000);
  const url=new URL(request.url);assert.equal(url.searchParams.get('maxWidth'),'3840');assert.equal(url.searchParams.get('quality'),'92');
  assert.ok(request.init.headers.Authorization);assert.equal(url.searchParams.has('api_key'),false);assert.ok(!url.href.includes('fictional-session-token'));client.dispose();
});
