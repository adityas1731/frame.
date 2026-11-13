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
function render(streams,selected,overrides={}){
 const source={Id:'source',SupportsTranscoding:true,MediaStreams:streams};const state={phase:'playing',canHls:true,plan:{source,subtitleIndex:selected,subtitle:selected>=0?'/vtt':undefined},...overrides};const calls=[];let tree;
 function Probe(){tree=PlayerSettings({state,initialTab:'captions',caption:{version:2,font:'system',size:100,background:true,opacity:50},changeCaption(){},sync(){},close(){},change:v=>calls.push(v),loadCustom:async()=>{},selectCustom:()=>calls.push('custom'),selectAdditional:id=>calls.push(id)});return tree;}
 const html=renderToStaticMarkup(createElement(Probe));const nodes=[];function visit(n){if(Array.isArray(n)){n.forEach(visit);return;}if(!n||typeof n!=='object')return;nodes.push(n);visit(n.props?.children);}visit(tree);
 return {html,calls,options:nodes.filter(n=>n.type==='button'&&n.props.role==='radio')};
}
test('reported movie: all four actual Nordic subtitle streams remain selectable and the default is visibly selected',()=>{
 const tracks=[subtitle(2,'dan',{Title:'Dansk',IsDefault:true}),subtitle(3,'fin',{Title:'Finsk'}),subtitle(4,'nor',{Title:'Norsk'}),subtitle(5,'swe',{Title:'Svensk'})];
 const r=render(tracks,2);assert.equal(r.options.length,5);assert.equal(r.options[0].props['aria-checked'],false);assert.equal(r.options[1].props['aria-checked'],true);assert.match(r.html,/Dansk.*Default/);assert.doesNotMatch(r.html,/No subtitle tracks/);
 r.options[4].props.onClick();r.options[0].props.onClick();assert.deepEqual(r.calls,[{subtitleIndex:5},{subtitleIndex:-1}]);
});
test('DTO and real selector preserve SDH, forced flags and sparse stream indices',()=>{
 const info=parsePlaybackInfo({PlaySessionId:'synthetic',MediaSources:[{Id:'source',MediaStreams:[subtitle(17,'eng',{IsForced:true,IsHearingImpaired:true,IsExternal:true})]}]});
 const r=render(info.MediaSources[0].MediaStreams,17);assert.match(r.html,/Forced.*SDH/);assert.match(r.html,/External text/);r.options[1].props.onClick();assert.deepEqual(r.calls,[{subtitleIndex:17}]);
});
test('image subtitles show burn-in limits and remain listed when unsupported',()=>{
 const tracks=[subtitle(6,'eng',{Codec:'pgssub',DeliveryMethod:'Encode'})];const r=render(tracks,6,{canHls:false});assert.equal(r.options.length,2);assert.equal(r.options[1].props.disabled,true);assert.match(r.html,/rendered into the video/);
});
test('custom track and manifest track selection never show Off selected',()=>{
 const r=render([], -1,{customSubtitle:{name:'mine.en.srt'},customSubtitleSelected:true});assert.equal(r.options[0].props['aria-checked'],false);assert.equal(r.options[1].props['aria-checked'],true);assert.match(r.html,/Load Subtitle File/);assert.match(r.html,/Load From URL/);
 const h=render([],-1,{additionalSubtitles:[{id:'hls:0',label:'Swedish',source:'hls'}],additionalSubtitleSelected:'hls:0'});assert.equal(h.options[0].props['aria-checked'],false);h.options[1].props.onClick();assert.deepEqual(h.calls,['hls:0']);
});
test('subtitle controls stay disabled during negotiation',()=>{
 const r=render([subtitle(9,'eng')],-1,{phase:'negotiating'});assert.ok(r.options.every(n=>n.props.disabled));
});
