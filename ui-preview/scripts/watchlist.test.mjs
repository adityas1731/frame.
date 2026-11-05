import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {createServer} from 'vite';
const vite=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>vite.close());
const store=await vite.ssrLoadModule('/src/state/WatchlistContext.tsx');
const {PreviewProvider}=await vite.ssrLoadModule('/src/state/PreviewContext.tsx');
const {ConnectionContext}=await vite.ssrLoadModule('/src/jellyfin/context.ts');
const {WatchlistPage}=await vite.ssrLoadModule('/src/pages/Watchlist.tsx');
const {WatchlistToggle}=await vite.ssrLoadModule('/src/components/WatchlistToggle.tsx');
function render(child){return renderToStaticMarkup(h(PreviewProvider,null,h(ConnectionContext.Provider,{value:{session:{baseUrl:"https://fixture.invalid",server:{Id:"fixture"},user:{Id:"viewer"}}}},h(store.WatchlistProvider,null,h(MemoryRouter,null,child)))));}
test('watchlist validates stored IDs, deduplicates and bounds layout preferences',()=>{assert.deepEqual(store.normalizeList({ids:['abc','abc','../private','',42],width:999,gap:-8}),{ids:['abc'],width:260,gap:8});assert.deepEqual(store.normalizeList({ids:'bad',width:NaN,gap:Infinity}),{ids:[],width:172,gap:20});});
test('watchlist storage separates servers and users without including credentials',()=>{assert.notEqual(store.watchlistKey('server-a','user'),store.watchlistKey('server-b','user'));assert.notEqual(store.watchlistKey('server-a','user-a'),store.watchlistKey('server-a','user-b'));});
test('actual watchlist page presents a useful empty state and layout controls',()=>{const html=render(h(WatchlistPage));assert.match(html,/Watchlist/);assert.match(html,/Save Something For Later/);assert.match(html,/Explore Your Library/);assert.match(html,/Layout/);assert.doesNotMatch(html,/Coming Later|portable Jellyfin/);});
test('actual title watchlist control exposes an accessible bookmark action',()=>{const html=render(h(WatchlistToggle,{item:{Id:'new-item',Name:'A New Story',Type:'Movie'},variant:'button'}));assert.match(html,/Add to watchlist: A New Story/);assert.match(html,/aria-pressed="false"/);assert.match(html,/Watchlist/);});
