import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JellyfinClient} from '../src/jellyfin/client.ts';
import {validFontName,customFontFamily,installedFontAvailable} from '../src/appearance/fonts.ts';
const item={Id:'title',Type:'Movie',ProviderIds:{Tmdb:'123'}};
const image='https://image.tmdb.org/t/p/original/banner.jpg';
function setup({admin=true,fail=false}={}){
 const calls=[];let saved=false;
 const client=new JellyfinClient('https://server.invalid','device',async(url,init)=>{
  const path=new URL(url).pathname;calls.push({url,init});
  if(path==='/Users/Me')return Response.json({Id:'admin',Name:'Test',Policy:{IsAdministrator:admin}});
  if(path.endsWith('/RemoteImages'))return Response.json({Images:[{ProviderName:'TheMovieDb',Type:'Backdrop',Width:3840,Height:2160,Url:image}]});
  if(path.endsWith('/Images'))return Response.json([{ImageType:'Backdrop',ImageIndex:0,ImageTag:'old'},...(saved?[{ImageType:'Backdrop',ImageIndex:1,ImageTag:'new'}]:[])]);
  if(init.method==='POST'){if(fail)return new Response(null,{status:403});saved=true;return new Response(null,{status:204});}
  throw Error('Unexpected request');
 });return {client,calls};
}
test('shared banner selection saves exact provider artwork and promotes the added backdrop without deleting images',async()=>{
 const {client,calls}=setup();await client.saveSharedArtwork(item,'banner',image);
 const writes=calls.filter(c=>c.init.method!=='GET');assert.equal(writes.length,2);
 assert.match(writes[0].url,/RemoteImages\/Download/);assert.equal(new URL(writes[0].url).searchParams.get('imageUrl'),image);
 assert.match(writes[1].url,/Backdrop\/1\/Index\?newIndex=0$/);assert.ok(calls.every(c=>c.init.method!=='DELETE'));client.dispose();
});
test('shared card uploads the processed JPEG as base64 with the correct content type',async()=>{
 const {client,calls}=setup();const blob=new Blob([new Uint8Array([255,216,255,224,0])],{type:'image/jpeg'});
 await client.saveSharedArtwork(item,'card',blob);const write=calls.find(c=>c.init.method==='POST');
 assert.match(write.url,/Images\/Primary$/);assert.equal(write.init.headers['Content-Type'],'image/jpeg');assert.equal(write.init.body,'/9j/4AA=');client.dispose();
});
test('ordinary accounts cannot perform shared artwork writes',async()=>{const {client,calls}=setup({admin:false});await assert.rejects(client.saveSharedArtwork(item,'card',new Blob()),/administrator/);assert.ok(calls.every(c=>c.init.method==='GET'));client.dispose();});
test('arbitrary remote URLs and invalid image payloads cannot be saved',async()=>{const {client,calls}=setup();await assert.rejects(client.saveSharedArtwork(item,'banner','https://evil.invalid/image.jpg'),/provider artwork/);await assert.rejects(client.saveSharedArtwork(item,'card',new Blob(['bad'],{type:'image/jpeg'})),/valid JPEG/);assert.ok(calls.every(c=>c.init.method==='GET'));client.dispose();});
test('server permission rejection does not retry artwork mutations',async()=>{const {client,calls}=setup({fail:true});await assert.rejects(client.saveSharedArtwork(item,'banner',image),/permission/);assert.equal(calls.filter(c=>c.init.method==='POST').length,1);client.dispose();});
test('custom font names accept international names and safely reject CSS or URL input',()=>{assert.ok(validFontName('Noto Sans'));assert.ok(validFontName('ＭＳ ゴシック'));assert.equal(customFontFamily('  Noto Sans  '),'"Noto Sans"');for(const value of ['','url(https://example.com/font)','Arial; color:red','Arial, serif'])assert.equal(validFontName(value),false);});
test('font availability uses local loading rather than fallback-permitting fonts.check',async()=>{const previous=globalThis.FontFace;try{globalThis.FontFace=class{constructor(_name,source){this.source=source;}async load(){if(!this.source.includes('Verdana'))throw Error('Missing');return this;}};assert.equal(await installedFontAvailable('Verdana'),true);assert.equal(await installedFontAvailable('Missing Font'),false);}finally{if(previous)globalThis.FontFace=previous;else delete globalThis.FontFace;}});
