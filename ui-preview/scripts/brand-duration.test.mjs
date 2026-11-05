import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatMinutes,formatPlaybackTime,formatPlaybackProgress,formatPlaybackClock} from '../src/platform/duration.ts';
import {runtime} from '../src/jellyfin/presentation.ts';
import {trackLabel,visibleLanguage} from '../src/playback/languages.ts';
test('human durations handle hour boundaries without changing tick or minute values',()=>{
 for(const [input,expected] of [[0,'00:00'],[59,'00:59'],[60,'01:00'],[62,'01:02'],[120,'02:00'],[149,'02:29']])assert.equal(formatMinutes(input),expected);
 assert.equal(runtime({RunTimeTicks:62*600000000}),'01:02');assert.equal(runtime({}),null);assert.equal(formatMinutes(NaN),'');assert.equal(formatMinutes(-1),'');
});
test('localized audio and subtitle annotations never leak Hindi labels or change stream indices',()=>{
 for(const type of ['Audio','Subtitle'])for(const title of ['English - प्राथमिक','प्राथमिक','English (प्राथमिक)','English - डिफ़ॉल्ट']){
  const track={Type:type,Index:9,Language:'eng',DisplayTitle:title,IsDefault:true};const before=structuredClone(track);
  assert.equal(visibleLanguage(track),true);assert.doesNotMatch(trackLabel(track),/[\u0900-\u097f]/u);assert.match(trackLabel(track),/Default/);assert.deepEqual(track,before);
 }
 assert.doesNotMatch(trackLabel({Index:8,Language:'eng',Title:'अज्ञात',Codec:'subrip'}),/[\u0900-\u097f]/u);
 for(const language of ['hi','hin','hi-IN'])assert.equal(visibleLanguage({Index:1,Language:language,DisplayTitle:'Hindi - SUBRIP'}),false);
});

test('compact playback progress omits seconds and preserves hour boundaries',()=>{
 assert.equal(formatPlaybackProgress(2490,8940),'00:41 / 02:29');
 assert.equal(formatPlaybackProgress(3599,3600),'00:59 / 01:00');
 assert.equal(formatPlaybackProgress(5,3737),'00:00 / 01:02');
 assert.equal(formatPlaybackProgress(4000,3600),'01:00 / 01:00');
 assert.equal(formatPlaybackProgress(90),'00:01');
 assert.equal(formatPlaybackTime(NaN),'00:00');
});

test('precise player clock includes seconds independently of compact cards',()=>{
 assert.equal(formatPlaybackClock(83),'00:01:23');
 assert.equal(formatPlaybackClock(8974.9),'02:29:34');
 assert.equal(formatPlaybackClock(3599.9),'00:59:59');
 assert.equal(formatPlaybackClock(3600),'01:00:00');
 assert.equal(formatPlaybackClock(-1),'00:00:00');
 assert.equal(formatPlaybackClock(NaN),'00:00:00');
 assert.equal(formatPlaybackTime(8974.9),'02:29');
});
