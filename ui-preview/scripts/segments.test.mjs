import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSegments,activeSegment,SegmentSkipper,skippingPreferences,loadSkipping,saveSkipping} from '../src/playback/segments.ts';
import {JellyfinClient} from '../src/jellyfin/client.ts';
const id='11111111111111111111111111111111';
const raw=(Type='Intro',start=5,end=15)=>({ItemId:id,Type,StartTicks:start*1e7,EndTicks:end*1e7});
const parse=(...Items)=>parseSegments({Items},id);
const defaults=skippingPreferences(null);
test('live GoT credits endpoint survives browser floating-point representation',()=>{
 const segments=parse(raw('Outro',3063.06,3142.986));
 const duration=3142.985999999985;
 const selected=activeSegment(segments,3079.058764,duration,defaults,3142.986);
 assert.equal(selected?.type,'Outro');assert.equal(selected?.end,duration);
 assert.equal(selected?.start,3063.06);
});
test('credits survive sub-second container rounding, with bounded seek and stable identity',()=>{
 const segments=parse(raw('Outro',3063.06,3142.986));
 const active=activeSegment(segments,3065,3142.95,defaults,3142.986);
 assert.equal(active?.type,'Outro');assert.equal(active?.end,3142.95);
 assert.equal(active?.key,segments[0].key);assert.equal(segments[0].end,3142.986);
 assert.equal(activeSegment(segments,3142.95,3142.95,defaults,3142.986),undefined);
 assert.equal(new SegmentSkipper().automatic(active,{...defaults,Outro:'auto'},true),3142.95);
});
test('different cuts and substantial overflow are rejected without scaling',()=>{
 const segments=parse(raw('Intro',9.051,117.117),raw('Outro',3063.06,3142.986));
 assert.equal(activeSegment(segments,20,3000,defaults,3142.986),undefined);
 assert.equal(activeSegment(segments,3065,3140,defaults,3142.986),undefined);
 assert.equal(activeSegment(parse(raw('Intro',90,100.01)),95,100,defaults),undefined);
 assert.equal(activeSegment(parse(raw('Outro',90,100.501)),95,100,defaults),undefined);
 assert.equal(activeSegment(segments,3065,3142.986,{...defaults,Outro:'off'},3142.986),undefined);
});
test('credits rounding works on resume and absolute transcode timeline',()=>{
 const segments=parse(raw('Outro',90,100.2));
 for(const position of [90,95,99.9])assert.equal(activeSegment(segments,position,100,defaults,100.2)?.end,100);
 assert.equal(activeSegment(segments,89,100,defaults,100.2),undefined);
 assert.equal(activeSegment(segments,95,100,defaults,NaN),undefined);
});
test('native segments: validate identity, ticks, type, duplicates and duration',()=>{
 assert.equal(parse(raw(),raw(),raw('Recap',0,5),raw('Outro',90,100)).length,3);
 for(const value of [null,{},[],{Items:'bad'}])assert.deepEqual(parseSegments(value,id),[]);
 for(const invalid of [{...raw(),ItemId:'other'},raw('Unknown'),raw('Intro',-1,5),raw('Intro',6,5),{...raw(),EndTicks:Infinity},{...raw(),StartTicks:'0'},raw('Intro',0,1e12)])assert.deepEqual(parse(invalid),[]);
 assert.equal(activeSegment(parse(raw()),5,100,defaults)?.end,15);
 assert.equal(activeSegment(parse(raw()),15,100,defaults),undefined);
 assert.equal(activeSegment(parse(raw('Outro',90,101)),95,100,defaults),undefined);
 assert.equal(activeSegment(parse(raw()),6,NaN,defaults),undefined);
});
test('mid-intro start, resume and seeks reevaluate half-open item timeline',()=>{
 const segments=parse(raw(),raw('Intro',30,40),raw('Recap',0,5),raw('Outro',90,100));
 for(const position of [6,9,14.99])assert.equal(activeSegment(segments,position,100,defaults)?.type,'Intro');
 for(const position of [15,29,40,100])assert.equal(activeSegment(segments,position,100,defaults),undefined);
 assert.equal(activeSegment(segments,32,100,defaults)?.end,40);
 assert.equal(activeSegment(segments,93,100,defaults)?.type,'Outro');
 assert.equal(activeSegment(segments,2,100,defaults)?.type,'Recap');
});
test('deterministic overlap never chains beyond known boundaries; auto attempts once',()=>{
 const segments=parse(raw('Intro',0,20),raw('Recap',0,10),raw('Intro',10,30));
 const prefs={...defaults,Intro:'auto',Recap:'auto'};const skipper=new SegmentSkipper();
 const first=activeSegment(segments,5,100,prefs);assert.equal(first.type,'Recap');
 assert.equal(skipper.automatic(first,prefs,false),undefined);
 assert.equal(skipper.automatic(first,prefs,true),10);
 assert.equal(skipper.automatic(first,prefs,true),undefined);
 assert.equal(new SegmentSkipper().automatic(first,prefs,true),10);
 assert.equal(skipper.automatic(segments[1],defaults,true),undefined);
 assert.equal(activeSegment(segments,5,100,{...prefs,Intro:'off',Recap:'off'}),undefined);
});
test('skipping preferences are server/account scoped, explicit and validated',()=>{
 const entries=new Map();const storage={getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v)};
 assert.deepEqual(loadSkipping('server:user1',storage),defaults);
 assert.equal(defaults.Intro,'button');assert.equal(defaults.Preview,'off');assert.equal(defaults.Commercial,'off');
 saveSkipping('server:user1',{...defaults,Intro:'auto'},storage);
 assert.equal(loadSkipping('server:user1',storage).Intro,'auto');
 assert.equal(loadSkipping('server:user2',storage).Intro,'button');
 assert.equal(loadSkipping('other:user1',storage).Intro,'button');
 assert.equal(skippingPreferences({Intro:'evil',Outro:true}).Intro,'button');
 assert.deepEqual(loadSkipping('broken',{getItem(){throw Error();}}),defaults);
});
test('all five types are independently selectable, including GUID formatting differences',()=>{
 const prefs={Intro:'off',Recap:'off',Outro:'off',Preview:'button',Commercial:'auto'};
 const segments=parse(raw('Preview',0,5),raw('Commercial',10,20));
 assert.equal(activeSegment(segments,1,100,prefs)?.type,'Preview');
 assert.equal(new SegmentSkipper().automatic(activeSegment(segments,12,100,prefs),prefs,true),20);
 const formatted={...raw(),ItemId:'11111111-1111-1111-1111-111111111111'};
 assert.equal(parse(formatted).length,1);
});
test('malformed optional response is cached without inventing segment boundaries',async()=>{
 let calls=0;const client=new JellyfinClient('http://localhost:18096','test',async()=>{calls++;return Response.json({error:'unsupported'});});
 assert.deepEqual(await client.mediaSegments(id),[]);assert.deepEqual(await client.mediaSegments(id),[]);assert.equal(calls,1);client.dispose();
});
test('optional segment API is authenticated, BaseUrl aware, deduplicated and briefly cached',async()=>{
 let calls=0;let now=0;const client=new JellyfinClient('http://localhost:18096/jellyfin','test',async(url,init)=>{
  calls++;assert.equal(url,`http://localhost:18096/jellyfin/MediaSegments/${id}`);assert.match(init.headers.Authorization,/Token=/);
  return Response.json({Items:[raw()]});
 },()=>assert.fail('optional failure must not log out'),()=>now);
 client.restore({token:'synthetic-test-token',server:{Version:'12.3.0'}});
 const results=await Promise.all([client.mediaSegments(id),client.mediaSegments(id)]);assert.equal(calls,1);assert.equal(results[0][0].end,15);
 await client.mediaSegments(id);assert.equal(calls,1);now=60001;await client.mediaSegments(id);assert.equal(calls,2);client.dispose();
});
for(const status of [401,403,404])test(`optional segments ${status} never fails playback or expires session`,async()=>{
 let calls=0;const client=new JellyfinClient('http://localhost:18096','test',async()=>{calls++;return new Response(null,{status});},()=>assert.fail('unexpected logout'));
 client.restore({token:'synthetic-test-token',server:{Version:'12.3.0'}});
 assert.deepEqual(await client.mediaSegments(id),[]);assert.deepEqual(await client.mediaSegments(id),[]);assert.equal(calls,1);client.dispose();
});
for(const [status,expected] of [[401,'restricted'],[403,'restricted'],[404,'unsupported'],[500,'unavailable']])test(`segment availability distinguishes HTTP ${status} from missing timings`,async()=>{
 const client=new JellyfinClient('http://localhost:18096','test',async()=>new Response(null,{status}),()=>assert.fail('optional status must not expire sign-in'));
 client.restore({token:'synthetic-test-token',server:{Version:'12.3.0'}});
 assert.deepEqual(await client.mediaSegmentInfo(id),{status:expected,segments:[]});assert.deepEqual(await client.mediaSegments(id),[]);client.dispose();
});
test('segment availability reports a successful empty result and shares cached requests',async()=>{
 let calls=0;const client=new JellyfinClient('http://localhost:18096','test',async()=>{calls++;return Response.json({Items:[]});});
 const [info,segments]=await Promise.all([client.mediaSegmentInfo(id),client.mediaSegments(id)]);
 assert.deepEqual(info,{status:'ready',segments:[]});assert.deepEqual(segments,[]);assert.equal(calls,1);client.dispose();
});
test('malformed segment availability never claims that the server returned no timings',async()=>{
 const client=new JellyfinClient('http://localhost:18096','test',async()=>Response.json({unrelated:true}));
 assert.deepEqual(await client.mediaSegmentInfo(id),{status:'unavailable',segments:[]});client.dispose();
});
test('explicit timing refresh bypasses the cache without repeated requests',async()=>{
 let calls=0;const client=new JellyfinClient('http://localhost:18096','test',async()=>Response.json({Items:++calls===1?[]:[raw()]}));
 assert.equal((await client.mediaSegmentInfo(id)).segments.length,0);assert.equal((await client.refreshMediaSegments(id)).segments.length,1);
 assert.equal((await client.mediaSegments(id)).length,1);assert.equal(calls,2);client.dispose();
});
