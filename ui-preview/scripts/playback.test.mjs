import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparePlaybackPlan, PlaybackController, initialPlayback, transition, secondsToTicks, clampTicks } from '../src/playback/foundation.ts';
const source={ Id:'source', Container:'mp4', SupportsDirectPlay:true, SupportsTranscoding:true, TranscodingSubProtocol:'hls', RunTimeTicks:6000000000, MediaStreams:[{ Index:0,Type:'Video',Codec:'h264' },{ Index:1,Type:'Audio',Codec:'aac' },{ Index:2,Type:'Subtitle',Codec:'pgs' }] };
const info={ PlaySessionId:'synthetic-play-session',MediaSources:[source] };
const capabilities={ directContainers:['mp4'],videoCodecs:['h264'],audioCodecs:['aac'],nativeHls:false,mseHls:true };
function plan(overrides={}) { const result=preparePlaybackPlan('item',info,capabilities,overrides); assert.equal(result.ok,true); return result.plan; }
test('direct play requires both server permission and browser container/codec evidence', () => {
  assert.equal(plan().mode,'direct');
  assert.equal(preparePlaybackPlan('item',info,{...capabilities,videoCodecs:[]}).plan.mode,'hls');
  assert.equal(preparePlaybackPlan('item',info,{...capabilities,videoCodecs:[],mseHls:false}).ok,false);
});
test('HLS remux is distinct from transcoding and unsupported subtitle rendering cannot use direct play', () => {
  const remux=preparePlaybackPlan('item',{...info,MediaSources:[{...source,SupportsDirectPlay:false,SupportsDirectStream:true,SupportsTranscoding:false}]},capabilities);
  assert.equal(remux.plan.mode,'remux'); assert.equal(plan({subtitleIndex:2}).mode,'hls');
  assert.equal(preparePlaybackPlan('item',info,capabilities,{audioIndex:99}).reason,'unsupported-track');
});
test('server errors and missing session IDs cannot produce a ready plan', () => {
  assert.equal(preparePlaybackPlan('item',{ErrorCode:'NoCompatibleStream'},capabilities).reason,'server-error');
  assert.equal(preparePlaybackPlan('item',{MediaSources:[source]},capabilities).reason,'missing-session');
});
test('resume/seeks use ticks, clamp invalid ranges, and preserve explicit subtitle off', () => {
  assert.equal(secondsToTicks(1.25),12500000); assert.equal(secondsToTicks(NaN),0); assert.equal(clampTicks(-1),0);
  const result=plan({startTicks:source.RunTimeTicks+1,subtitleIndex:-1}); assert.equal(result.startTicks,source.RunTimeTicks); assert.equal(result.subtitleIndex,-1);
});
test('stale negotiation cannot attach after switching or disposal', () => {
  let state=transition(initialPlayback,{type:'request'}); const generation=state.generation;
  state=transition(state,{type:'switch'}); assert.equal(transition(state,{type:'negotiated',generation,plan:plan()}).phase,'switching');
  state=transition(state,{type:'dispose'}); assert.equal(transition(state,{type:'negotiated',generation:state.generation,plan:plan()}).phase,'disposed');
});
test('controller generates start once, progress in ticks, stopped once and a transcode cleanup intention', () => {
  const c=new PlaybackController(); c.dispatch({type:'request'}); c.dispatch({type:'negotiated',generation:c.state.generation,plan:{...plan(),mode:'hls'}});
  c.dispatch({type:'play'}); c.dispatch({type:'pause'}); c.dispatch({type:'play'}); c.dispatch({type:'position',ticks:123});
  const reports=c.drainReports(); assert.equal(reports.filter(r=>r.kind==='started').length,1); assert.equal(reports.at(-1).report.PositionTicks,123);
  const cleanup=c.release(); assert.equal(cleanup.stopEncoding,true); assert.equal(cleanup.stoppedReport.PositionTicks,123); assert.equal(c.release(),null);
  assert.equal(c.drainReports().filter(r=>r.kind==='stopped').length,1);
});
test('switching emits cleanup for the old session, and cancellation during negotiation is terminal', () => {
  const c=new PlaybackController(); c.dispatch({type:'request'}); c.dispatch({type:'negotiated',generation:c.state.generation,plan:plan()}); c.dispatch({type:'switch'});
  assert.equal(c.drainCleanup()[0].stopEncoding,false);
  c.release(); assert.equal(c.state.phase,'disposed');
  c.dispatch({type:'negotiated',generation:c.state.generation,plan:plan()}); assert.equal(c.state.phase,'disposed');
});
