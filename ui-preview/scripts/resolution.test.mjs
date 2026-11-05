import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolutionCap,resolutionOptions,frameDimensions} from '../src/playback/resolution.ts';
import {deviceProfile} from '../src/playback/capabilities.ts';
import {playbackBody,parsePlaybackInfo} from '../src/playback/protocol.ts';
import {runtimePlan} from '../src/playback/planner.ts';
const support={mseHls:true,nativeHls:false,video:['h264'],audio:['aac'],containers:['mp4'],canDirect:async()=>true};
test('resolution limits respect source dimensions, cropped frames and Auto',()=>{
 assert.deepEqual(resolutionCap(720),{width:1280,height:720});assert.equal(resolutionCap(0),undefined);assert.equal(resolutionCap(Infinity),undefined);
 assert.deepEqual(resolutionOptions(1920,800),[480,720,1080]);assert.equal(frameDimensions(1920,800),'1920 × 800');assert.equal(frameDimensions(0,0),undefined);
});
test('resolution negotiation caps profile dimensions and forbids video-copy shortcuts',()=>{
 const profile=deviceProfile(support,20000000,true,720);const conditions=profile.TranscodingProfiles[0].Conditions;
 assert.ok(conditions.some(c=>c.Property==='Width'&&c.Value==='1280'));assert.ok(conditions.some(c=>c.Property==='Height'&&c.Value==='720'));
 const body=playbackBody('user',profile,{startTicks:80000000,maxBitrate:20000000,maxHeight:720},true);
 assert.equal(body.EnableDirectPlay,false);assert.equal(body.EnableDirectStream,false);assert.equal(body.AllowVideoStreamCopy,false);assert.equal(body.EnableTranscoding,true);assert.equal(body.StartTimeTicks,80000000);
 assert.equal(playbackBody('user',deviceProfile(support,40000000),{startTicks:0,maxBitrate:40000000},true).EnableDirectPlay,true);
});
test('requested resolution cannot silently become a direct stream or bypass denied transcodes',async()=>{
 const source={Id:'source',Container:'mp4',RunTimeTicks:300000000,SupportsDirectPlay:true,SupportsDirectStream:true,SupportsTranscoding:true,TranscodingUrl:'/Videos/item/master.m3u8',MediaStreams:[{Index:0,Type:'Video',Codec:'h264',Width:1920,Height:1080},{Index:1,Type:'Audio',Codec:'aac'}]};
 const info=parsePlaybackInfo({PlaySessionId:'session',MediaSources:[source]});const selection={startTicks:80000000,maxBitrate:40000000,maxHeight:720};
 assert.equal((await runtimePlan('item',info,support,selection,'device')).mode,'transcode');
 info.MediaSources[0].SupportsTranscoding=false;await assert.rejects(runtimePlan('item',info,support,selection,'device'),/No compatible/);
});
