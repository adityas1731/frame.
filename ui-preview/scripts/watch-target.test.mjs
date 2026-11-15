import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {watchTarget}=await server.ssrLoadModule('/src/playback/watchTarget.ts');
const session={baseUrl:'https://fixture.invalid',server:{Id:'server'},user:{Id:'viewer'}};
const series={Id:'series',Type:'Series'};
const episode=(Id,season,index,ticks,date)=>({Id,Type:'Episode',SeriesId:'series',ParentIndexNumber:season,IndexNumber:index,RunTimeTicks:36000000000,UserData:{PlaybackPositionTicks:ticks,LastPlayedDate:date}});
const first=episode('first',1,1,0);
function client(overrides={}){return {items:async()=>({Items:[]}),itemsById:async()=>({Items:[]}),nextUp:async()=>({Items:[first]}),seasons:async()=>({Items:[{Id:'season1',IndexNumber:1}]}),episodes:async()=>({Items:[first]}),...overrides};}
test('a series resumes the saved episode instead of S1 Ep1 from Next Up',async()=>{
 const saved=episode('saved',3,7,1200000000,'2026-11-14T12:00:00Z');
 const result=await watchTarget(client({items:async(user,query)=>{assert.equal(user,'viewer');assert.equal(query.parentId,'series');assert.equal(query.kind,'Episode');assert.equal(query.resume,true);assert.equal(query.sort,'DatePlayed');return {Items:[saved]};},nextUp:()=>assert.fail('unfinished playback takes precedence')}),session,series,[]);
 assert.equal(result.Id,'saved');assert.equal(result.ParentIndexNumber,3);assert.equal(result.IndexNumber,7);assert.equal(result.UserData.PlaybackPositionTicks,1200000000);
});
test('short-start progress resolves only accessible episodes from the same series',async()=>{
 const recent=episode('short',2,4,0,'2026-11-13T00:00:00Z');
 const record={id:'short',position:5,duration:3600,updated:Date.parse('2026-11-14T12:00:00Z')};
 const result=await watchTarget(client({itemsById:async(user,ids,parent,types)=>{assert.equal(parent,'series');assert.equal(types,'Episode');assert.deepEqual(ids,['short']);return {Items:[recent]};}}),session,series,[record]);
 assert.equal(result.Id,'short');assert.equal(result.UserData.PlaybackPositionTicks,50000000);
});
test('most recently played unfinished episode wins across server and short-start records',async()=>{
 const older=episode('older',1,6,100000000,'2026-11-13T12:00:00Z');
 const recent=episode('recent',2,1,0,'2026-11-12T12:00:00Z');
 const result=await watchTarget(client({items:async()=>({Items:[older]}),itemsById:async()=>({Items:[recent]})}),session,series,[{id:'recent',position:8,duration:3600,updated:Date.parse('2026-11-14T12:00:00Z')}]);
 assert.equal(result.Id,'recent');
});
test('newly completed local progress does not override the next episode',async()=>{
 const completed=episode('finished',1,2,0,'2026-11-14T13:00:00Z');completed.UserData.Played=true;
 const result=await watchTarget(client({itemsById:async()=>({Items:[completed]})}),session,series,[{id:'finished',position:5,duration:3600,updated:Date.parse('2026-11-14T12:00:00Z')}]);assert.equal(result.Id,'first');
});
test('another series cannot supply the resume target',async()=>{
 const other={...episode('other',1,9,50000000),SeriesId:'another'};
 const result=await watchTarget(client({items:async()=>({Items:[other]})}),session,series,[]);assert.equal(result.Id,'first');
});
test('without progress or Next Up, a new series still opens its first episode',async()=>{
 const result=await watchTarget(client({nextUp:async()=>({Items:[]})}),session,series,[]);assert.equal(result.Id,'first');
});
test('direct movies and episode buttons preserve their exact target without series queries',async()=>{
 const movie={Id:'movie',Type:'Movie'};const direct=episode('direct',2,3,50000000);
 const noQueries=client({items:()=>assert.fail('not a series')});
 assert.equal(await watchTarget(noQueries,session,movie,[]),movie);assert.equal(await watchTarget(noQueries,session,direct,[]),direct);
});
