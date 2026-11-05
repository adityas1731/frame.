import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resumeProgress} from '../src/playback/resumeProgress.ts';
test('resume display derives watched/remaining progress from ticks without changing playback state',()=>{
 const result=resumeProgress(567,3240*10000000);assert.equal(result.position,567);assert.equal(result.remaining,2673);assert.equal(result.percent,17.5);
});
test('resume display clamps stale or invalid positions and avoids invented duration',()=>{
 assert.deepEqual(resumeProgress(700,600*10000000),{position:600,remaining:0,percent:100});
 assert.deepEqual(resumeProgress(-1,600*10000000),{position:0,remaining:600,percent:0});
 assert.deepEqual(resumeProgress(NaN),{position:0,remaining:undefined,percent:undefined});
 assert.deepEqual(resumeProgress(567,0),{position:567,remaining:undefined,percent:undefined});
});
