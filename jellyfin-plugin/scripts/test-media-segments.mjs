/** Real native endpoint, fixed disposable server guard inherited from test-api. */
import {api,base} from './test-api.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {JellyfinClient} from '../../ui-preview/src/jellyfin/client.ts';
import {session} from './test-api.mjs';
const items=(await api('Items?recursive=true&includeItemTypes=Movie,Episode&limit=10')).Items;
const fixture=items.filter(item=>['Frame Test Film','First Signal'].includes(item.Name));
assert.equal(fixture.length,2);
const client=new JellyfinClient(base,'frame-segments-test');
client.restore({token:session.token,server:{Version:'12.3.0'}});
try{
 for(const item of fixture){
  const segments=await client.mediaSegments(item.Id);
  assert.equal(segments.length,5);
  assert.deepEqual(segments.map(s=>s.type),['Recap','Intro','Commercial','Preview','Outro']);
  assert.equal(segments.find(s=>s.type==='Intro').end,15);
  assert.equal((await fetch(`${base}/MediaSegments/${item.Id}`)).status,401);
 }
 const other=items.find(item=>!fixture.some(f=>f.Id===item.Id));assert.ok(other);
 assert.deepEqual(await client.mediaSegments(other.Id),[]);
 const result={status:'passed',server:'disposable Jellyfin 12.3',fixtureItems:2,types:5,authenticatedNativeDto:true,anonymousDenied:true,otherItemEmpty:true,productionContacted:false};
 await writeFile(new URL('../../.local/reports/media-segments.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{client.dispose();}
