import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {cleanMediaUrl,rewritePlaylist,gatewayPath,sameMediaItem} from '../public/frame-stream-policy.js';
const nonce='00000000-0000-4000-8000-000000000000';
async function worker(transport,appScope='/',signalApi={}){
 const handlers={},calls=[];const page={id:'page',url:'https://frame.invalid'+appScope+'#/play/item',postMessage:()=>{}};
 const scope={location:new URL('https://frame.invalid'+appScope+'frame-stream-sw.js'),clients:{get:async id=>id==='page'?page:undefined,claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,cb)=>handlers[name]=cb};
 const code=(await readFile(new URL('../public/frame-stream-sw.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/,'');
 vm.runInNewContext(code,{self:scope,URL,Headers,Response,ReadableStream,AbortController,AbortSignal:signalApi,setTimeout,clearTimeout,Date,console,cleanMediaUrl,rewritePlaylist,fetch:async(url,init)=>{calls.push({url,init});return transport(url,init);}});
 function message(data){let ack;handlers.message({source:page,data,ports:[{postMessage:value=>ack=value}]});return ack;}
 const open=(itemId='item')=>message({type:'frame:open',nonce,baseUrl:'https://server.invalid/jellyfin',token:'private-token',deviceId:'device',itemId});
 async function request(relative,init={},clientId='page'){let response;handlers.fetch({clientId,request:new Request('https://frame.invalid'+gatewayPath(nonce,relative,appScope),init),respondWith:value=>response=value});return response;}
 return{calls,open,message,request};
}
test('GUID equivalence is strict and worker accepts the same dashed item only',async()=>{
 const compact='11111111222243338444555555555555',dashed='11111111-2222-4333-8444-555555555555';
 assert.equal(sameMediaItem(compact,dashed.toUpperCase()),true);
 for(const bad of ['11111111--2222-4333-8444-555555555555','11111111222243338444555555555556','1111-1111222243338444555555555555'])assert.equal(sameMediaItem(compact,bad),false);
 assert.equal(sameMediaItem('fixture-1','fixture1'),false);
 const w=await worker(()=>new Response('#EXTM3U\n',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}}));w.open(compact);
 assert.equal((await w.request(`videos/${dashed}/master.m3u8`)).status,200);
 assert.equal((await w.request(`videos/${dashed.replace('1111','2111')}/master.m3u8`)).status,502);assert.equal(w.calls.length,1);
});

test('worker injects credentials only in headers, preserves Range/206 and rejects other clients',async()=>{
 const w=await worker(()=>new Response(new Uint8Array([1,2,3]),{status:206,headers:{'Content-Type':'video/mp4','Content-Range':'bytes 5-7/100','Content-Length':'3','Accept-Ranges':'bytes'}}));assert.equal(w.open().ok,true);
 const response=await w.request('Videos/item/stream.mp4?api_key=discard',{headers:{Range:'bytes=5-7'}});assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),'bytes 5-7/100');assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);
 assert.equal(w.calls[0].init.headers.get('Range'),'bytes=5-7');assert.match(w.calls[0].init.headers.get('Authorization'),/Token="private-token"/);assert.equal(w.calls[0].init.redirect,'error');assert.doesNotMatch(w.calls[0].url,/private-token|discard/);
 assert.equal((await w.request('Videos/item/stream.mp4',{},'other-page')).status,403);assert.equal(w.calls.length,1);
});
test('HLS variants, init fragments and segments stay item scoped and token free',async()=>{
 const w=await worker(()=>new Response('#EXTM3U\n#EXT-X-MAP:URI="hls1/main/-1.mp4?api_key=private-token"\nhls1/main/0.ts?api_key=private-token\n',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}}));w.open();const response=await w.request('Videos/item/main.m3u8?api_key=private-token&StartTimeTicks=50000000');const text=await response.text();assert.match(text,/__frame_media/);assert.match(text,/stream.mp4/);assert.match(text,/stream.ts/);assert.doesNotMatch(text,/private-token/);assert.doesNotMatch(w.calls[0].url,/StartTimeTicks/);
});
test('closing revokes streaming grant and aborts in-flight fetches, denied routes never fetch',async()=>{
 let signal;const w=await worker((_url,init)=>{signal=init.signal;return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));}}));});w.open();const response=await w.request('Videos/item/stream.mp4');assert.equal(response.status,200);w.message({type:'frame:close',nonce});assert.equal(signal.aborted,true);await response.body.cancel();assert.equal((await w.request('Videos/item/stream.mp4')).status,403);
 const bad=await worker(()=>{throw Error('must not fetch');});bad.open();assert.equal((await bad.request('Videos/other/stream.mp4')).status,502);assert.equal(bad.calls.length,0);
});
test('unexposed range headers fail with a useful generic error; upstream secrets never become error text',async()=>{
 const w=await worker(()=>new Response('private-token',{status:206}));w.open();const response=await w.request('Videos/item/stream.mp4');assert.equal(response.status,502);assert.match(await response.text(),/CORS/);
 const denied=await worker(()=>new Response('private-token',{status:401}));denied.open();const expired=await denied.request('Videos/item/stream.mp4');assert.equal(await expired.text(),'Session expired');
});

test('plugin worker keeps rewritten media inside its own scope',async()=>{
 const appScope='/jellyfin/Frame/Web/';
 const w=await worker(()=>new Response('#EXTM3U\nhls1/main/0.ts\n',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}}),appScope);
 assert.equal(w.open().ok,true);const response=await w.request('Videos/item/main.m3u8');assert.equal(response.status,200);
 const text=await response.text();assert.ok(text.includes(appScope+'__frame_media/'));assert.ok(!text.includes('private-token'));
});

test('Jellyfin root-relative item streams retain a configured server base without widening grants',()=>{
 const base='https://server.invalid/jellyfin',item='item';
 assert.equal(cleanMediaUrl('/videos/item/master.m3u8?api_key=secret',base,item),'videos/item/master.m3u8');
 assert.equal(cleanMediaUrl('/jellyfin/Videos/item/master.m3u8',base,item),'Videos/item/master.m3u8');
 assert.equal(cleanMediaUrl('/Videos/item/stream.mp4?static=true',base,item),'Videos/item/stream.mp4?static=true');
 const rewritten=rewritePlaylist('#EXTM3U\n/videos/item/hls1/main/0.ts?api_key=secret\n','https://server.invalid/jellyfin/videos/item/master.m3u8',base,item,nonce,'/jellyfin/Frame/Web/');
 assert.ok(rewritten.includes('/jellyfin/Frame/Web/__frame_media/'));assert.ok(!rewritten.includes('secret'));
 for(const raw of ['/videos/other/master.m3u8','/System/Configuration','//evil.invalid/videos/item/master.m3u8','https://server.invalid/videos/item/master.m3u8','https://evil.invalid/jellyfin/videos/item/master.m3u8','/videos/item/../../System/Configuration'])assert.throws(()=>cleanMediaUrl(raw,base,item));
});

test('worker cancellation works without AbortSignal.any or timeout',async()=>{
 let signal;const w=await worker((_url,init)=>{signal=init.signal;return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));}}));});w.open();
 const request=new AbortController();const response=await w.request('Videos/item/stream.mp4',{signal:request.signal});assert.equal(response.status,200);assert.equal(signal.aborted,false);request.abort();assert.equal(signal.aborted,true);await response.body.cancel();
});
