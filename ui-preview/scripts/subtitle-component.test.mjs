import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {parsePlaybackInfo} from '../src/playback/protocol.ts';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {PlayerSettings}=await server.ssrLoadModule('/src/playback/PlayerSettings.tsx');
const subtitle=(Index,Language,extra={})=>({Type:'Subtitle',Index,Language,Codec:'subrip',...extra});
function render(streams,selected,overrides={},initialTab='captions',captionOverride={}){
 const source={Id:'source',SupportsTranscoding:true,MediaStreams:streams};const state={phase:'playing',canHls:true,plan:{source,subtitleIndex:selected,subtitle:selected>=0?'/vtt':undefined},...overrides};const calls=[];let tree;
 function Probe(){tree=PlayerSettings({state,initialTab,caption:{version:2,font:'system',size:100,background:true,opacity:50,...captionOverride},changeCaption(){},sync(){},close(){},change:v=>calls.push(v),loadCustom:async()=>{},selectCustom:()=>calls.push('custom'),selectAdditional:id=>calls.push(id)});return tree;}
 const html=renderToStaticMarkup(createElement(Probe));const nodes=[];function visit(n){if(Array.isArray(n)){n.forEach(visit);return;}if(!n||typeof n!=='object')return;nodes.push(n);visit(n.props?.children);}visit(tree);
 const selector=nodes.find(n=>n.props?.['aria-label']==='Subtitle track');
 return {html,calls,nodes,selector,options:[selector?.props.children].flat(Infinity).filter(n=>n?.type==='option'),choose:value=>selector.props.onValueChange(value)};
}
test('reported movie: all four actual Nordic subtitle streams remain selectable and the default is visibly selected',()=>{
 const tracks=[subtitle(2,'dan',{Title:'Dansk',IsDefault:true}),subtitle(3,'fin',{Title:'Finsk'}),subtitle(4,'nor',{Title:'Norsk'}),subtitle(5,'swe',{Title:'Svensk'})];
 const r=render(tracks,2);assert.equal(r.options.length,5);assert.equal(r.selector.props.value,'jf:2');assert.match(r.html,/Dansk.*Default/);assert.doesNotMatch(r.html,/No subtitle tracks/);
 r.choose('jf:5');r.choose('off');assert.deepEqual(r.calls,[{subtitleIndex:5},{subtitleIndex:-1}]);
});
test('DTO and real selector preserve SDH, forced flags and sparse stream indices',()=>{
 const info=parsePlaybackInfo({PlaySessionId:'synthetic',MediaSources:[{Id:'source',MediaStreams:[subtitle(17,'eng',{IsForced:true,IsHearingImpaired:true,IsExternal:true})]}]});
 const r=render(info.MediaSources[0].MediaStreams,17);assert.match(r.html,/Forced.*SDH/);r.choose('jf:17');assert.deepEqual(r.calls,[{subtitleIndex:17}]);
});
test('image subtitles show burn-in limits and remain listed when unsupported',()=>{
 const tracks=[subtitle(6,'eng',{Codec:'pgssub',DeliveryMethod:'Encode'})];const r=render(tracks,6,{canHls:false});assert.equal(r.options.length,2);assert.equal(r.options[1].props.disabled,true);assert.match(r.html,/rendered into the video/);
});
test('custom track and manifest track selection never show Off selected',()=>{
 const r=render([], -1,{customSubtitle:{name:'mine.en.srt'},customSubtitleSelected:true});assert.equal(r.selector.props.value,'custom');assert.match(r.html,/Load Subtitle File/);assert.match(r.html,/Load From URL/);
 const h=render([],-1,{additionalSubtitles:[{id:'hls:0',label:'Swedish',source:'hls'}],additionalSubtitleSelected:'hls:0'});assert.equal(h.selector.props.value,'extra:hls:0');h.choose('extra:hls:0');assert.deepEqual(h.calls,['hls:0']);
});
test('subtitle controls stay disabled during negotiation',()=>{
 const r=render([subtitle(9,'eng')],-1,{phase:'negotiating'});assert.equal(r.selector.props.disabled,true);r.choose('jf:9');assert.deepEqual(r.calls,[]);
});


test('large subtitle lists keep original indices and one compact selector',()=>{
 const r=render(Array.from({length:15},(_,i)=>subtitle(30+i,'eng',{Title:`Track ${i+1}`})),37);
 assert.equal(r.options.length,16);assert.equal(r.selector.props.value,'jf:37');r.choose('jf:44');assert.deepEqual(r.calls,[{subtitleIndex:44}]);
 assert.doesNotMatch(r.html,/role="radiogroup"/);
});


test('quality panel shows decoded resolution without a duplicate bitrate summary',()=>{
 const source={Id:'source',SupportsTranscoding:true,MediaStreams:[{Type:'Video',Index:0,Width:3840,Height:2160}]};
 const r=render([],-1,{videoHeight:2160,plan:{source,mode:'transcode',selection:{maxBitrate:20000000},info:{MediaSources:[source]}}},'quality');
 assert.match(r.html,/2160p/);assert.doesNotMatch(r.html,/Mbps limit/);assert.doesNotMatch(r.html,/3840|Source ·/);
 const resolution=r.nodes.find(n=>n.props?.['aria-label']==='Playback resolution');resolution.props.onValueChange('1080');
 const quality=r.nodes.find(n=>n.props?.['aria-label']==='Playback quality');quality.props.onValueChange('8000000');
 assert.deepEqual(r.calls,[{maxHeight:1080,forceTranscode:false},{maxBitrate:8000000,forceTranscode:false}]);
});

test('Direct Play quality keeps bitrate in its selector only',()=>{
 const source={Id:'source',Bitrate:12500000,MediaStreams:[]};
 const r=render([],-1,{videoHeight:1080,plan:{source,mode:'direct',selection:{maxBitrate:40000000},info:{MediaSources:[source]}}},'quality');
 assert.match(r.html,/1080p/);assert.doesNotMatch(r.html,/12.5 Mbps/);assert.doesNotMatch(r.html,/40 Mbps limit/);
});


test('subtitle custom font exposes its own saved family and uses the registered local alias',()=>{
 const r=render([], -1,{},'captions',{font:'custom',customFont:'Agrave Pro'});
 assert.match(r.html,/Installed Font Family/);assert.match(r.html,/value="Agrave Pro"/);
 assert.match(r.html,/font-family:&quot;frame-local-/);assert.match(r.html,/Leave blank to use the custom font from Appearance/);
});

test('quality status reports cropped decoded 4K and does not equate requested quality with actual output',()=>{
 const plan={source:{Id:'source',SupportsTranscoding:true,MediaStreams:[{Type:'Video',Index:0,Width:3840,Height:1920}]},selection:{maxHeight:2160,maxBitrate:40000000},info:{MediaSources:[]}};
 const cropped=render([], -1,{plan,videoWidth:3840,videoHeight:1920},'quality');assert.match(cropped.html,/Decoded frame: 3840 × 1920[^>]*>2160p<\/strong>/);
 const scaled=render([], -1,{plan,videoWidth:1920,videoHeight:1080},'quality');assert.match(scaled.html,/Decoded frame: 1920 × 1080[^>]*>1080p<\/strong>/);
});
