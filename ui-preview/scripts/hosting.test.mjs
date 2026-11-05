import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hosting,assetUrl} from '../src/build/hosting.ts';
import {gatewayPath,rewritePlaylist} from '../public/frame-stream-policy.js';
import {hlsConfig} from '../src/playback/hls.ts';
test('hosting resolves standalone and plugin assets without contacting a server',()=>{
 assert.equal(hosting('https://host.invalid/Frame/Web/#/movies').serverUrl,'https://host.invalid');
 assert.equal(hosting('https://host.invalid/jellyfin/Frame/Web/#/item/123').serverUrl,'https://host.invalid/jellyfin');
 assert.equal(hosting('http://localhost:5173/#/').serverUrl,undefined);
 assert.equal(assetUrl('providers/tmdb.svg','https://host.invalid/jellyfin/Frame/Web/'),'https://host.invalid/jellyfin/Frame/Web/providers/tmdb.svg');
});
test('plugin gateway and HLS retain the proxy prefix and reject sibling scopes',()=>{
 const nonce='00000000-0000-4000-8000-000000000000',scope='/jellyfin/Frame/Web/';
 const url=gatewayPath(nonce,'Videos/item/main.m3u8',scope);
 const config=hlsConfig(url,10,'https://host.invalid',scope);
 const playlist=rewritePlaylist('#EXTM3U\nhls1/main/0.ts?api_key=secret','https://server.invalid/Videos/item/main.m3u8','https://server.invalid','item',nonce,scope);
 assert.ok(playlist.includes(scope+'__frame_media/'));assert.ok(!playlist.includes('secret'));
 const segment=playlist.split('\n')[1];assert.equal(config.fetchSetup({url:segment},{}).url,'https://host.invalid'+segment);
 assert.throws(()=>hlsConfig(url,0,'https://host.invalid','/Frame/Web/'));
 assert.throws(()=>config.fetchSetup({url:'/web/__frame_media/other/segment'},{}));
 for(const bad of ['//evil/','/../','/x?y/','/x\\y/'])assert.throws(()=>gatewayPath(nonce,'Videos/item/main.m3u8',bad));
});
