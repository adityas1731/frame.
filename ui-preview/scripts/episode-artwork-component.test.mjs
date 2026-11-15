import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {CachedEpisodeStill}=await server.ssrLoadModule('/src/components/CachedEpisodeStill.tsx');
test('provider still has explicit card sizing without relying on episode-grid parent CSS',()=>{
 const markup=renderToStaticMarkup(createElement('div',{className:'poster'},createElement(CachedEpisodeStill,{source:'data:image/svg+xml,<svg/>',onFailure(){}})));
 assert.match(markup,/<img/);assert.match(markup,/width:100%/);assert.match(markup,/height:100%/);assert.match(markup,/object-fit:cover/);assert.match(markup,/object-position:center/);
});
