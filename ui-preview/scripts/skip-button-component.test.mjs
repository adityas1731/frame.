import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {SkipButton}=await server.ssrLoadModule('/src/playback/SkipButton.tsx');
for(const type of ['Intro','Outro'])test(`actual glass skip control mounts ${type} hidden before its reveal delay`,()=>{
 const html=renderToStaticMarkup(createElement(SkipButton,{segment:{type,start:0,end:20,key:'test'},visible:true,seek:()=>assert.fail('render must not seek')}));assert.match(html,type==='Intro'?/Skip Intro/:/Skip Credits/);assert.doesNotMatch(html,/segment-visible/);assert.match(html,/disabled=""/);assert.match(html,/aria-hidden="true"/);
});
test('absent or hidden segment leaves a disabled nonfocusable fade-out control',()=>{
 for(const segment of [undefined,{type:'Intro',start:5,end:20,key:'test'}]){const html=renderToStaticMarkup(createElement(SkipButton,{segment,visible:false,seek:()=>assert.fail('hidden control must not seek')}));assert.match(html,/disabled=""/);assert.match(html,/aria-hidden="true"/);assert.match(html,/tabindex="-1"/);assert.doesNotMatch(html,/segment-visible/);}
});
