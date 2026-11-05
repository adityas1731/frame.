import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {runtimePlan} from '../src/playback/planner.ts';

// Render the real component with React's server renderer. Retain its actual element
// tree to invoke enabled buttons' original callbacks, without mocking hooks or JSX.
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {PlayerSettings}=await server.ssrLoadModule('/src/playback/PlayerSettings.tsx');
const audio=(Index,Language,extra={})=>({Type:'Audio',Index,Language,Codec:'aac',DisplayTitle:`Audio ${Index}`,...extra});
function render(tracks,current,overrides={}){
 const source={Id:'source',Container:'mp4',SupportsDirectPlay:true,SupportsDirectStream:true,SupportsTranscoding:true,TranscodingUrl:'/Videos/item/master.m3u8',MediaStreams:[{Type:'Video',Index:0,Codec:'h264'},...tracks]};
 const state={phase:'playing',canHls:true,plan:{audioIndex:current,subtitleIndex:-1,mode:'direct',source,selection:{startTicks:0,maxBitrate:40000000}},...overrides};
 const calls=[];let tree;
 function Probe(){tree=PlayerSettings({state,initialTab:'audio',caption:{version:2,font:'system',size:100,background:true,opacity:50},change:value=>calls.push(value),changeCaption(){},sync(){},close(){}});return tree;}
 const html=renderToStaticMarkup(createElement(Probe));const nodes=[];
 function visit(node){if(Array.isArray(node)){node.forEach(visit);return;}if(!node||typeof node!=='object')return;nodes.push(node);visit(node.props?.children);}
 visit(tree);const options=nodes.filter(node=>node.type==='button'&&node.props.role==='radio');
 return {state,html,calls,options,click(index){const button=options[index];assert.ok(button);assert.equal(button.props.disabled,false,'a disabled control cannot dispatch');button.props.onClick();}};
}
test('component: hidden active audio with one visible alternative can switch its original index',()=>{
 const r=render([audio(3,'deu'),audio(9,'eng')],3);assert.equal(r.options.length,1);r.click(0);assert.deepEqual(r.calls,[{audioIndex:9}]);assert.doesNotMatch(r.html,/This version has one audio track/);
});
test('component: hidden active audio with multiple alternatives preserves both indices',()=>{
 const r=render([audio(3,'deu'),audio(9,'eng'),audio(17,'fra')],3);r.click(0);r.click(1);assert.deepEqual(r.calls,[{audioIndex:9},{audioIndex:17}]);
});
test('component: active English with hidden German exposes no false alternative',()=>{
 const r=render([audio(3,'eng'),audio(9,'deu')],3);assert.equal(r.options.length,1);assert.equal(r.options[0].props['aria-checked'],true);assert.equal(r.options[0].props.disabled,true);assert.deepEqual(r.calls,[]);
});
test('component: one actual stream is shown selected without a switching action',()=>{
 const r=render([audio(11,'eng')],11);assert.equal(r.options.length,1);assert.equal(r.options[0].props.disabled,true);assert.match(r.html,/This version has one audio track/);
});
test('component: same-language tracks remain distinct even with identical display labels',()=>{
 const r=render([audio(4,'eng',{DisplayTitle:'English'}),audio(8,'eng',{DisplayTitle:'English'})],4);assert.equal(r.options.length,2);assert.equal(r.options[0].props.disabled,true);r.click(1);assert.deepEqual(r.calls,[{audioIndex:8}]);
});
test('component: undeclared languages remain selectable without assigning a language',()=>{
 const tracks=[audio(2,undefined),audio(7,undefined)];const before=structuredClone(tracks);const r=render(tracks,2);r.click(1);assert.deepEqual(r.calls,[{audioIndex:7}]);assert.deepEqual(tracks,before);
});
test('component: English track with a localized status badge renders Default',()=>{
 const r=render([audio(7,'eng',{DisplayTitle:'English - Stereo - प्राथमिक'})],7);assert.match(r.html,/English - Stereo - Default/);assert.doesNotMatch(r.html,/प्राथमिक/);assert.equal(r.options[0].props['aria-checked'],true);
});
for(const phase of ['idle','negotiating','switching','failed','disposed'])test(`component: ${phase} cannot dispatch an audio change`,()=>{
 const r=render([audio(3,'deu'),audio(9,'eng'),audio(17,'fra')],3,{phase});assert.ok(r.options.every(node=>node.props.disabled));assert.deepEqual(r.calls,[]);
});
test('component: unsupported browser switching remains disabled',()=>{
 const r=render([audio(3,'deu'),audio(9,'eng')],3,{canHls:false});assert.ok(r.options.every(node=>node.props.disabled));
});
test('component: server without remux/transcode capability cannot switch audio',()=>{
 const tracks=[audio(3,'deu'),audio(9,'eng'),audio(17,'fra')];const base=render(tracks,3);const r=render(tracks,3,{plan:{...base.state.plan,source:{...base.state.plan.source,SupportsDirectStream:false,SupportsTranscoding:false}}});assert.ok(r.options.every(node=>node.props.disabled));
});
test('component: missing plan, malformed indices and codec-less alternatives are unavailable',()=>{
 const absent=render([],undefined,{plan:undefined});assert.equal(absent.options.length,0);
 const r=render([audio(3,'deu'),audio(-1,'eng'),audio(9,'eng',{Codec:undefined})],3);assert.ok(r.options.every(node=>node.props.disabled));
});
for(const mode of ['direct','remux','transcode'])test(`component: ${mode} selection hands the original index to real playback planning`,async()=>{
 const base=render([audio(3,'deu'),audio(9,'eng')],3);const r=render(base.state.plan.source.MediaStreams.filter(t=>t.Type==='Audio'),3,{plan:{...base.state.plan,mode}});r.click(0);
 const selection={startTicks:120000000,maxBitrate:40000000,...r.calls[0]};
 const plan=await runtimePlan('item',{PlaySessionId:'synthetic',MediaSources:[r.state.plan.source]},{nativeHls:false,mseHls:true,canDirect:async()=>true},selection,'device');
 assert.equal(plan.audioIndex,9);assert.equal(plan.selection.audioIndex,9);assert.equal(plan.selection.startTicks,120000000);assert.notEqual(plan.mode,'direct','alternate embedded audio requires server negotiation');
});
test('component: selecting the primary track can return an HLS plan to Direct Play',async()=>{
 const r=render([audio(9,'eng'),audio(3,'deu')],3);r.click(0);
 const plan=await runtimePlan('item',{PlaySessionId:'synthetic',MediaSources:[r.state.plan.source]},{nativeHls:false,mseHls:true,canDirect:async()=>true},{startTicks:120000000,maxBitrate:40000000,...r.calls[0]},'device');
 assert.equal(plan.mode,'direct');assert.equal(plan.audioIndex,9);
});
