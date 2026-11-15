import {test} from 'node:test';import assert from 'node:assert/strict';import {ticketResumeTime} from '../src/playback/ticketResume.ts';
test('ticket resume timestamp uses saved position, clamps to runtime and handles missing values',()=>{
 assert.deepEqual(ticketResumeTime({UserData:{PlaybackPositionTicks:4980*10000000},RunTimeTicks:8400*10000000}),{elapsed:'01:23',total:'02:20'});
 assert.deepEqual(ticketResumeTime({UserData:{PlaybackPositionTicks:9000*10000000},RunTimeTicks:8400*10000000}),{elapsed:'02:20',total:'02:20'});
 assert.deepEqual(ticketResumeTime({UserData:{PlaybackPositionTicks:4980*10000000}}),{elapsed:'01:23',total:undefined});
 for(const ticks of [0,-1,NaN,Infinity,undefined])assert.equal(ticketResumeTime({UserData:{PlaybackPositionTicks:ticks}}),null);
});
