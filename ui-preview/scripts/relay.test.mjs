import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRelay,relayResource} from '../src/playback/relay.ts';
import {browserSupport} from '../src/playback/capabilities.ts';
import {hlsConfig} from '../src/playback/hls.ts';
const session={baseUrl:'http://frame.invalid/jellyfin',server:{Id:'server',Version:'12.3.0'},user:{Id:'user'},deviceId:'test-device',token:'fixture-secret',created:0};
const id='123456781234423482341234567890ab';const baseURI=session.baseUrl+'/Frame/Web/';
const mock=()=>{const calls=[];return{calls,fetch:async(url,options)=>{calls.push({url,options});return options.method==='POST'?new Response(JSON.stringify({grantId:id,expiresIn:120}),{headers:{'Content-Type':'application/json'}}):new Response(null,{status:204});}};};
test('cookie relay uses account headers only on same-origin lease controls',async()=>{
 const m=mock(),abort=new AbortController();const relay=await createRelay(session,'item',abort.signal,baseURI,m.fetch);
 try{const media=relay.url('Videos/item/master.m3u8?api_key=server-secret');assert.doesNotMatch(media,/fixture-secret|server-secret|apikey|api_key|token/i);assert.equal(m.calls[0].options.headers.Authorization.includes(session.token),true);assert.equal(m.calls[0].options.headers['X-Frame-Request'],'1');assert.equal(m.calls[0].options.credentials,'same-origin');assert.equal(m.calls[0].options.mode,'same-origin');assert.equal(m.calls[0].options.redirect,'error');assert.equal(m.calls[0].options.referrerPolicy,'same-origin');assert.equal(m.calls[0].url,session.baseUrl+'/Frame/Media');}finally{relay.close();}
 assert.equal(m.calls.at(-1).options.method,'DELETE');assert.equal(m.calls.at(-1).options.keepalive,true);
});
test('relay preserves BaseUrl and cannot authorize another item, grant or origin',async()=>{
 const m=mock(),relay=await createRelay(session,'item',new AbortController().signal,baseURI,m.fetch);
 try{const own=relay.url('Videos/item/hls1/main/0.ts');assert.equal(relay.authorizeHls(own),own);for(const raw of [own.replace('frame.invalid','outside.invalid'),own.replace(id,'0'.repeat(32)),own+'&token=secret',own+'#fragment'])assert.throws(()=>relay.authorizeHls(raw));assert.throws(()=>relay.url('Videos/other/stream.mp4'));assert.throws(()=>relay.url('https://outside.invalid/stream.mp4'));}finally{relay.close();}
});
test('relay abort closes once and invalidates further media URLs',async()=>{
 const m=mock(),abort=new AbortController();const relay=await createRelay(session,'item',abort.signal,baseURI,m.fetch);abort.abort();assert.throws(()=>relay.url('Videos/item/stream.mp4'),/closed/);assert.equal(m.calls.filter(c=>c.options.method==='DELETE').length,1);relay.close();assert.equal(m.calls.filter(c=>c.options.method==='DELETE').length,1);
});
test('missing plugin errors are actionable and arbitrary exceptions cannot leak',async()=>{
 await assert.rejects(createRelay(session,'item',new AbortController().signal,baseURI,async()=>new Response('',{status:404})),/matching frame\./);
 await assert.rejects(createRelay(session,'item',new AbortController().signal,baseURI,async()=>{throw Error('fixture-secret http://private.invalid');}),e=>!e.message.includes('fixture-secret')&&!e.message.includes('private.invalid'));
 const m=mock();await assert.rejects(createRelay(session,'item',new AbortController().signal,'http://outside.invalid/Frame/Web/',m.fetch),/signed into/);assert.equal(m.calls.length,0);
});
test('relay encoding strips general credentials but preserves media options',()=>{
 const encoded=relayResource('Videos/item/master.m3u8?api_key=secret&VideoCodec=h264','http://frame.invalid','item');const decoded=Buffer.from(encoded,'base64url').toString();assert.ok(decoded.includes('VideoCodec=h264'));assert.doesNotMatch(decoded,/secret|api_key/);
});
test('relay errors report allowlisted causes and status without reflecting server content',async()=>{
 for(const [code,pattern] of [['frame-relay-listener',/local HTTP listener/],['frame-relay-origin',/rejected the player origin/],['frame-relay-upstream',/own connection/],['frame-relay-timeout',/too long/]])await assert.rejects(createRelay(session,'item',new AbortController().signal,baseURI,async()=>new Response(JSON.stringify({code}),{status:503})),pattern);
 await assert.rejects(createRelay(session,'item',new AbortController().signal,baseURI,async()=>new Response(JSON.stringify({code:'secret-token http://private.invalid'}),{status:502})),e=>e.message.includes('HTTP 502')&&!e.message.includes('secret-token')&&!e.message.includes('private.invalid'));
});
test('native HLS is enabled only with the cookie relay transport',()=>{
 const video={canPlayType:mime=>mime==='application/vnd.apple.mpegurl'?'maybe':''};assert.equal(browserSupport(video,false).nativeHls,false);assert.equal(browserSupport(video,false,true).nativeHls,true);
});
test('MSE HLS carries lease cookies and rejects unrelated requests',async()=>{
 const m=mock(),relay=await createRelay(session,'item',new AbortController().signal,baseURI,m.fetch);
 try{const config=hlsConfig(relay.url('Videos/item/master.m3u8'),12,'http://frame.invalid','/jellyfin/Frame/Web/',relay.authorizeHls);const request=config.fetchSetup({url:relay.url('Videos/item/hls1/main/0.ts')},{});assert.equal(request.credentials,'same-origin');assert.equal(request.referrerPolicy,'no-referrer');assert.equal(request.redirect,'error');assert.throws(()=>config.fetchSetup({url:'http://outside.invalid/x'},{}));}finally{relay.close();}
});
