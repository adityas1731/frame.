import {cleanSubtitleText,synchronizedCaptionText} from './subtitles';
import {textSubtitle} from './protocol';
import type {Dispatch,SetStateAction} from 'react';
import type {ItemDto} from '../jellyfin/types';
import type {PlayerSnapshot} from './runtime';
import type {PlaybackSelection,RuntimePlan} from './protocol';
import type {CustomSubtitle} from './customSubtitles';
const sampleCaption=cleanSubtitleText(String.raw`{\an8}A new story begins beyond the horizon.`);
/** Local UI harness: no fetch, media source, session report or Jellyfin runtime. */
export const previewItem:ItemDto={Id:'ui-preview',Name:'The Last Horizon',Type:'Movie',ProductionYear:2026,Overview:'Beyond the familiar coast, a quiet signal draws a cartographer toward a place she thought existed only in stories.'};
const source={Id:'preview-source',SupportsTranscoding:true,Name:'Original UI sample',Container:'mp4',MediaStreams:[{Index:0,Type:'Video' as const,Codec:'h264',Width:1920,Height:1080},{Index:1,Type:'Audio' as const,DisplayTitle:'English · Stereo',Codec:'aac'},{Index:2,Type:'Audio' as const,DisplayTitle:'French · Stereo',Codec:'aac'},{Index:3,Type:'Subtitle' as const,DisplayTitle:'English',Codec:'vtt'},{Index:4,Type:'Subtitle' as const,DisplayTitle:'French',Codec:'vtt'},{Index:5,Type:'Subtitle' as const,DisplayTitle:'English · PGS image subtitles',Codec:'pgssub'}]};
source.MediaStreams.push(...['Polish'].map((DisplayTitle,index)=>({Index:index+6,Type:'Subtitle' as const,DisplayTitle,Codec:'vtt'})));
const plan:RuntimePlan={itemId:'ui-preview',sessionId:'local-ui',source,info:{PlaySessionId:'local-ui',MediaSources:[source]},selection:{maxBitrate:40000000,startTicks:60000000},audioIndex:1,subtitleIndex:3,mode:'direct',stream:'',subtitle:'/ui-preview-only.vtt',duration:8888,offset:0};
export function previewSnapshot():PlayerSnapshot{return{phase:'playing',videoWidth:1280,videoHeight:720,position:6,duration:8888,paused:false,volume:.7,muted:false,canHls:true,plan,captions:[sampleCaption],diagnostics:[{elapsedMs:0,stage:'plan',facts:{mode:'direct'}}]};}
export function previewControls(update:Dispatch<SetStateAction<PlayerSnapshot>>){
 let custom:CustomSubtitle|undefined,customRevision=0;
 const customCaptions=(position:number,delay=0)=>{
  const seconds=(stamp:string)=>stamp.split(':').reduce((total,part)=>total*60+Number(part),0);
  const cues=(custom?.vtt.split('\n\n').slice(1)??[]).flatMap(block=>{const [timing,...lines]=block.split('\n');const match=/^(\S+) --> (\S+)/.exec(timing);return match?[{startTime:seconds(match[1]),endTime:seconds(match[2]),text:lines.join('\n')} as VTTCue]:[];});
  return synchronizedCaptionText({activeCues:null,cues:cues as unknown as TextTrackCueList},position,0,delay);
 };
 const selectCustomSubtitle=async()=>{if(custom)update(s=>({...s,customSubtitleSelected:true,additionalSubtitleSelected:undefined,plan:{...s.plan!,subtitleIndex:-1,subtitle:undefined},captions:customCaptions(s.position,s.subtitleDelay)}));};
 const loadCustomSubtitle=async(value:CustomSubtitle)=>{custom=value;update(s=>({...s,customSubtitle:{name:value.name,language:value.language,revision:++customRevision}}));await selectCustomSubtitle();};
 const removeCustomSubtitle=()=>{custom=undefined;update(s=>({...s,customSubtitle:undefined,customSubtitleSelected:false,captions:[]}));};
 return{getCustomSubtitle:()=>custom,loadCustomSubtitle,selectCustomSubtitle,removeCustomSubtitle,selectAdditionalSubtitle:async()=>{},state:previewSnapshot(),subtitleDelay:(subtitleDelay:number)=>update(s=>({...s,subtitleDelay})),toggle:()=>update(s=>({...s,paused:!s.paused,phase:s.paused?'playing':'paused'})),seek:(position:number)=>update(s=>({...s,position:Math.max(0,Math.min(s.duration,position))})),mute:()=>update(s=>({...s,muted:!s.muted})),volume:(volume:number)=>update(s=>({...s,volume})),change:async(value:Partial<PlaybackSelection>)=>{update(s=>({...s,...(value.subtitleIndex!==undefined?{customSubtitleSelected:false,additionalSubtitleSelected:undefined}:{}),...(value.startTicks!==undefined?{position:value.startTicks/10000000,phase:'playing' as const,paused:false}:{}),plan:{...s.plan!,selection:{...s.plan!.selection,...value},audioIndex:value.audioIndex??s.plan?.audioIndex,subtitleIndex:value.subtitleIndex??s.plan!.subtitleIndex,subtitle:value.subtitleIndex===undefined?s.plan!.subtitle:value.subtitleIndex===-1||!textSubtitle(s.plan!.source.MediaStreams.find(track=>track.Index===value.subtitleIndex))?undefined:'/ui-preview-only.vtt'},captions:value.subtitleIndex===undefined?s.captions:value.subtitleIndex===-1||!textSubtitle(s.plan!.source.MediaStreams.find(track=>track.Index===value.subtitleIndex))?[]:[sampleCaption]}));},destroy:async()=>{}};
}
