import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identificationQuery,identificationResults} from '../src/jellyfin/identification.ts';
import {JellyfinClient} from '../src/jellyfin/client.ts';
const candidate={Name:'The Office',ProductionYear:2005,SearchProviderName:'TheMovieDb',ProviderIds:{Imdb:'tt0386676',Tmdb:'2316'}};
test('provider links are parsed locally; hostile links and wrong types rejected',()=>{
 assert.deepEqual(identificationQuery('https://www.imdb.com/title/tt0386676/','Series'),{ProviderIds:{Imdb:'tt0386676'}});
 assert.deepEqual(identificationQuery('https://www.themoviedb.org/tv/2316-the-office','Series'),{ProviderIds:{Tmdb:'2316'}});
 assert.deepEqual(identificationQuery('The Office','Series','2005'),{Name:'The Office',Year:2005});
 for(const value of ['https://evil.test/title/tt0386676','https://imdb.com.evil.test/title/tt0386676','https://user:pass@imdb.com/title/tt0386676','https://imdb.com/title/tt0386676?token=secret','https://www.themoviedb.org/movie/2316'])assert.throws(()=>identificationQuery(value,'Series'));
 assert.throws(()=>identificationQuery('Office','Series','bad'));assert.throws(()=>identificationQuery('','Movie'));
});
test('malformed and unidentified candidates are excluded',()=>{
 const rows=identificationResults([null,{},candidate,{Name:'no ID',ProviderIds:{}}]);assert.equal(rows.length,1);assert.equal(rows[0].Name,candidate.Name);assert.deepEqual(rows[0].ProviderIds,candidate.ProviderIds);assert.throws(()=>identificationResults({}));
});
function setup(admin=true,status=204){const calls=[];const client=new JellyfinClient('http://localhost:18096/jellyfin','device',async(url,init)=>{calls.push({url,init});if(url.endsWith('/Users/Me'))return Response.json({Id:'admin',Policy:{IsAdministrator:admin}});if(url.includes('/Apply/'))return new Response(null,{status});return Response.json([candidate]);});return {client,calls};}
test('ordinary users cannot perform identification searches or writes',async()=>{
 const {client,calls}=setup(false);await assert.rejects(client.searchIdentification('item','Series',{Name:'Office'}),/administrator/);assert.equal(calls.length,1);await assert.rejects(client.applyIdentification('item',candidate,false),/Search again/);client.dispose();
});
test('only selected result for searched item can apply, with explicit image policy',async()=>{
 const {client,calls}=setup();const rows=await client.searchIdentification('item','Series',{Name:'Office'});await assert.rejects(client.applyIdentification('other',rows[0],true),/Search again/);await client.applyIdentification('item',rows[0],false);
 assert.equal(calls.at(-1).url,'http://localhost:18096/jellyfin/Items/RemoteSearch/Apply/item?replaceAllImages=false');assert.deepEqual(JSON.parse(calls.at(-1).init.body),candidate);assert.equal(calls.at(-1).init.method,'POST');await assert.rejects(client.applyIdentification('item',rows[0],false));client.dispose();
});
test('failed write is not retried or immediately submitted twice',async()=>{
 const {client,calls}=setup(true,500);const rows=await client.searchIdentification('item','Movie',{ProviderIds:{Imdb:'tt0386676'}});await assert.rejects(client.applyIdentification('item',rows[0],true));await assert.rejects(client.applyIdentification('item',rows[0],true));assert.equal(calls.filter(c=>c.url.includes('/Apply/')).length,1);client.dispose();
});
