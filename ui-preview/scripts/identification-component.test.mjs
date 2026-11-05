import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {IdentifyMedia}=await server.ssrLoadModule('/src/components/IdentifyMedia.tsx');
const {ConnectionContext}=await server.ssrLoadModule('/src/jellyfin/context.ts');
for(const [admin,type,visible] of [[false,'Series',false],[true,'Series',true],[true,'Movie',true],[true,'Episode',false]])test(`actual correction control admin=${admin} type=${type}`,()=>{
 const html=renderToStaticMarkup(createElement(ConnectionContext.Provider,{value:{client:{},session:{user:{Policy:{IsAdministrator:admin}}}}},createElement(IdentifyMedia,{item:{Id:'item',Type:type},onApplied:()=>{}})));
 assert.equal(html.includes('Update Metadata'),visible);assert.doesNotMatch(html,/Apply identification/);
});
