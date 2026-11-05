import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QRCodeSVG} from 'qrcode.react';
import {selectedFrameUrl,suggestedFrameUrl,loopbackHost} from '../src/access/url.ts';
import {parseDeviceSessions,visibleDeviceSessions,currentDevice} from '../src/jellyfin/devices.ts';
import {cleanFact,providerFacts} from '../src/components/metadataPresentation.ts';
import {visibleLanguage} from '../src/playback/languages.ts';
import {JellyfinClient} from '../src/jellyfin/client.ts';

test('QR address selection retains server BaseUrl and excludes credentials and route state',()=>{
 const url='http://192.168.1.20:8096/jellyfin/Frame/Web/#/';
 assert.equal(selectedFrameUrl(url).url,url);
 assert.equal(selectedFrameUrl('https://media.example.org/base/Frame/Web').url,'https://media.example.org/base/Frame/Web/#/');
 for(const input of ['javascript:alert(1)','http://user:password@192.168.1.20:8096/Frame/Web/','http://192.168.1.20:8096/Frame/Web/?api_key=synthetic','http://192.168.1.20:8096/Frame/Web/#/play/private-item','http://192.168.1.20:8096/web/','not a URL','http://127.0.0.1:8096/Frame/Web/','http://[::1]:8096/Frame/Web/'])assert.equal(selectedFrameUrl(input).url,undefined);
 const suggestion=suggestedFrameUrl(url+'?token=do-not-copy');assert.equal(suggestion.url,url);
 assert.equal(suggestedFrameUrl('http://localhost:5173/#/').url,'');
 assert.match(suggestedFrameUrl('http://localhost:8096/base/Frame/Web/#/').note,/same network/);
 assert.equal(suggestedFrameUrl('http://localhost:8096/base/Frame/Web/#/','http://192.168.1.20:8096/base').url,'http://192.168.1.20:8096/base/Frame/Web/#/');
 for(const host of ['localhost','test.localhost','127.0.0.2','[::1]','[::ffff:7f00:1]','0.0.0.0'])assert.equal(loopbackHost(host),true);
});
test('QR SVG is generated locally with quiet zone and deterministic URL-specific modules',()=>{
 const first=selectedFrameUrl('http://192.168.1.20:8096/Frame/Web/#/').url;
 const svg=renderToStaticMarkup(createElement(QRCodeSVG,{value:first,size:224,marginSize:4,level:'M',title:'Scan to open Frame'}));
 assert.match(svg,/<svg/);assert.match(svg,/viewBox="0 0 \d+ \d+"/);assert.match(svg,/<path/);assert.match(svg,/Scan to open Frame/);
 assert.doesNotMatch(svg,/<image|https?:\/\/|token|fetch|script/);
 assert.equal(svg,renderToStaticMarkup(createElement(QRCodeSVG,{value:first,size:224,marginSize:4,level:'M',title:'Scan to open Frame'})));
 assert.notEqual(svg,renderToStaticMarkup(createElement(QRCodeSVG,{value:first.replace('.20','.21'),size:224,marginSize:4,level:'M'})));
});
test('session boundary discards sensitive fields and applies ordinary-user/IP visibility',()=>{
 const rows=parseDeviceSessions([{Id:'own',DeviceId:'here',DeviceName:'Browser',Client:'Frame',UserId:'me',UserName:'Test',AccessToken:'never-retain',RemoteEndPoint:'192.168.1.2',LastActivityDate:'2026-10-30T00:00:00Z',NowPlayingItem:{Path:'private-path'},PlayState:{IsPaused:true}},{Id:'other',DeviceId:'elsewhere',UserId:'someone',UserName:'Other',RemoteEndPoint:'192.168.1.3'},{Id:'second',DeviceId:'second',UserId:'me',RemoteEndPoint:'192.168.1.4'},{Id:'bad',DeviceId:'bad',RemoteEndPoint:'http://private.invalid',LastActivityDate:'invalid'}]);
 assert.doesNotMatch(JSON.stringify(rows),/never-retain|private-path|private.invalid/);
 assert.equal(rows[0].status,'Paused');assert.equal(currentDevice(rows[0],'here'),true);
 const own=visibleDeviceSessions(rows,'me','here',false);assert.equal(own.length,2);assert.equal(own[0].ip,'192.168.1.2');assert.equal(own[1].ip,undefined);
 assert.equal(visibleDeviceSessions(rows,'me','here',true).length,4);
 for(const value of [null,{},'bad'])assert.deepEqual(parseDeviceSessions(value),[]);
});
for(const status of [401,403,404,500])test(`optional device list ${status} degrades without expiring playback`,async()=>{
 const client=new JellyfinClient('http://localhost:18096','test',async()=>new Response(null,{status}),()=>assert.fail('optional session view must not log out'));
 client.restore({token:'synthetic-fixture',server:{Version:'12.3.0'}});
 const result=await client.deviceSessions();assert.equal(result.available,false);assert.ok(result.reason);client.dispose();
});
test('device list cache and explicit refresh use GET only',async()=>{
 let calls=0;const client=new JellyfinClient('http://localhost:18096/base','here',async(url,init)=>{calls++;assert.match(url,/\/base\/Sessions\?activeWithinSeconds=86400$/);assert.equal(init.method,'GET');return Response.json([{Id:'session',DeviceId:'here',UserId:'me',Client:'Frame'}]);});
 assert.equal((await client.deviceSessions()).rows.length,1);await client.deviceSessions();assert.equal(calls,1);client.clearDeviceSessions();await client.deviceSessions();assert.equal(calls,2);client.dispose();
});
test('metadata filtering removes provenance-shaped noise while preserving real facts and provider IDs',()=>{
 assert.equal(cleanFact('Source','Disney+ press kit'),false);assert.equal(cleanFact('Metadata provider','anything'),false);
 assert.equal(cleanFact('Directed by','Terry Matalas'),true);assert.equal(cleanFact('Certification','TV-14'),true);assert.equal(cleanFact('Studio','Disney'),true);
 assert.equal(cleanFact('Original title','Press Release'),true);assert.equal(cleanFact('Original title','Disney+ press kit'),false);
 assert.deepEqual(providerFacts({Imdb:'tt12345',Tmdb:'213375','Disney+ press kit':'https://source.invalid',Source:'press kit'}),[['Imdb','tt12345'],['Tmdb','213375']]);
});
test('language presentation hides Hindi aliases without changing server track indexes/defaults',()=>{
 for(const track of [{Language:'hin'},{Language:'hi-IN'},{DisplayTitle:'Hindi - SUBRIP'},{Title:'हिन्दी'}])assert.equal(visibleLanguage(track),false);
 for(const Language of ['eng','fra','pol',undefined])assert.equal(visibleLanguage({Language}),true);
 for(const Language of ['deu','spa','jpn'])assert.equal(visibleLanguage({Language}),false);
 const track={Index:7,Language:'hin',IsDefault:true};const before=structuredClone(track);visibleLanguage(track);assert.deepEqual(track,before);
});
