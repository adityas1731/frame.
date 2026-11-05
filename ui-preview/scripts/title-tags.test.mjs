import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {normalizeTags}=await server.ssrLoadModule('/src/state/TitleTags.tsx');

const {JellyfinClient}=await server.ssrLoadModule('/src/jellyfin/client.ts');
const {taggedIds,tagSelection,selectedTag,loadTaggedItems}=await server.ssrLoadModule('/src/state/tagSelection.ts');
const {widget,widgetQuery,normalizeStudio,defaultStudio}=await server.ssrLoadModule('/src/studio/model.ts');


test('custom tags normalize names and duplicates without changing the supplied record',()=>{
 const input={movie:['  Weekend   Watch  ','weekend watch','Halloween'],show:['Science Fiction']};
 const before=structuredClone(input);const result=normalizeTags(input);
 assert.deepEqual(result.movie,['weekend watch','Halloween']);
 assert.deepEqual(result.show,['Science Fiction']);assert.deepEqual(input,before);
 assert.deepEqual(normalizeTags(JSON.parse(JSON.stringify(result))),result);
});
test('custom tags reject malformed records and bound titles, tags and label lengths',()=>{
 for(const value of [null,undefined,[],false,'bad'])assert.deepEqual(normalizeTags(value),{});
 assert.deepEqual(normalizeTags({'../private':['x'],movie:[false,null,'','x'.repeat(41)]}),{});
 const tags=Array.from({length:30},(_,i)=>`Tag ${i}`);
 assert.equal(normalizeTags({movie:tags}).movie.length,20);
 const items=Object.fromEntries(Array.from({length:600},(_,i)=>[`item-${i}`,['Test']]));
 assert.equal(Object.keys(normalizeTags(items)).length,500);
});
test('removing a title tag does not erase another title and empty tags disappear',()=>{
 const previous={movie:['Weekend'],show:['Weekend']};
 const next=normalizeTags({...previous,movie:[]});
 assert.deepEqual(next,{show:['Weekend']});assert.deepEqual(previous.movie,['Weekend']);
});

test('tag lookup includes both a movie and a TV series using their original IDs',async()=>{
 const entries=[{Id:'michael',Name:'Michael',Type:'Movie'},{Id:'boondocks',Name:'The Boondocks',Type:'Series'}];
 const ids=taggedIds({michael:['Weekend'],boondocks:['weekend']},'Weekend');
 const client=new JellyfinClient('https://fixture.invalid','device',async(url)=>{
  const params=new URL(url).searchParams;
  const types=params.get('includeItemTypes').split(',');
  const requested=params.get('ids').split(',');
  const Items=entries.filter(item=>types.includes(item.Type)&&requested.includes(item.Id));
  return new Response(JSON.stringify({Items,TotalRecordCount:Items.length}));
 });
 try {const result=await client.itemsById('user',ids,undefined,'Movie,Series,Episode,Audio,MusicAlbum,MusicVideo');assert.deepEqual(result.Items.map(item=>item.Id),ids);}finally{client.dispose();}
});

test('custom tag sections retain library/media filters and never send personal tags as server genres',async()=>{
 const w={...widget('custom'),source:'genre',genre:tagSelection('Weekend'),media:'Series',library:'tv',limit:12};
 const config=normalizeStudio({...defaultStudio(),widgets:[w]});
 assert.equal(selectedTag(config.widgets[0].genre),'Weekend');
 const query=widgetQuery(config.widgets[0]);assert.equal(query.genre,undefined);
 const client=new JellyfinClient('https://fixture.invalid','device',async(url)=>{
  const params=new URL(url).searchParams;
  assert.equal(params.get('genres'),null);assert.equal(params.get('parentId'),'tv');
  assert.equal(params.get('includeItemTypes'),'Series');assert.equal(params.get('ids'),'michael,boondocks');
  return new Response(JSON.stringify({Items:[{Id:'boondocks',Name:'The Boondocks',Type:'Series'}],TotalRecordCount:1}));
 });
 try{const result=await loadTaggedItems(['michael','boondocks'],query,part=>client.items('user',part));assert.deepEqual(result.map(item=>item.Id),['boondocks']);}finally{client.dispose();}
});

test('tag sections fetch every ID batch then apply one global order and display limit',async()=>{
 const ids=Array.from({length:85},(_,index)=>`item-${index}`);const calls=[];
 const result=await loadTaggedItems(ids,{sort:'CommunityRating',limit:5},async query=>{
  calls.push(query.ids);return {Items:query.ids.map(Id=>({Id,Name:Id,CommunityRating:Number(Id.split('-')[1])})),TotalRecordCount:query.ids.length};
 });
 assert.deepEqual(calls.map(batch=>batch.length),[40,40,5]);
 assert.deepEqual(result.map(item=>item.Id),['item-84','item-83','item-82','item-81','item-80']);
 assert.deepEqual(await loadTaggedItems([],{limit:12},()=>assert.fail('empty tag must not fetch the library')),[]);
});
