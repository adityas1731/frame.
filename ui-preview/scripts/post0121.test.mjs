import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trackLabel,visibleLanguage} from '../src/playback/languages.ts';
import {frameAddress,suggestedFrameUrl} from '../src/access/url.ts';
import {normalizeServerUrl} from '../src/jellyfin/client.ts';

test('server-localized default badge is English without hiding an English audio track',()=>{
 const track={Type:'Audio',Index:7,Language:'eng',DisplayTitle:'English - Dolby Digital - Stereo - प्राथमिक',IsDefault:true};
 const original=structuredClone(track);
 assert.equal(visibleLanguage(track),true);assert.equal(trackLabel(track),'English - Dolby Digital - Stereo - Default');assert.deepEqual(track,original);
 assert.equal(trackLabel({Index:3,Title:'प्राथमिक',Language:'eng'}),'eng · Default');
 assert.equal(visibleLanguage({Language:'hin'}),false);
});
test('QR accepts a host or server base and completes only the public Frame path',()=>{
 const page='http://localhost:8096/Frame/Web/#/item/private';
 assert.equal(frameAddress('192.168.1.20',page).url,'http://192.168.1.20:8096/Frame/Web/#/');
 assert.equal(frameAddress('192.168.1.20:9000',page).url,'http://192.168.1.20:9000/Frame/Web/#/');
 assert.equal(frameAddress('https://media.example.org/jellyfin',page).url,'https://media.example.org/jellyfin/Frame/Web/#/');
 assert.equal(frameAddress('192.168.1.20','http://localhost:8096/jellyfin/Frame/Web/#/').url,'http://192.168.1.20:8096/jellyfin/Frame/Web/#/');
 assert.equal(frameAddress('http://192.168.1.20:8096/Frame/Web/#/',page).url,'http://192.168.1.20:8096/Frame/Web/#/');
 assert.equal(frameAddress('192.168.1.20','http://localhost:5173/#/').url,undefined);
 assert.equal(frameAddress('192.168.1.20:8096','http://localhost:5173/#/').url,'http://192.168.1.20:8096/Frame/Web/#/');
 for(const input of ['','localhost','127.0.0.1','http://user:password@192.168.1.20','http://192.168.1.20?token=secret','http://192.168.1.20/Frame/Web/#/play/private','javascript:alert(1)'])assert.equal(frameAddress(input,page).url,undefined);
});
test('localhost QR starts empty with a short IPv4 guide instead of an unusable QR address',()=>{
 const result=suggestedFrameUrl('http://localhost:8096/Frame/Web/#/');assert.equal(result.url,'');assert.match(result.note,/server’s address/);
});
test('pasted Frame root URL resolves to Jellyfin while preserving BaseUrl and security checks',()=>{
 assert.equal(normalizeServerUrl('http://localhost:8096/Frame/Web/',true),'http://localhost:8096');
 assert.equal(normalizeServerUrl('https://media.example.org/jellyfin/Frame/Web/#/'),'https://media.example.org/jellyfin');
 assert.equal(normalizeServerUrl('https://media.example.org/jellyfin'),'https://media.example.org/jellyfin');
 for(const input of ['http://user:password@localhost:8096/Frame/Web/#/','http://localhost:8096/Frame/Web/?api_key=secret','http://localhost:8096/Frame/Web/#/play/private'])assert.throws(()=>normalizeServerUrl(input,true));
 assert.throws(()=>normalizeServerUrl('http://localhost:8096/Frame/Web/#/',false));
 assert.throws(()=>normalizeServerUrl('http://localhost:8096/Frame/Web/#/',true,'https:'));
});
