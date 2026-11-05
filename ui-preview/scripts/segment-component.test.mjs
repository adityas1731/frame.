import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {skippingPreferences} from '../src/playback/segments.ts';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {SegmentSettings}=await server.ssrLoadModule('/src/playback/SegmentSettings.tsx');
const {PlayerSettings}=await server.ssrLoadModule('/src/playback/PlayerSettings.tsx');
const prefs=skippingPreferences(null);
const render=info=>renderToStaticMarkup(createElement(SegmentSettings,{info,preferences:prefs,change:()=>{}}));
test('real segment component shows timing ranges and missing types separately',()=>{
 const info={status:'ready',segments:[{type:'Outro',start:3102.182,end:3142.986,key:'credits'}]};const before=structuredClone(info);const html=render(info);
 assert.match(html,/51:42–52:22/);assert.match(html,/No timing yet/);assert.match(html,/Credits skipping/);assert.deepEqual(info,before);
});
for(const [status,message] of [['restricted','cannot read'],['unsupported','does not provide'],['unavailable','Could not check']])test(`real segment component explains ${status} without claiming no timings`,()=>{
 const html=render({status,segments:[]});assert.match(html,new RegExp(message));assert.doesNotMatch(html,/No timing yet/);
});
test('real segment component shows loading distinctly',()=>{assert.match(render(undefined),/Checking Jellyfin/);assert.doesNotMatch(render(undefined),/No timing yet/);});
test('real segment controls change only their selected type',()=>{
 const calls=[];const tree=SegmentSettings({info:{status:'ready',segments:[]},preferences:prefs,change:value=>calls.push(value)});
 const nodes=[];function visit(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}nodes.push(n);visit(n.props?.children);}visit(tree);
 const credits=nodes.find(n=>n.props?.['aria-label']==='Credits skipping');assert.ok(credits);credits.props.onValueChange('auto');
 assert.deepEqual(calls,[{...prefs,Outro:'auto'}]);assert.equal(prefs.Outro,'button');
});
test('real playback menu exposes the skipping panel without dispatching playback changes',()=>{
 const fail=()=>assert.fail('render must not change playback');const html=renderToStaticMarkup(createElement(PlayerSettings,{state:{phase:'idle',position:0,duration:0,paused:true,volume:1,muted:false,canHls:false},initialTab:'skipping',caption:{font:'system',size:100,background:true,opacity:50},changeCaption:fail,change:fail,sync:fail,close:fail,segmentInfo:{status:'ready',segments:[]},skipping:prefs,changeSkipping:fail}));
 assert.match(html,/Skipping/);assert.match(html,/Intro skipping/);assert.match(html,/Credits skipping/);
});
