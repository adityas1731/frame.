import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import type {ServerResponse} from 'node:http';
import type {Connect,Plugin} from 'vite';
import {mediaPathAllowed} from '../public/frame-stream-policy.js';
const prefix='/__frame_jellyfin/';
function fail(response:ServerResponse,status:number){response.writeHead(status,{'Content-Type':'text/plain','Cache-Control':'no-store'});response.end('Frame media request unavailable.');}
/** Development-only, fixed upstream, GET/HEAD media routes. No token queries, redirects or arbitrary proxy target. */
export function localMediaProxy(transport:typeof fetch=fetch):Connect.NextHandleFunction{return async(request,response,next)=>{
 const raw=request.url??'';if(!raw.startsWith(prefix)){next();return;}
 const host=request.headers.host??'';const origin=request.headers.origin;
 if(!/^(localhost|127\.0\.0\.1):(5173|4173)$/.test(host)||origin&&origin!==`http://${host}`||request.headers['sec-fetch-site']==='cross-site'){fail(response,403);return;}
 if(!['GET','HEAD'].includes(request.method??'')){fail(response,405);return;}
 try{
  const url=new URL(raw,'http://frame.invalid');const relative=url.pathname.slice(prefix.length);const itemId=relative.split('/')[1];
  if(!itemId||!mediaPathAllowed(relative,itemId)||[...url.searchParams.keys()].some(k=>/^(api_?key|token|authorization|access_token|x-emby-token)$/i.test(k))||!request.headers.authorization?.startsWith('MediaBrowser ')){fail(response,403);return;}
  const controller=new AbortController();response.on('close',()=>controller.abort());
  const headers=new Headers({Authorization:request.headers.authorization,Accept:'*/*'});for(const key of ['range','if-range'])if(typeof request.headers[key]==='string')headers.set(key,request.headers[key] as string);
  const upstream=await transport('http://localhost:8096/'+relative+url.search,{method:request.method,headers,redirect:'error',signal:controller.signal});
  if(!upstream.ok){fail(response,upstream.status);return;}
  response.statusCode=upstream.status;response.setHeader('Cache-Control','no-store');
  for(const name of ['Content-Type','Content-Length','Content-Range','Accept-Ranges','ETag','Last-Modified']){const value=upstream.headers.get(name);if(value)response.setHeader(name,value);}
  if(request.method==='HEAD'||!upstream.body){response.end();return;}
  await pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]),response);
 }catch{if(!response.headersSent)fail(response,502);else response.destroy();}
};}
export function fixtureMedia():Connect.NextHandleFunction{return async(request,response,next)=>{
 const url=new URL(request.url??'','http://frame.invalid');if(!url.pathname.startsWith('/__frame_fixture/')){next();return;}
 if(!['GET','HEAD'].includes(request.method??'')||!request.headers.authorization?.includes('Token="fictional-session-token"')){fail(response,403);return;}
 const path=url.pathname.slice('/__frame_fixture/'.length);const itemId=path.split('/')[1];if(!itemId||!mediaPathAllowed(path,itemId)){fail(response,403);return;}
 response.setHeader('Cache-Control','no-store');
 try{
  if(path.endsWith('master.m3u8')){response.setHeader('Content-Type','application/vnd.apple.mpegurl');response.end(`#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,CODECS="avc1.640028,mp4a.40.2"\nmain.m3u8${url.search}\n`);return;}
  if(path.endsWith('main.m3u8')){const alternate=url.searchParams.get('AudioStreamIndex')==='2';const playlist=await readFile(new URL(`../public/test-media/${alternate?'alternate':'frame-test'}.m3u8`,import.meta.url),'utf8');response.setHeader('Content-Type','application/vnd.apple.mpegurl');response.end(playlist.replace(/(?:frame|alternate)-(\d+)\.ts/g,(_m,id)=>`hls1/main/${Number(id)}.ts${url.search}`));return;}
  if(path.toLowerCase().endsWith('.vtt')){response.setHeader('Content-Type','text/vtt');response.end('WEBVTT\n\n00:00:01.000 --> 00:00:10.000\nFrame original test pattern\n\n00:00:10.000 --> 00:00:25.000\nPlayback, seeking and subtitle test\n');return;}
  const segment=path.match(/\/hls1\/main\/(\d+)\.ts$/);const file=new URL(segment?`../public/test-media/${url.searchParams.get('AudioStreamIndex')==='2'?'alternate':'frame'}-${segment[1].padStart(3,'0')}.ts`:'../public/test-media/frame-test.mp4',import.meta.url);const info=await stat(file);
  const range=request.headers.range;let start=0,end=info.size-1;
  if(range){const match=range.match(/^bytes=(\d+)-(\d*)$/);if(!match){fail(response,416);return;}start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end||start>=info.size){fail(response,416);return;}response.statusCode=206;response.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);}
  response.setHeader('Content-Type',segment?'video/mp2t':'video/mp4');response.setHeader('Accept-Ranges','bytes');response.setHeader('Content-Length',end-start+1);
  if(request.method==='HEAD'){response.end();return;}await pipeline(createReadStream(file,{start,end}),response);
 }catch{if(!response.headersSent)fail(response,404);else response.destroy();}
};}
export function frameMediaPlugin():Plugin{return{name:'frame-scoped-development-media',configureServer(server){server.middlewares.use(localMediaProxy());server.middlewares.use(fixtureMedia());},configurePreviewServer(server){server.middlewares.use(localMediaProxy());}};}
