import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import {localMediaProxy,fixtureMedia} from '../dev/media-proxy.ts';
import {readFile} from 'node:fs/promises';
class Output extends Writable {
 statusCode=200;headers={};chunks=[];headersSent=false;
 setHeader(name,value){this.headers[name.toLowerCase()]=value;}
 writeHead(status,headers){this.statusCode=status;Object.entries(headers??{}).forEach(([name,value])=>this.setHeader(name,value));this.headersSent=true;}
 _write(chunk,_encoding,callback){this.headersSent=true;this.chunks.push(Buffer.from(chunk));callback();}
}
test('development bridge is fixed-upstream, read-only, range preserving and never forwards token queries',async()=>{
 const calls=[];const middleware=localMediaProxy(async(url,init)=>{calls.push({url,init});return new Response(new Uint8Array([1,2,3]),{status:206,headers:{'Content-Type':'video/mp4','Content-Length':'3','Content-Range':'bytes 1-3/10','Accept-Ranges':'bytes'}});});
 const headers={host:'127.0.0.1:5173',authorization:'MediaBrowser Token="test-only-secret"',range:'bytes=1-3'};
 const request=async(url,options={})=>{const response=new Output();await middleware({url,method:'GET',headers,...options},response,()=>{response.statusCode=404;response.end();});return response;};
 const result=await request('/__frame_jellyfin/Videos/item/stream.mp4?static=true');assert.equal(result.statusCode,206);assert.equal(result.headers['content-range'],'bytes 1-3/10');assert.equal(Buffer.concat(result.chunks).length,3);assert.equal(calls[0].url,'http://localhost:8096/Videos/item/stream.mp4?static=true');assert.equal(calls[0].init.headers.get('Range'),'bytes=1-3');assert.equal(calls[0].init.redirect,'error');
 for(const [path,options] of [
  ['/__frame_jellyfin/Videos/item/stream.mp4?api_key=secret',{}],
  ['/__frame_jellyfin/Items/item',{}],
  ['/__frame_jellyfin/Videos/ActiveEncodings',{method:'DELETE'}],
  ['/__frame_jellyfin/Videos/item/stream.mp4',{headers:{host:'attacker.invalid',authorization:headers.authorization}}],
  ['/__frame_jellyfin/Videos/item/stream.mp4',{headers:{...headers,origin:'https://attacker.invalid'}}],
  ['/__frame_jellyfin/Videos/item/stream.mp4',{headers:{host:headers.host}}],
 ])assert.ok([403,405].includes((await request(path,options)).statusCode));
 assert.equal(calls.length,1);
});
test('original alternate-audio fixture serves distinct selected AAC segments and authenticated WebVTT',async()=>{
 const middleware=fixtureMedia();const read=async(url,headers={authorization:'MediaBrowser Token="fictional-session-token"'})=>{const output=new Output();await middleware({url,method:'GET',headers},output,()=>{throw Error('unhandled');});return output;};
 const first=await read('/__frame_fixture/Videos/item/hls1/main/0.ts?AudioStreamIndex=1');const alternate=await read('/__frame_fixture/Videos/item/hls1/main/0.ts?AudioStreamIndex=2');
 assert.deepEqual(Buffer.concat(alternate.chunks),await readFile(new URL('../public/test-media/alternate-000.ts',import.meta.url)));assert.notDeepEqual(Buffer.concat(first.chunks),Buffer.concat(alternate.chunks));
 const captions=await read('/__frame_fixture/Videos/item/source/Subtitles/3/Stream.vtt');assert.equal(captions.headers['content-type'],'text/vtt');assert.match(Buffer.concat(captions.chunks).toString(),/Playback, seeking and subtitle test/);assert.equal((await read('/__frame_fixture/Videos/item/main.m3u8',{})).statusCode,403);
});
