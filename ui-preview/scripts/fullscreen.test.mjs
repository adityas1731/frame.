import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fullscreenAvailable,toggleVideoFullscreen} from '../src/playback/fullscreen.ts';
import {nativeCaptionTimeline} from '../src/playback/nativeCaptions.ts';

test('iPhone video fullscreen is available even without document fullscreenEnabled',async()=>{
 let entered=0;const video={readyState:1,webkitEnterFullscreen(){entered++;}};
 const doc={fullscreenEnabled:false};assert.equal(fullscreenAvailable(doc,null,video),true);
 const task=toggleVideoFullscreen(doc,null,video);assert.equal(entered,1,'native entry stays in the synchronous gesture');assert.equal(await task,'native');
 assert.equal(fullscreenAvailable(doc,null,{}),false);
});
test('standard fullscreen preserves Frame controls and exits the current fullscreen',async()=>{
 let entered=0,exited=0;const doc={fullscreenEnabled:true,fullscreenElement:null,exitFullscreen:async()=>{exited++;}};
 const host={requestFullscreen:async()=>{entered++;}};
 assert.equal(await toggleVideoFullscreen(doc,host,null),'frame');assert.equal(entered,1);
 doc.fullscreenElement=host;assert.equal(await toggleVideoFullscreen(doc,host,null),'inline');assert.equal(exited,1);
});
test('native entry waits for metadata, supports exit and falls back after standard rejection',async()=>{
 let entered=0,exited=0;const video={readyState:0,webkitEnterFullscreen(){entered++;},webkitExitFullscreen(){exited++;}};
 await assert.rejects(toggleVideoFullscreen({fullscreenEnabled:false},null,video),/Wait for the video/);assert.equal(entered,0);
 video.readyState=1;assert.equal(await toggleVideoFullscreen({fullscreenEnabled:true},{requestFullscreen:async()=>{throw Error('unsupported');}},video),'native');assert.equal(entered,1);
 video.webkitDisplayingFullscreen=true;assert.equal(await toggleVideoFullscreen({},null,video),'inline');assert.equal(exited,1);
 await assert.rejects(toggleVideoFullscreen({fullscreenEnabled:false},null,{}),/unavailable/);
});
test('denied landscape lock leaves successful fullscreen intact',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'screen');let attempts=0;
 Object.defineProperty(globalThis,'screen',{configurable:true,value:{orientation:{lock:async()=>{attempts++;throw Error('unsupported');}}}});
 try{assert.equal(await toggleVideoFullscreen({fullscreenEnabled:true},{requestFullscreen:async()=>{}},null,true),'frame');assert.equal(attempts,1);}
 finally{if(previous)Object.defineProperty(globalThis,'screen',previous);else delete globalThis.screen;}
});
test('native caption copy preserves source cues, resume offset, delay and cleaned dialogue',()=>{
 const cues=[{startTime:1,endTime:4,text:'Earlier'},{startTime:10,endTime:18,text:String.raw`{\an8}<b>First</b>`},{startTime:12,endTime:14,text:'Next'}];
 const before=structuredClone(cues);assert.deepEqual(nativeCaptionTimeline(cues,8,2),[{start:4,end:6,text:'First'},{start:6,end:8,text:'Next'}]);assert.deepEqual(cues,before);
});
