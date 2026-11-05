import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activeCaptionText,synchronizedCaptionText,subtitleDelaySeconds,cleanSubtitleText} from '../src/playback/subtitles.ts';
import {captionAppearance,captionPreferences} from '../src/playback/preferences.ts';
import {defaultStudio,normalizeStudio} from '../src/studio/model.ts';
import {advanceFeatured} from '../src/state/carouselTiming.ts';
test('featured carousel advances at six seconds, preserving elapsed time while paused',()=>{
 assert.deepEqual(advanceFeatured(0,4000,3),{elapsed:4000,advance:false});
 assert.deepEqual(advanceFeatured(5999,1,3),{elapsed:0,advance:true});
 assert.deepEqual(advanceFeatured(2500,100,3,true),{elapsed:2500,advance:false});
 assert.deepEqual(advanceFeatured(2500,5000,1),{elapsed:2500,advance:false});
});
test('rolling overlapping captions show latest dialogue once and clear in gaps and after seek',()=>{
 const old={startTime:430,endTime:470,text:'Old dialogue'},next={startTime:450,endTime:455,text:'Current dialogue\nSecond line'};
 const track={cues:[old,next],activeCues:[old,next,{...next}]};
 assert.deepEqual(activeCaptionText(track,452),['Current dialogue\nSecond line']);
 assert.deepEqual(activeCaptionText({...track,activeCues:[old]},460),[]);
 assert.deepEqual(activeCaptionText(track,400),[]);
 assert.deepEqual(activeCaptionText({...track,activeCues:[old]},440),['Old dialogue']);
 const tied={startTime:450,endTime:456,text:'Another simultaneous block'};
 assert.deepEqual(activeCaptionText({cues:[old,next,tied],activeCues:[old,next,tied]},452),['Another simultaneous block']);
});
test('caption preferences migrate old presets and validate font, background, opacity and size',()=>{
 assert.deepEqual(captionPreferences({style:'netflix',size:120}),{version:2,font:'system',size:120,background:false,opacity:50});
 assert.deepEqual(captionPreferences({font:'<script>',size:500,opacity:Infinity}),{version:2,font:'system',size:100,background:true,opacity:50});
 assert.deepEqual(captionPreferences(null),{version:2,font:'system',size:100,background:true,opacity:50});
 assert.equal(captionPreferences({opacity:150}).opacity,100);
 assert.equal(captionPreferences({opacity:-20}).opacity,0);
 const custom=captionPreferences({font:'mono',size:90,background:false,opacity:80});
 assert.equal(custom.font,'mono');assert.equal(captionAppearance(custom).backgroundColor,'rgba(0, 0, 0, 0)');
 assert.equal(captionAppearance({...custom,background:true}).backgroundColor,'rgba(0, 0, 0, 0.8)');
});
test('old category settings migrate to minimal shortcuts, retaining custom cards and shapes',()=>{
 const config=defaultStudio();delete config.categoryLayout.presentation;
 assert.equal(normalizeStudio(config).categoryLayout.presentation,'minimal');
 for(const shape of ['circle','pill','square','portrait']){config.categoryLayout={...config.categoryLayout,presentation:'artwork',shape};const restored=normalizeStudio(config);assert.equal(restored.categoryLayout.presentation,'artwork');assert.equal(restored.categoryLayout.shape,shape);}
});

import {remainingSeconds,remainingMinutes,estimatedEnd} from '../src/playback/timing.ts';
test('playback remaining minutes round up and end estimates follow seeks, clock and speed',()=>{
 assert.equal(remainingMinutes(3683,8980),89);
 assert.equal(remainingSeconds(100,50),0);assert.equal(remainingSeconds(NaN,50),0);
 assert.equal(remainingMinutes(59,60),1);assert.equal(remainingMinutes(60,60),0);
 assert.equal(estimatedEnd(1000,10,70),61000);
 assert.equal(estimatedEnd(61000,10,70),121000);
 assert.equal(estimatedEnd(1000,40,70),31000);
 assert.equal(estimatedEnd(1000,10,70,2),31000);
});

test('progressive resume captions select the absolute VTT timeline rather than native zero-based cues',()=>{
 const first={startTime:0,endTime:3,text:'Beginning'},later={startTime:100,endTime:103,text:'Resumed dialogue'};
 assert.deepEqual(activeCaptionText({activeCues:[first],cues:[first,later]},101,true),['Resumed dialogue']);
 assert.deepEqual(activeCaptionText({activeCues:[first],cues:[first,later]},105,true),[]);
});

import {fonts,fontFamily} from '../src/appearance/fonts.ts';
import {projectedEnd} from '../src/playback/timing.ts';
test('subtitle font migration shares the app registry and preserves independent choices',()=>{
 assert.equal(captionPreferences({font:'rounded'}).font,'humanist');
 assert.equal(captionPreferences({font:'serif'}).font,'editorial');
 for(const font of fonts){const result=captionPreferences({version:2,font:font.id});assert.equal(result.font,font.id);assert.equal(captionAppearance(result).fontFamily,fontFamily(font.id));}
 assert.equal(captionPreferences({version:2,font:'unknown'}).font,'system');
});
test('wall-clock projection is withheld for paused, ended, invalid and unknown playback',()=>{
 assert.equal(projectedEnd(1000,10,70,1,true),61000);
 assert.equal(projectedEnd(1000,10,70,2,true),31000);
 assert.equal(projectedEnd(1000,10,70,1,false),undefined);
 assert.equal(projectedEnd(1000,70,70,1,true),undefined);
 for(const invalid of [NaN,Infinity,0,-1])assert.equal(projectedEnd(1000,10,70,invalid,true),undefined);
 assert.equal(projectedEnd(1000,10,Infinity,1,true),undefined);
 assert.equal(projectedEnd(1000,-1,70,1,true),undefined);
});

import {reconcileCaptionTracks} from '../src/playback/subtitles.ts';
import {textSubtitle} from '../src/playback/protocol.ts';
test('late native subtitles cannot draw over the Frame overlay; owned cues remain loaded',()=>{
 const owned={mode:'showing'},embedded={mode:'showing'},late={mode:'showing'};
 reconcileCaptionTracks([embedded,owned],owned);
 assert.equal(owned.mode,'hidden');assert.equal(embedded.mode,'disabled');
 reconcileCaptionTracks([embedded,owned,late],owned);
 assert.equal(late.mode,'disabled');assert.equal(owned.mode,'hidden');
 reconcileCaptionTracks([embedded,owned,late]);
 assert.ok([embedded,owned,late].every(track=>track.mode==='disabled'));
});
test('server-encoded tracks never advertise editable text appearance',()=>{
 assert.equal(textSubtitle({Index:1,Type:'Subtitle',Codec:'subrip',DeliveryMethod:'External'}),true);
 assert.equal(textSubtitle({Index:1,Type:'Subtitle',Codec:'subrip',DeliveryMethod:'Encode'}),false);
 assert.equal(textSubtitle({Index:2,Type:'Subtitle',Codec:'pgssub'}),false);
});


test('manual subtitle delay shifts cue boundaries in either direction without changing source cues',()=>{
 const cue={startTime:10,endTime:12,text:'A timed line'};const track={cues:[cue],activeCues:[]};
 assert.deepEqual(synchronizedCaptionText(track,10),['A timed line']);
 assert.deepEqual(synchronizedCaptionText(track,10,0,2),[]);assert.deepEqual(synchronizedCaptionText(track,12,0,2),['A timed line']);assert.deepEqual(synchronizedCaptionText(track,14,0,2),[]);
 assert.deepEqual(synchronizedCaptionText(track,8,0,-2),['A timed line']);
 assert.deepEqual(synchronizedCaptionText(track,2,10,1),['A timed line']);
 assert.equal(cue.startTime,10);assert.equal(cue.endTime,12);
 assert.equal(subtitleDelaySeconds(Infinity),0);assert.equal(subtitleDelaySeconds(999),120);assert.equal(subtitleDelaySeconds(-999),-120);assert.equal(subtitleDelaySeconds(.30000000001),.3);
});


test('ASS positioning and styling codes never reach rendered text, including shifted and DOM-parsed cues',()=>{
 const raw=String.raw`{\an8}A city of peace,`;assert.equal(cleanSubtitleText(raw),'A city of peace,');
 assert.equal(cleanSubtitleText(String.raw`{\pos(1,2)\bord2}{\b1}Hello{\b0}\NNext\hline`),'Hello\nNext line');
 assert.equal(cleanSubtitleText('Keep {ordinary braces} and café.'),'Keep {ordinary braces} and café.');
 const cue={startTime:1,endTime:5,text:raw};const track={cues:[cue],activeCues:[cue]};
 assert.deepEqual(activeCaptionText(track,2),['A city of peace,']);assert.deepEqual(synchronizedCaptionText(track,3,0,1),['A city of peace,']);
 const parsed={...cue,getCueAsHTML:()=>({textContent:raw})};assert.deepEqual(activeCaptionText({activeCues:[parsed]},2),['A city of peace,']);assert.equal(cue.text,raw);
});
