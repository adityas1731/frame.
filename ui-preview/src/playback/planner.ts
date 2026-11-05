import {resolutionCap} from './resolution.ts';
import type {BrowserSupport} from './capabilities.ts';
import {clampTicks} from './foundation.ts';
import {PlaybackError,selectedTracks,textSubtitle,type PlaybackInfo,type PlaybackSelection,type RuntimePlan} from './protocol.ts';
import {sameMediaItem} from '../../public/frame-stream-policy.js';
/** Jellyfin 10.11 can leave SubProtocol at its HTTP default even for HLS.
 * Inspect only the negotiated playlist path; the gateway separately validates
 * the origin, server base path and active item before making any request. */
export function negotiatedHls(itemId:string,raw?:string):boolean{
 if(!raw)return false;
 try{
  const url=new URL(raw,'https://frame.invalid/');
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash)return false;
  const parts=url.pathname.split('/').filter(Boolean);
  return parts.length>=3&&parts.at(-3)?.toLowerCase()==='videos'&&sameMediaItem(parts.at(-2),itemId)&&/^(master|main)\.m3u8$/i.test(parts.at(-1)!);
 }catch{return false;}
}
/** Only accept an explicit server-negotiated VP8/Vorbis HTTP WebM for this item. */
export function negotiatedWebm(itemId:string,raw?:string):boolean{
 if(!raw)return false;
 try{const url=new URL(raw,'https://frame.invalid/');const parts=url.pathname.split('/').filter(Boolean);const params=new Map([...url.searchParams].map(([k,v])=>[k.toLowerCase(),v.toLowerCase()]));
 return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.hash&&parts.at(-3)?.toLowerCase()==='videos'&&sameMediaItem(parts.at(-2),itemId)&&parts.at(-1)?.toLowerCase()==='stream.webm'&&params.get('videocodec')==='vp8'&&params.get('audiocodec')==='vorbis';
 }catch{return false;}
}
export async function runtimePlan(itemId:string,info:PlaybackInfo,support:BrowserSupport,selection:PlaybackSelection,deviceId:string):Promise<RuntimePlan>{
 for(const source of info.MediaSources){
  if(selection.sourceId&&source.Id!==selection.sourceId||source.RequiresOpening)continue;
  const tracks=selectedTracks(source,selection);const audio=source.MediaStreams.filter(t=>t.Type==='Audio');
  const alternative=!!tracks.audio&&audio[0]?.Index!==tracks.audio.Index;
  const compatible=await support.canDirect(source,tracks.audio);
  const direct=source.SupportsDirectPlay&&!selection.forceTranscode&&!resolutionCap(selection.maxHeight)&&!tracks.burn&&!alternative&&compatible&&(source.Bitrate===undefined||source.Bitrate<=selection.maxBitrate);
  const remux=source.SupportsDirectStream&&!tracks.burn&&!selection.forceTranscode&&!resolutionCap(selection.maxHeight);
  const hls=(support.nativeHls||support.mseHls)&&(source.SupportsTranscoding||remux)&&negotiatedHls(itemId,source.TranscodingUrl);
  const webm=!!support.progressiveWebm&&!!source.SupportsTranscoding&&negotiatedWebm(itemId,source.TranscodingUrl);
  if(!direct&&!hls&&!webm)continue;
  const duration=Math.max(0,(source.RunTimeTicks??0)/10000000);const start=clampTicks(selection.startTicks,source.RunTimeTicks?Math.max(0,source.RunTimeTicks-1000000):undefined);
  const mode=direct?'direct':hls&&remux?'remux':'transcode';
  const params=new URLSearchParams({static:'true',mediaSourceId:source.Id,deviceId,playSessionId:info.PlaySessionId!});
  const stream=direct?`Videos/${encodeURIComponent(itemId)}/stream.${source.Container==='m4v'?'mp4':source.Container}?${params}`:source.TranscodingUrl!;
  const subtitle=tracks.subtitle&&textSubtitle(tracks.subtitle)?`Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(source.Id)}/Subtitles/${tracks.subtitle.Index}/Stream.vtt`:undefined;
  return{itemId,sessionId:info.PlaySessionId!,source,info,selection:{...selection,sourceId:source.Id,startTicks:start},audioIndex:tracks.audioIndex,subtitleIndex:tracks.subtitleIndex,mode,stream,subtitle,duration,offset:!direct&&webm?start/10000000:0};
 }
 throw new PlaybackError(!support.mseHls&&!support.nativeHls?'No compatible playback stream. This browser has no authenticated HLS support. Jellyfin did not return a compatible HTTP WebM transcode. Check server transcoding permission or use an up-to-date Chrome, Edge or Firefox.':'No compatible playback stream is available for this browser. Server transcoding may be required or restricted.');
}
