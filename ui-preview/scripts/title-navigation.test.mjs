import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter,Routes,Route} from 'react-router';
import {createServer} from 'vite';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {rememberTitle,titlePreview}=await server.ssrLoadModule('/src/components/titleNavigation.ts');
const {LiveDetail}=await server.ssrLoadModule('/src/pages/LiveDetail.tsx');
const {ConnectionContext}=await server.ssrLoadModule('/src/jellyfin/context.ts');
const {OnlineContext}=await server.ssrLoadModule('/src/providers/context.ts');
const {StudioContext}=await server.ssrLoadModule('/src/studio/context.ts');
const {defaultStudio}=await server.ssrLoadModule('/src/studio/model.ts');
const {PreviewProvider}=await server.ssrLoadModule('/src/state/PreviewContext.tsx');
const {WatchlistProvider}=await server.ssrLoadModule('/src/state/WatchlistContext.tsx');
const {TitleTagsProvider}=await server.ssrLoadModule('/src/state/TitleTags.tsx');
const title={Id:'movie',Name:'Navigation Fixture',Type:'Movie',Genres:[],People:[]};
test('navigation previews are isolated by client and expire',()=>{
 const a={},b={};rememberTitle(a,title,0);
 assert.equal(titlePreview(a,'movie',100),title);assert.equal(titlePreview(b,'movie',100),undefined);
 assert.equal(titlePreview(a,'movie',30000),undefined);assert.equal(titlePreview(null,'movie'),undefined);
});
test('navigation preview keeps at most forty recently selected titles',()=>{
 const client={};for(let i=0;i<41;i++)rememberTitle(client,{...title,Id:`movie-${i}`},0);
 assert.equal(titlePreview(client,'movie-0',1),undefined);assert.equal(titlePreview(client,'movie-40',1)?.Id,'movie-40');
});
test('actual detail page immediately renders the selected title without a loading interstitial',()=>{
 const client={};rememberTitle(client,title);
 const state={client,session:{baseUrl:'https://fixture.invalid',server:{Id:'fixture'},user:{Id:'viewer',Policy:{}}}};
 const html=renderToStaticMarkup(h(ConnectionContext.Provider,{value:state},h(PreviewProvider,null,h(WatchlistProvider,null,h(StudioContext.Provider,{value:{scope:'navigation-fixture',config:defaultStudio()}},h(TitleTagsProvider,null,h(OnlineContext.Provider,{value:{client:null,simulated:false}},h(MemoryRouter,{initialEntries:['/item/movie']},h(Routes,null,h(Route,{path:'/item/:itemId',element:h(LiveDetail)}))))))))));
 assert.match(html,/<h1>Navigation Fixture<\/h1>/);assert.match(html,/class="detail-page"/);assert.doesNotMatch(html,/Loading titles|Updating from Jellyfin/);
});
