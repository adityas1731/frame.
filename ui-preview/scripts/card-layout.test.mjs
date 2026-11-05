import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitWidgetCards} from '../src/studio/cardLayout.ts';

test('whole cards fill desktop and mobile rows without exposing a clipped next card',()=>{
 for(const viewport of [280,342,390,768,1280,1760,2360]){
  for(const target of [150,172,220,260,360,492]){
   for(const gap of [8,20,40]){
    const result=fitWidgetCards(viewport,target,gap);
    assert.ok(result.columns>=1);
    assert.ok(result.width>0&&result.width<=viewport);
    assert.ok(Math.abs(result.columns*result.width+(result.columns-1)*gap-viewport)<.001);
    assert.ok(result.columns*(result.width+gap)>viewport);
   }
  }
 }
});
test('poster size and section size adjust the count instead of cutting edge cards',()=>{
 const small=fitWidgetCards(1800,240,20),large=fitWidgetCards(1800,420,20);
 assert.ok(small.columns>large.columns);
 assert.ok(small.width<large.width);
 assert.deepEqual(fitWidgetCards(342,492,20),{columns:1,width:342});
});
