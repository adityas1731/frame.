import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {createServer} from 'vite';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {ConnectionGate}=await server.ssrLoadModule('/src/components/ConnectionGate.tsx');
const {ConnectionContext}=await server.ssrLoadModule('/src/jellyfin/context.ts');
function render(state,path='/'){
  return renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:[path]},createElement(ConnectionContext.Provider,{value:{session:null,saved:null,unavailable:false,resumeSaved:async()=>{},...state}},createElement(ConnectionGate,null,createElement('p',null,'PROTECTED LIBRARY')))));
}
for(const path of ['/','/movies','/shows','/library','/watchlist','/favorites','/item/test','/play/test','/settings'])test(`saved offline session replaces entire ${path} page`,()=>{
  const html=render({saved:{user:{Name:'Private name'},token:'never-render-this-token',baseUrl:'http://private-server.invalid'}},path);
  assert.match(html,/Jellyfin Isn’t Available/);
  assert.match(html,/Try Again/);
  assert.match(html,/href="\/connect"/);
  assert.doesNotMatch(html,/PROTECTED LIBRARY|Private name|never-render-this-token|private-server|Still Waters|Wild Earth/);
});
test('connection form remains accessible while saved server is offline',()=>{
  assert.match(render({saved:{},unavailable:true},'/connect'),/PROTECTED LIBRARY/);
});
test('active session network failure also replaces stale content',()=>{
  assert.match(render({session:{},unavailable:true}),/Jellyfin Isn’t Available/);
  assert.doesNotMatch(render({session:{},unavailable:true}),/PROTECTED LIBRARY/);
});
test('authenticated connection renders real library after successful retry',()=>{
  assert.match(render({session:{},saved:{}}),/PROTECTED LIBRARY/);
  assert.doesNotMatch(render({session:{},saved:{}}),/Jellyfin Isn’t Available/);
});
test('new connections never render a demo library',()=>{
  assert.doesNotMatch(render({}),/PROTECTED LIBRARY|Still Waters|Wild Earth/);
  assert.match(render({},'/connect'),/PROTECTED LIBRARY/);
});
