import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFeatured,defaultFeatured,featuredIds} from '../src/state/featuredModel.ts';
test('banner normalization bounds local settings and isolates each page',()=>{
 const config=normalizeFeatured({discover:{hidden:['a','a',null],custom:true,selected:['b']},movies:{shuffle:false}});
 assert.deepEqual(config.discover.hidden,['a']);assert.equal(config.shows.shuffle,true);assert.equal(config.movies.shuffle,false);assert.deepEqual(config.shows.selected,[]);
 assert.deepEqual(normalizeFeatured(null).discover,defaultFeatured());
});
test('shuffled decks contain no duplicates, respect hidden/selected IDs and do not mutate inputs',()=>{
 const ids=['a','b','c','d','e','f'];const rule={...defaultFeatured(),hidden:['a'],custom:true,selected:['a','b','c','d']};const before=structuredClone(rule);
 assert.deepEqual(featuredIds(ids,rule,()=>0),['c','d','b']);assert.deepEqual(rule,before);assert.deepEqual(ids,['a','b','c','d','e','f']);
 assert.deepEqual(featuredIds(ids,{...rule,selected:[]}),[]);assert.deepEqual(featuredIds(['a','a','b'],{...defaultFeatured(),shuffle:false}),['a','b']);
 assert.equal(featuredIds(ids,defaultFeatured()).length,5);assert.notDeepEqual(featuredIds(ids,defaultFeatured(),()=>0),featuredIds(ids,defaultFeatured(),()=>.99));
});

test('banner counts persist per page and clamp to two through twenty without duplicating titles',()=>{
 const rules=normalizeFeatured({discover:{count:2},movies:{count:20},shows:{count:999}});const ids=Array.from({length:30},(_,i)=>String(i));
 assert.equal(featuredIds(ids,{...rules.discover,shuffle:false}).length,2);assert.equal(featuredIds(ids,rules.movies).length,20);assert.equal(rules.shows.count,20);
 assert.equal(normalizeFeatured({discover:{count:0}}).discover.count,2);assert.equal(normalizeFeatured({discover:{count:NaN}}).discover.count,5);
 assert.deepEqual(featuredIds(['a'],rules.movies),['a']);assert.equal(normalizeFeatured({}).discover.count,5);
});
