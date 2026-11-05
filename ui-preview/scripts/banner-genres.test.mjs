import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bannerChoiceKey,safeBannerUrl} from '../src/components/bannerChoice.ts';
import {displayGenres,genreCandidates,refineGenrePage,independentGenreChoices,genreSectionItems} from '../src/providers/genres.ts';
import {mergeMetadata} from '../src/providers/metadata.ts';
import {JellyfinClient} from '../src/jellyfin/client.ts';

test('broad genre buckets do not classify fantasy as science fiction or adventure as action',()=>{
 const server=['Sci-Fi & Fantasy','Drama','Action & Adventure'];
 assert.deepEqual(displayGenres(server,['Drama','Adventure','Fantasy']),['Fantasy','Drama','Adventure']);
 assert.deepEqual(displayGenres(server,['Science-Fiction','Action']),['Sci-Fi','Drama','Action']);
 assert.deepEqual(displayGenres(server),['Drama']);
 assert.deepEqual(server,['Sci-Fi & Fantasy','Drama','Action & Adventure']);
});
test('separate explicit genres and punctuation remain intact; only known buckets are refined',()=>{
 assert.deepEqual(displayGenres(['Sci-Fi','Fantasy','Action','Adventure','Comedy & Romance','Sci-Fi']),['Sci-Fi','Fantasy','Action','Adventure','Comedy & Romance']);
 const item={Id:'x',Type:'Series',Genres:['Sci-Fi & Fantasy']};
 assert.deepEqual(mergeMetadata(item,{id:82,kind:'tv',source:'',cast:[],genres:['Fantasy']}).item.Genres,['Fantasy']);
 assert.deepEqual(item.Genres,['Sci-Fi & Fantasy']);
 assert.equal(genreCandidates('Fantasy'),'Fantasy|Sci-Fi & Fantasy');
 assert.equal(genreCandidates('Adventure'),'Adventure|Action & Adventure');
});
test('banner preferences are account/title/provider scoped and accept only credential-free trusted artwork',()=>{
 const url='https://image.tmdb.org/t/p/original/art.jpg';assert.equal(safeBannerUrl(url),url);
 for(const bad of ['javascript:alert(1)','https://evil.invalid/a.jpg',url+'?api_key=private',url+'#x','https://user@image.tmdb.org/t/p/original/art.jpg'])assert.equal(safeBannerUrl(bad),undefined);
 assert.notEqual(bannerChoiceKey('a','b','c','1'),bannerChoiceKey('a','b','c','2'));
 assert.notEqual(bannerChoiceKey('a','b','c','1'),bannerChoiceKey('a','other','c','1'));
});
test('genre browsing excludes fantasy-only titles from Sci-Fi and preserves candidate paging',async()=>{
 const page={Items:[{Id:'fantasy',Genres:['Sci-Fi & Fantasy']},{Id:'scifi',Genres:['Science Fiction']},{Id:'unknown',Genres:['Sci-Fi & Fantasy']}],TotalRecordCount:81};
 const calls=[];const enrich=async item=>{calls.push(item.Id);if(item.Id==='unknown')throw Error('unavailable');return {genres:['Drama','Fantasy']};};
 const result=await refineGenrePage(page,'Sci-Fi',enrich);
 assert.deepEqual(result.Items.map(item=>item.Id),['scifi']);assert.equal(result.candidateCount,3);assert.equal(result.TotalRecordCount,81);
 assert.deepEqual(calls,['fantasy','unknown']);assert.deepEqual(page.Items[0].Genres,['Sci-Fi & Fantasy']);
 assert.deepEqual((await refineGenrePage(page,'Fantasy',enrich)).Items.map(item=>item.Id),['fantasy']);
});
test('offline genre browsing never invents memberships from broad provider buckets',async()=>{
 const result=await refineGenrePage({Items:[{Id:'unknown',Genres:['Sci-Fi & Fantasy']},{Id:'explicit',Genres:['Fantasy']}],TotalRecordCount:2},'Fantasy');
 assert.deepEqual(result.Items.map(item=>item.Id),['explicit']);assert.equal(result.candidateCount,2);
});
test('backdrop picker exposes distinct HD candidates from the read-only exact-item catalogue',async()=>{
 const calls=[];const images=['a','b','a'].map(name=>({ProviderName:'TheMovieDb',Type:'Backdrop',Width:3840,Height:2160,Url:`https://image.tmdb.org/t/p/original/${name}.jpg`}));
 images.push({...images[0],Url:'https://evil.invalid/private.jpg'});
 const client=new JellyfinClient('https://server.invalid','device',async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({Images:images}),{headers:{'Content-Type':'application/json'}});});
 const item={Id:'exact-item',Type:'Series',ProviderIds:{Tmdb:'1399'}};
 assert.equal((await client.remoteBackdrops(item)).length,2);await client.remoteBackdrop(item);
 assert.equal(calls.length,1);assert.equal(calls[0].init.method,'GET');assert.match(calls[0].url,/Items\/exact-item\/RemoteImages/);
 client.dispose();
});


test('section genre choices separate real provider buckets without adding unrelated genres',()=>{
 assert.deepEqual(independentGenreChoices(['Sci-Fi & Fantasy','Science Fiction','Drama','Action & Adventure']),['Action','Adventure','Drama','Fantasy','Sci-Fi']);
 assert.deepEqual(independentGenreChoices(['Comedy']),['Comedy']);
});
test('genre sections verify ambiguous classifications and fill past rejected candidate pages',async()=>{
 const calls=[];const fantasy={Id:'fantasy',Genres:['Sci-Fi & Fantasy']},scifi={Id:'scifi',Genres:['Sci-Fi & Fantasy']},unknown={Id:'unknown',Genres:['Sci-Fi & Fantasy']};
 const load=async start=>{calls.push(start);return {Items:start===0?[fantasy,unknown]:[scifi],TotalRecordCount:3};};
 const enrich=async item=>item.Id==='fantasy'?{genres:['Fantasy','Drama']}:item.Id==='scifi'?{genres:['Science Fiction']}:null;
 const result=await genreSectionItems(load,'Sci-Fi',1,enrich);assert.deepEqual(result.map(item=>item.Id),['scifi']);assert.deepEqual(calls,[0,2]);
 assert.deepEqual((await genreSectionItems(load,'Fantasy',1,enrich)).map(item=>item.Id),['fantasy']);assert.deepEqual(fantasy.Genres,['Sci-Fi & Fantasy']);
});
