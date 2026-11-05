import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rasterType,prepareArtwork,MAX_ARTWORK_BYTES} from '../src/components/customArtwork.ts';
import {headingCase} from '../src/components/headingCase.ts';
import {JellyfinClient} from '../src/jellyfin/client.ts';

test('custom artwork accepts raster signatures and rejects SVG or disguised active content',async()=>{
 assert.equal(rasterType(new Uint8Array([255,216,255,224])),'image/jpeg');
 assert.equal(rasterType(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
 assert.equal(rasterType(new TextEncoder().encode('RIFF0000WEBP')),'image/webp');
 for(const content of ['<svg onload="alert(1)"/>','<html>test</html>','not an image']){
   assert.equal(rasterType(new TextEncoder().encode(content)),undefined);
   await assert.rejects(prepareArtwork(new Blob([content],{type:'image/jpeg'}),'banner'),/JPG, PNG or WebP/);
 }
 await assert.rejects(prepareArtwork(new Blob([]),'card'),/under 10 MB/);
 await assert.rejects(prepareArtwork(new Blob([new Uint8Array(MAX_ARTWORK_BYTES+1)]),'card'),/under 10 MB/);
});
test('card catalogue uses primary posters and never includes banners or arbitrary external URLs',async()=>{
 const calls=[];const images=[
  {ProviderName:'TheMovieDb',Type:'Primary',Width:2000,Height:3000,Url:'https://image.tmdb.org/t/p/original/poster.jpg'},
  {ProviderName:'TheMovieDb',Type:'Backdrop',Width:3840,Height:2160,Url:'https://image.tmdb.org/t/p/original/banner.jpg'},
  {ProviderName:'TheMovieDb',Type:'Primary',Width:2000,Height:3000,Url:'https://evil.invalid/poster.jpg'}
 ];
 const client=new JellyfinClient('https://server.invalid','device',async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({Images:images}),{headers:{'Content-Type':'application/json'}});});
 const posters=await client.remotePosters({Id:'title',Type:'Movie',ProviderIds:{Tmdb:'123'}});
 assert.equal(posters.length,1);assert.match(posters[0].url,/poster.jpg$/);assert.equal(new URL(calls[0].url).searchParams.get('type'),'Primary');assert.equal(calls[0].init.method,'GET');client.dispose();
});
test('interface headings use title case without damaging acronyms, apostrophes or stored section titles',()=>{
 const stored='Browse your collection';assert.equal(headingCase(stored),'Browse Your Collection');assert.equal(stored,'Browse your collection');
 assert.equal(headingCase('UI & text size'),'UI & Text Size');
 assert.equal(headingCase("what's on TV?"),"What's On TV?");
 assert.equal(headingCase('TMDb & IMDb metadata'),'TMDb & IMDb Metadata');
});
