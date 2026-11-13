import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCustomSubtitle,subtitleFromFile,subtitleFromUrl,MAX_SUBTITLE_BYTES} from '../src/playback/customSubtitles.ts';
const bytes=text=>new TextEncoder().encode(text);
const srt='1\r\n00:00:01,250 --> 00:00:03,500\r\nHello\r\nWorld\r\n\r\n2\r\n00:01:00,000 --> 00:01:01,000\r\nAgain';
test('custom subtitles: SRT converts to timed WebVTT and retains multiline dialogue',()=>{
 const result=parseCustomSubtitle(bytes(srt),'movie.en.srt');assert.equal(result.language,'en');assert.match(result.vtt,/WEBVTT\n\n00:00:01.250 --> 00:00:03.500\nHello\nWorld/);assert.match(result.vtt,/00:01:00.000/);
});
test('custom subtitles: VTT accepts identifiers, short timestamps and a BOM',()=>{
 const result=parseCustomSubtitle(bytes('\uFEFFWEBVTT\n\ncue-one\n01:01.200 --> 01:03.400 align:start\nHello'),'captions.vtt');assert.match(result.vtt,/00:01:01.200 --> 00:01:03.400/);
});
test('custom subtitles: VTT metadata and NOTE/STYLE blocks are excluded',()=>{
 const result=parseCustomSubtitle(bytes('WEBVTT\nLanguage: en\n\nNOTE ignore\nanything\n\nSTYLE\n::cue {color: red}\n\n00:00.000 --> 00:02.000\nSafe'),'file.vtt');assert.doesNotMatch(result.vtt,/STYLE|NOTE|color|Language/);assert.match(result.vtt,/Safe/);
});
for(const [name,text] of [['wrong.txt',srt],['bad.vtt',srt],['empty.srt',''],['no-time.srt','not subtitles'],['reverse.srt','1\n00:00:03,000 --> 00:00:01,000\nNo'],['bad-time.srt','1\n00:99:00,000 --> 00:99:03,000\nNo']])test(`custom subtitles reject ${name}`,()=>assert.throws(()=>parseCustomSubtitle(bytes(text),name)));
test('custom subtitles: invalid UTF-8 and oversized files fail before rendering',async()=>{
 assert.throws(()=>parseCustomSubtitle(new Uint8Array([0xff,0xff,0xff]),'bad.srt'),/UTF-8/);
 assert.throws(()=>parseCustomSubtitle(new Uint8Array(MAX_SUBTITLE_BYTES+1),'big.srt'),/2 MB/);
 await assert.rejects(subtitleFromFile({name:'big.srt',size:MAX_SUBTITLE_BYTES+1,arrayBuffer(){throw Error('must not read');}}),/2 MB/);
});
test('custom file load retains only normalized subtitles, without persisting file contents',async()=>{
 const result=await subtitleFromFile(new File([srt],'local.srt'));assert.match(result.vtt,/WEBVTT/);assert.equal(result.name,'local.srt');
});
test('custom URL fetch omits credentials, referrer, redirects and Jellyfin headers',async()=>{
 let options;const result=await subtitleFromUrl('https://subtitles.invalid/movie.srt',undefined,async(url,init)=>{options=init;assert.equal(url,'https://subtitles.invalid/movie.srt');return new Response(srt);});
 assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');assert.equal(options.mode,'cors');assert.equal(options.headers,undefined);assert.match(result.vtt,/WEBVTT/);
});
for(const url of ['http://example.invalid/a.srt','https://u:p@example.invalid/a.srt','https://example.invalid/page','file:///a.vtt','https://example.invalid/a.vtt#part'])test(`custom URL rejects unsafe or indirect input ${url.split(':')[0]}`,async()=>{
 await assert.rejects(subtitleFromUrl(url,undefined,()=>{throw Error('must not fetch');}),/HTTPS/);
});
test('custom URL size budget is enforced during streaming without Content-Length',async()=>{
 let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_SUBTITLE_BYTES+1));},cancel(){cancelled=true;}});
 await assert.rejects(subtitleFromUrl('https://subtitles.invalid/big.vtt',undefined,async()=>new Response(stream)),/2 MB/);assert.equal(cancelled,true);
});
test('custom URL rejects oversized headers, error responses and webpages',async()=>{
 for(const response of [new Response(srt,{headers:{'Content-Length':String(MAX_SUBTITLE_BYTES+1)}}),new Response('missing',{status:404}),new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}})])await assert.rejects(subtitleFromUrl('https://subtitles.invalid/a.srt',undefined,async()=>response));
});
test('custom URL explains CORS/network failure and respects cancellation',async()=>{
 await assert.rejects(subtitleFromUrl('https://subtitles.invalid/a.srt',undefined,async()=>{throw new TypeError('private network detail');}),/CORS/);
 const controller=new AbortController();controller.abort();await assert.rejects(subtitleFromUrl('https://subtitles.invalid/a.srt',controller.signal,async()=>{throw new DOMException('Aborted','AbortError');}),{name:'AbortError'});
});
