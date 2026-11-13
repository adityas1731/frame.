import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {normalizeCollectionLayout}=await server.ssrLoadModule('/src/state/collectionLayout.ts');
const {Pagination}=await server.ssrLoadModule('/src/pages/LiveShared.tsx');
test('existing watchlist size and spacing seed the unified layout',()=>{
 const result=normalizeCollectionLayout(null,{width:240,gap:30});assert.equal(result.width,240);assert.equal(result.gap,30);assert.equal(result.view,'grid');assert.equal(result.pageSize,40);
});
test('invalid stored layout stays bounded and supported',()=>{
 const result=normalizeCollectionLayout({width:Infinity,gap:-30,radius:900,pageSize:100000,view:'invalid',titles:false,ratings:false});
 assert.equal(result.width,172);assert.equal(result.gap,8);assert.equal(result.radius,32);assert.equal(result.pageSize,40);assert.equal(result.view,'grid');assert.equal(result.titles,false);assert.equal(result.ratings,false);
});
test('pagination uses the selected page size in both directions and on the final page',()=>{
 const clicks=[];const props={start:24,total:50,count:12,pageSize:12,loading:false,change:value=>clicks.push(value)};
 const element=Pagination(props);const buttons=element.props.children.filter(child=>child?.type==='button');buttons[0].props.onClick();buttons[1].props.onClick();assert.deepEqual(clicks,[12,36]);
 const html=renderToStaticMarkup(createElement(Pagination,{...props,start:48,count:2}));assert.match(html,/49–50 of 50/);assert.match(html,/disabled="">Next/);
});
