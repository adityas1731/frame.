import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attachEngine,hlsConfig,mseHlsSupport} from '../src/playback/hls.ts';
import {gatewayPath} from '../public/frame-stream-policy.js';
import {activeCaptionText} from '../src/playback/subtitles.ts';
const origin='https://frame.invalid';
const nonce='00000000-0000-4000-8000-000000000000';
const url=gatewayPath(nonce,'Videos/item/master.m3u8');
class Engine {
 static Events={ERROR:'error'};static ErrorTypes={MEDIA_ERROR:'mediaError',NETWORK_ERROR:'networkError'};static instance;
 listeners={};recoveries=0;stops=0;destroys=0;loaded=[];
 constructor(config){this.config=config;Engine.instance=this;}
 on(event,callback){this.listeners[event]=callback;}
 attachMedia(video){this.video=video;}
 loadSource(url){this.loaded.push(url);}
 stopLoad(){this.stops++;}destroy(){this.destroys++;}recoverMediaError(){this.recoveries++;}
 error(type,fatal=true){this.listeners.error('error',{type,fatal});}
}
test('HLS configuration uses an exact page grant, no credentials in URLs, bounded loading and absolute timeline',()=>{
 const config=hlsConfig(url,12.5,origin);assert.equal(config.startPosition,12.5);assert.equal(config.debug,false);assert.equal(config.manifestLoadPolicy.default.errorRetry.maxNumRetry,1);assert.equal(config.backBufferLength,30);
 const request=config.fetchSetup({url:origin+gatewayPath(nonce,'Videos/item/hls1/main/0.ts')},{credentials:'include'});assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');assert.equal(request.referrerPolicy,'no-referrer');assert.equal(request.cache,'no-store');
 for(const target of ['https://evil.invalid'+url,origin+url+'?api_key=secret',origin+'/__frame_media/other/session',origin+'/Items/item'])assert.throws(()=>config.fetchSetup({url:target},{}));
 for(const target of ['https://evil.invalid'+url,'/test-media/frame-test.m3u8',url+'?token=secret'])assert.throws(()=>hlsConfig(target,0,origin));
});
test('adapter attaches once, recovers a media failure once, and reports subsequent fatal errors once',()=>{
 let errors=0;const video={};const close=attachEngine(Engine,hlsConfig(url,0,origin),video,url,()=>errors++);const hls=Engine.instance;
 assert.equal(hls.video,video);assert.deepEqual(hls.loaded,[url]);hls.error('mediaError',false);assert.equal(hls.recoveries,0);hls.error('mediaError');assert.equal(hls.recoveries,1);hls.error('mediaError');hls.error('networkError');assert.equal(errors,1);assert.equal(hls.stops,1);close();close();assert.equal(hls.destroys,1);hls.error('mediaError');assert.equal(errors,1);
});
test('network failure is terminal after engine retries; abort detaches once and rejects stale loads',()=>{
 let errors=0;const controller=new AbortController();const close=attachEngine(Engine,{}, {},url,()=>errors++,controller.signal);const hls=Engine.instance;hls.error('networkError');assert.equal(errors,1);assert.equal(hls.recoveries,0);controller.abort();close();assert.equal(hls.destroys,1);assert.throws(()=>attachEngine(Engine,{}, {},url,()=>{},controller.signal),/closed/);
});
test('headless environments without MediaSource do not advertise HLS support',async()=>assert.equal(await mseHlsSupport(),false));

test('HLS diagnostics include safe HTTP status and category even for nonfatal errors',()=>{
 const events=[];const close=attachEngine(Engine,{}, {},url,()=>{},undefined,event=>events.push(event));
 Engine.instance.listeners.error('error',{type:'networkError',details:'manifestLoadError',fatal:false,response:{code:502,url:'https://secret.invalid/?api_key=private'},error:new Error('private')});
 assert.deepEqual(events,[{reason:'playlist',fatal:false,status:502}]);close();
});
test('subtitle overlay uses only active plain text, omits empty cues and clears outside cue intervals',()=>{
 assert.deepEqual(activeCaptionText({activeCues:null}),[]);
 assert.deepEqual(activeCaptionText({activeCues:[{text:'<i>Hello</i>',getCueAsHTML:()=>({textContent:'Hello'})},{text:' '},{text:'A second line\ncontinues'}]}),['Hello','A second line\ncontinues']);
 assert.deepEqual(activeCaptionText({activeCues:[{text:'<script>literal</script>'}]}),['literal']);
});
