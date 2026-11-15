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

test('installed font check registers a CSS-usable local alias without fetching a font',async()=>{
 const {installedFontFamily}=await import('../src/appearance/fonts.ts');
 const previousFace=globalThis.FontFace,previousDocument=Object.getOwnPropertyDescriptor(globalThis,'document');const added=[];
 try{
  globalThis.FontFace=class{constructor(family,source){this.family=family;this.source=source;}async load(){assert.ok(this.source.startsWith('local("Agrave Pro")'));assert.doesNotMatch(this.source,/url\(/);return this;}};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{fonts:{add:face=>added.push(face)}}});
  assert.equal(await installedFontAvailable('Agrave Pro'),true);assert.equal(added.length,1);
  assert.ok(installedFontFamily('Agrave Pro').includes(JSON.stringify(added[0].family)));
  assert.equal(await installedFontAvailable('Agrave Pro'),true);assert.equal(added.length,1);
  assert.equal(installedFontFamily('url(https://unsafe.invalid/font)'),'system-ui, sans-serif');
 }finally{if(previousFace)globalThis.FontFace=previousFace;else delete globalThis.FontFace;if(previousDocument)Object.defineProperty(globalThis,'document',previousDocument);else delete globalThis.document;}
});

test('subtitle custom family survives preferences serialization independently of the app font',async()=>{
 const {captionPreferences,captionAppearance}=await import('../src/playback/preferences.ts');
 const saved=captionPreferences({version:2,font:'custom',customFont:' Agrave Pro ',size:120,background:false,opacity:50});
 assert.equal(saved.customFont,'Agrave Pro');assert.deepEqual(captionPreferences(JSON.parse(JSON.stringify(saved))),saved);
 assert.match(captionAppearance(saved).fontFamily,/frame-local-/);assert.match(captionAppearance(saved).fontFamily,/Agrave Pro/);
 assert.equal(captionPreferences({font:'custom',customFont:'Arial; color:red'}).customFont,undefined);
 assert.equal(captionAppearance(captionPreferences({version:2,font:'custom'})).fontFamily,'var(--custom-font), system-ui, sans-serif');
});

test('static font families resolve a Regular full face name when the bare family is unavailable',async()=>{
 const previousFace=globalThis.FontFace;const sources=[];
 try{
  globalThis.FontFace=class{constructor(_family,source){this.source=source;}async load(){sources.push(this.source);if(!this.source.includes('local("Saira SemiExpanded Regular")'))throw Error('Only full face name installed');return this;}};
  assert.equal(await installedFontAvailable('Saira SemiExpanded'),true);
  assert.match(sources[0],/local\("Saira SemiExpanded Regular"\)/);
  assert.match(sources[0],/local\("SairaSemiExpanded-Regular"\)/);
  assert.doesNotMatch(sources[0],/url\(/);
  assert.equal(await installedFontAvailable('Definitely Missing Family'),false);
 }finally{if(previousFace)globalThis.FontFace=previousFace;else delete globalThis.FontFace;}
});

test('explicit Regular face names resolve the corresponding PostScript name without doubling the style',async()=>{
 const previousFace=globalThis.FontFace;
 try{
  globalThis.FontFace=class{constructor(_family,source){this.source=source;}async load(){assert.match(this.source,/local\("SairaExtraCondensed-Regular"\)/);assert.doesNotMatch(this.source,/Regular-Regular|Regular Regular/);return this;}};
  assert.equal(await installedFontAvailable('Saira ExtraCondensed Regular'),true);
 }finally{if(previousFace)globalThis.FontFace=previousFace;else delete globalThis.FontFace;}
});

test('a stalled local font probe settles as unknown and can be retried',async()=>{
 const previousFace=globalThis.FontFace;
 try{
  globalThis.FontFace=class{load(){return new Promise(()=>{});}};
  assert.equal(await installedFontAvailable('Stalled Font Probe'),null);
  globalThis.FontFace=class{async load(){return this;}};
  assert.equal(await installedFontAvailable('Stalled Font Probe'),true);
 }finally{if(previousFace)globalThis.FontFace=previousFace;else delete globalThis.FontFace;}
});
