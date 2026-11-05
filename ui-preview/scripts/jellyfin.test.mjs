import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JellyfinClient, JellyfinError, normalizeServerUrl, parseItem } from '../src/jellyfin/client.ts';
import { createFixtureFetch, fixtureServer, fixtureUser } from '../src/jellyfin/fixtures.ts';
import { itemCoverage, itemTitle, runtime, imageSource } from '../src/jellyfin/presentation.ts';
import { saveSession, loadSession, sessionKey } from '../src/jellyfin/session.ts';
const base = 'https://frame-fixture.invalid';
test('episode pages explicitly request metadata, own thumbnails, image aspect and user state',async()=>{
 let requested;const client=new JellyfinClient(base,'test-device',async url=>{requested=new URL(url);return json({Items:[{Id:'e',Type:'Episode',PrimaryImageAspectRatio:2/3,ImageTags:{Primary:'portrait',Thumb:'still'}}],TotalRecordCount:1});});
 const page=await client.episodes('user','series','season');assert.equal(page.Items[0].PrimaryImageAspectRatio,2/3);
 for(const field of ['Overview','ProviderIds','PrimaryImageAspectRatio'])assert.ok(requested.searchParams.get('fields').split(',').includes(field));
 assert.equal(requested.searchParams.get('enableImages'),'true');assert.equal(requested.searchParams.get('enableImageTypes'),'Primary,Thumb');assert.equal(requested.searchParams.get('enableUserData'),'true');
 assert.equal(parseItem({Id:'e',PrimaryImageAspectRatio:-1}).PrimaryImageAspectRatio,undefined);client.dispose();
});
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
async function signed(transport = createFixtureFetch(), unauthorized, now) { const client = new JellyfinClient(base, 'test-device', transport, unauthorized, now); const server = await client.probe(); const session = await client.authenticate(server, 'synthetic-user', 'synthetic-password'); return { client, session }; }

test('keepalive stop requests bypass saturated ordinary request slots during page exit', async () => {
 const held=[],calls=[];const fixture=createFixtureFetch();let block=false;
 const {client,session}=await signed((url,init)=>{calls.push({url,init});if(block&&init.method==='GET')return new Promise(resolve=>held.push(()=>resolve(json({Id:'held'}))));return fixture(url,init);});
 block=true;const reads=Array.from({length:4},(_,i)=>client.item(session.user.Id,'held-'+i));
 try{
  assert.equal(held.length,4);const stop=client.stopEncoding('own-session');
  const request=calls.find(c=>c.init.method==='DELETE');assert.ok(request);assert.equal(request.init.keepalive,true);assert.match(request.url,/playSessionId=own-session/);
  await stop;
 }finally{held.forEach(release=>release());await Promise.all(reads);client.dispose();}
});

test('server URLs preserve reverse-proxy paths and reject unsafe/mixed-content inputs', () => {
  assert.equal(normalizeServerUrl('https://example.invalid/jellyfin///'), 'https://example.invalid/jellyfin');
  for (const input of ['file:///x', 'javascript:alert(1)', 'https://user:pw@example.invalid', 'https://example.invalid/?token=x', 'https://example.invalid/#fragment', 'example.invalid']) assert.throws(() => normalizeServerUrl(input), JellyfinError);
  assert.throws(() => normalizeServerUrl('http://example.invalid'));
  assert.throws(() => normalizeServerUrl('http://example.invalid', true, 'https:'));
  assert.equal(normalizeServerUrl('http://example.invalid:8096', true), 'http://example.invalid:8096');
});
test('authentication uses header identity, JSON password, no cookies, no redirects and no token URL', async () => {
  const calls = []; const fixture = createFixtureFetch();
  const { client, session } = await signed(async (url, init) => { calls.push([url, init]); return fixture(url, init); });
  await client.items(session.user.Id);
  const auth = calls.find(([url]) => url.endsWith('/Users/AuthenticateByName'));
  assert.deepEqual(JSON.parse(auth[1].body), { Username: 'synthetic-user', Pw: 'synthetic-password' });
  const read = calls.at(-1); assert.match(read[1].headers.Authorization, /^MediaBrowser /);
  assert.match(read[1].headers.Authorization, /Token="fictional-session-token"/);
  for (const [url, init] of calls) { assert.ok(!url.includes(session.token)); assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); assert.equal(init.referrerPolicy, 'no-referrer'); }
  client.dispose();
});
test('failed authentication is not retried and server response bodies never become errors', async () => {
  let calls = 0;
  const client = new JellyfinClient(base, 'device', async () => { calls++; return json({ message: 'secret-server-detail' }, 401); });
  await assert.rejects(client.authenticate(fixtureServer, 'u', 'p'), error => error.status === 401 && !error.message.includes('secret'));
  assert.equal(calls, 1); client.dispose();
});
test('authentication rejects changed server identity and malformed tokens', async () => {
  const client = new JellyfinClient(base, 'device', async () => json({ AccessToken: 'fake', ServerId: 'another-server', User: fixtureUser }));
  await assert.rejects(client.authenticate(fixtureServer, 'u', 'p'), /identity changed/); client.dispose();
});
test('version-aware routes, scoped library discovery and selected episode pagination', async () => {
  const calls = []; const fixture = createFixtureFetch();
  const { client, session } = await signed(async (url, init) => { calls.push(url); return fixture(url, init); });
  await client.libraries(session.user.Id); await client.item(session.user.Id, 'fixture-0');
  await client.seasons(session.user.Id, 'fixture-2'); await client.episodes(session.user.Id, 'fixture-2', 'fixture-season-0', 40);
  assert.ok(calls.some(url => url.includes('/UserViews?userId=fixture-user')));
  assert.ok(calls.some(url => url.includes('/Items/fixture-0?userId=fixture-user')));
  assert.ok(calls.some(url => url.includes('seasonId=fixture-season-0') && url.includes('startIndex=40')));
  client.dispose();
  const oldCalls = []; const legacy = new JellyfinClient(base, 'device', async url => { oldCalls.push(url); return url.endsWith('/Views') ? json({ Items: [], TotalRecordCount: 0 }) : json({ Id: 'old-item' }); });
  legacy.restore({ ...session, server: { ...fixtureServer, Version: '10.11.0' } });
  await legacy.libraries('old-user'); await legacy.item('old-user', 'old-item');
  assert.ok(oldCalls[0].endsWith('/Users/old-user/Views')); assert.ok(oldCalls[1].endsWith('/Users/old-user/Items/old-item')); legacy.dispose();
});
test('list query preserves search, library/type filters and deterministic pagination', async () => {
  const { client, session } = await signed();
  const first = await client.items(session.user.Id); const second = await client.items(session.user.Id, { start: 40 });
  assert.equal(first.Items.length, 40); assert.equal(second.Items.length, 40); assert.equal(first.TotalRecordCount, 80);
  assert.equal(new Set([...first.Items,...second.Items].map(i => i.Id)).size, 80);
  const movies = await client.items(session.user.Id, { kind: 'Movie', parentId: 'fixture-movies', search: 'Lunar' });
  assert.ok(movies.Items.length > 0); assert.ok(movies.Items.every(i => i.Type === 'Movie' && i.Name.includes('Lunar')));
  const empty = await client.items(session.user.Id, { search: 'does-not-exist' }); assert.equal(empty.TotalRecordCount, 0); client.dispose();
});
test('in-flight deduplication, TTL expiry, manual invalidation, and account isolation', async () => {
  let count = 0; let now = 0; const fixture = createFixtureFetch();
  const transport = async (url, init) => { if (url.includes('/Items?')) count++; return fixture(url, init); };
  const { client, session } = await signed(transport, undefined, () => now);
  await Promise.all([client.items(session.user.Id), client.items(session.user.Id)]); assert.equal(count, 1);
  await client.items(session.user.Id); assert.equal(count, 1);
  await client.items('other-user'); assert.equal(count, 2);
  now = 300001; await client.items(session.user.Id); assert.equal(count, 3);
  client.invalidate(); await client.items(session.user.Id); assert.equal(count, 4); client.dispose();
});
test('a separate detail cache cannot be downgraded by list projections', async () => {
  const { client, session } = await signed();
  const detail = await client.item(session.user.Id, 'fixture-0'); await client.items(session.user.Id);
  assert.deepEqual(await client.item(session.user.Id, 'fixture-0'), detail); assert.ok(detail.ProviderIds); client.dispose();
});
test('request concurrency is bounded across different page keys', async () => {
  let active = 0, maximum = 0;
  const client = new JellyfinClient(base, 'device', async () => { active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; return json({ Items: [], TotalRecordCount: 0 }); });
  await Promise.all(Array.from({ length: 12 }, (_, i) => client.items('u', { start: i * 40 })));
  assert.ok(maximum <= 4); client.dispose();
});
test('401 invalidates a session, while 403/404 never retry', async () => {
  let unauthorized = 0, reads = 0; const fixture = createFixtureFetch(); let deny = false;
  const { client, session } = await signed(async (url, init) => { if (deny) { reads++; return json({}, 401); } return fixture(url, init); }, () => unauthorized++);
  deny = true; await assert.rejects(client.items(session.user.Id), error => error.status === 401); assert.equal(unauthorized, 1); assert.equal(reads, 1); client.dispose();
  for (const status of [403,404]) { let count = 0; const c = new JellyfinClient(base, 'device', async () => { count++; return json({}, status); }); await assert.rejects(c.items('u'), error => error.status === status); assert.equal(count, 1); c.dispose(); }
});
test('transient GET failure retries once; long Retry-After is not ignored', async () => {
  let count = 0; const client = new JellyfinClient(base, 'device', async () => ++count === 1 ? json({}, 503) : json({ Items: [], TotalRecordCount: 0 }));
  await client.items('u'); assert.equal(count, 2); client.dispose();
  count = 0; const limited = new JellyfinClient(base, 'device', async () => { count++; return json({}, 429, { 'Retry-After': '120' }); });
  await assert.rejects(limited.items('u'), error => error.status === 429); assert.equal(count, 1); limited.dispose();
});
test('malformed DTOs are rejected or normalized without injecting synthetic metadata', async () => {
  assert.deepEqual(parseItem({ Id: 'x', Name: null, Genres: 'Drama', CommunityRating: NaN, People: [null, { Name: '<script>', Type: 'Actor' }], ImageTags: { Primary: 1 } }), { Id: 'x', People: [{ Id: undefined, Name: '<script>', Type: 'Actor', Role: undefined }], ImageTags: {} });
  assert.throws(() => parseItem({ Name: 'Missing ID' }));
  const client = new JellyfinClient(base, 'device', async () => json({ Items: [], TotalRecordCount: 'unknown' })); await assert.rejects(client.items('u'), /invalid collection/); client.dispose();
});
test('image reads use auth headers, deduplicate and negative-cache failures', async () => {
  let calls = 0; const client = new JellyfinClient(base, 'device', async (url, init) => { calls++; assert.ok(!url.includes('api_key')); assert.match(init.headers.Authorization, /^MediaBrowser/); return new Response('art', { headers: { 'Content-Type': 'image/png' } }); });
  await Promise.all([client.image('x', 'Primary','tag', 480), client.image('x','Primary','tag',480)]); assert.equal(calls, 1); client.dispose();
  calls = 0; const missing = new JellyfinClient(base, 'device', async () => { calls++; return json({},404); });
  await assert.rejects(missing.image('x','Primary','tag',480)); await assert.rejects(missing.image('x','Primary','tag',480)); assert.equal(calls,1); missing.dispose();
});
test('coverage distinguishes list projections, missing detail metadata, valid zero and inherited art', () => {
  const item = { Id:'x', Name:'', CommunityRating:0, Type:'Episode', ParentIndexNumber:0, IndexNumber:1, SeriesId:'series', SeriesPrimaryImageTag:'tag' };
  assert.equal(itemTitle(item), 'Untitled episode'); assert.equal(runtime(item), null);
  assert.equal(runtime({ Id:'x', RunTimeTicks:600000000 }), '00:01');
  assert.equal(imageSource(item).inherited,true);
  assert.equal(itemCoverage(item).fields.find(f=>f.field==='cast').state,'unknown');
  assert.equal(itemCoverage(item,true).fields.find(f=>f.field==='rating').state,'present');
  assert.equal(itemCoverage(item,true).fields.find(f=>f.field==='overview').state,'missing');
});
test('session persistence is explicit, bounded and resilient to unavailable storage', async () => {
  const memory = new Map(); const store = { getItem:k=>memory.get(k)??null, setItem:(k,v)=>memory.set(k,v), removeItem:k=>memory.delete(k) };
  const { client, session } = await signed(); assert.equal(loadSession(store), null);
  saveSession(store,session); assert.equal(loadSession(store).token,session.token);
  saveSession(store,{...session,created:Date.now()-13*3600000}); assert.equal(loadSession(store),null);
  memory.set(sessionKey,'invalid json'); assert.equal(loadSession(store),null);
  assert.equal(saveSession({ setItem(){throw Error('blocked');} },session),false);
  saveSession(store,null); assert.equal(memory.has(sessionKey),false); client.dispose();
});
test('logout is POST-only and closing a client prevents further reads', async () => {
  const calls = []; const fixture = createFixtureFetch(); const { client } = await signed(async (url, init) => { calls.push([url,init]); return fixture(url,init); });
  await client.logout(); assert.equal(calls.at(-1)[1].method,'POST'); assert.ok(calls.at(-1)[0].endsWith('/Sessions/Logout'));
  await assert.rejects(client.items('u'),/Connection closed/);
});

test('resuming a tab session checks server identity, account identity and disabled status', async () => {
  const { client: original, session } = await signed(); original.dispose();
  const valid = new JellyfinClient(base, session.deviceId, createFixtureFetch()); valid.restore(session);
  assert.equal((await valid.validateSession(session)).Id, fixtureUser.Id); valid.dispose();
  for (const user of [{ Id:'different-user' }, { ...fixtureUser, Policy:{ IsDisabled:true } }]) {
    const c = new JellyfinClient(base, session.deviceId, async url => url.endsWith('/System/Info/Public') ? json(fixtureServer) : json(user)); c.restore(session);
    await assert.rejects(c.validateSession(session), error => error.status === 403); c.dispose();
  }
  const moved = new JellyfinClient(base, session.deviceId, async () => json({ ...fixtureServer, Id:'another-server' })); moved.restore(session);
  await assert.rejects(moved.validateSession(session), /identity changed/); moved.dispose();
});
test('zero or invalid release dates/runtime are omitted while legitimate zero ratings and specials survive', () => {
  const item = parseItem({ Id:'x', ProductionYear:0, RunTimeTicks:-1, CommunityRating:0, ParentIndexNumber:0, IndexNumber:-1, CriticRating:101 });
  assert.equal(item.ProductionYear,undefined); assert.equal(item.RunTimeTicks,undefined); assert.equal(item.CriticRating,undefined);
  assert.equal(item.CommunityRating,0); assert.equal(item.ParentIndexNumber,0); assert.equal(item.IndexNumber,undefined);
});

test('default browser fetch is called without a JellyfinClient receiver', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  // Native browser fetch rejects a foreign receiver; Node and injected arrow mocks do not.
  globalThis.fetch = function () {
    assert.ok(this === undefined || this === globalThis, 'Browser fetch must not receive the client object as this');
    calls++;
    return Promise.resolve(json(fixtureServer));
  };
  const client = new JellyfinClient(base, 'browser-binding-regression');
  try { assert.equal((await client.probe()).Id, fixtureServer.Id); assert.equal(calls, 1); }
  finally { client.dispose(); globalThis.fetch = originalFetch; }
});
