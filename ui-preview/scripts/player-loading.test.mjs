import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {PlayerLoading}=await server.ssrLoadModule('/src/playback/PlayerLoading.tsx');
for(const [phase,label] of [['buffering','Buffering'],['seeking','Seeking'],['negotiating','Preparing playback'],['idle','Loading']])test(`loading status identifies ${phase}`,()=>{
 const html=renderToStaticMarkup(createElement(PlayerLoading,{active:true,phase}));
 assert.match(html,new RegExp(label));assert.match(html,/role="status"/);assert.match(html,/aria-hidden="false"/);assert.match(html,/data-active="true"/);
});
test('settled playback keeps the transition surface but clears its status',()=>{
 const html=renderToStaticMarkup(createElement(PlayerLoading,{active:false,phase:'playing'}));
 assert.match(html,/aria-hidden="true"/);assert.doesNotMatch(html,/data-active|Buffering|Preparing playback|Seeking|Loading/);
});
