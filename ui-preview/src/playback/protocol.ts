import {resolutionCap} from './resolution.ts';
import {clampTicks,type MediaStream as BaseStream,type MediaSource as BaseSource,type PlaybackInfo as BaseInfo} from './foundation.ts';
export interface MediaStream extends BaseStream {DisplayTitle?:string;Title?:string;Profile?:string;Level?:number;BitDepth?:number;Width?:number;Height?:number;BitRate?:number;RealFrameRate?:number;Channels?:number;SampleRate?:number;IsDefault?:boolean;IsForced?:boolean;SupportsExternalStream?:boolean;DeliveryUrl?:string;IsTextSubtitleStream?:boolean;VideoRangeType?:string}
export interface MediaSource extends Omit<BaseSource,'MediaStreams'> {MediaStreams:MediaStream[];Name?:string;Bitrate?:number;DefaultAudioStreamIndex?:number;DefaultSubtitleStreamIndex?:number;TranscodingUrl?:string;TranscodingOffsetTicks?:number;DirectStreamUrl?:string;RequiredHttpHeaders?:Record<string,string>;RequiresOpening?:boolean;SupportsProbing?:boolean}
export interface PlaybackInfo extends Omit<BaseInfo,'MediaSources'> {MediaSources:MediaSource[]}
export interface PlaybackSelection {sourceId?:string;audioIndex?:number;subtitleIndex?:number;startTicks:number;maxBitrate:number;forceTranscode?:boolean;maxHeight?:number}
export class PlaybackError extends Error {constructor(message:string){super(message);this.name='PlaybackError';}}
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v:undefined;
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:undefined;
export function parsePlaybackInfo(raw:unknown):PlaybackInfo {
 const value=record(raw);if(value.ErrorCode)throw new PlaybackError('Jellyfin could not find a compatible stream. Check playback and transcoding permissions.');
 if(typeof value.PlaySessionId!=='string'||!value.PlaySessionId||!Array.isArray(value.MediaSources))throw new PlaybackError('Jellyfin returned incomplete playback information.');
 const sources:MediaSource[]=value.MediaSources.map(record).filter(s=>typeof s.Id==='string'&&s.Id).map(s=>{
  const streams:MediaStream[]=(Array.isArray(s.MediaStreams)?s.MediaStreams:[]).map(record).filter(v=>['Video','Audio','Subtitle'].includes(String(v.Type))&&typeof v.Index==='number'&&Number.isInteger(v.Index)&&v.Index>=0).map(v=>{
   const track:MediaStream={Index:v.Index as number,Type:v.Type as MediaStream['Type']};
   for(const key of ['Codec','Language','DisplayTitle','Title','Profile','DeliveryMethod','DeliveryUrl','VideoRangeType'] as const)if(str(v[key])!==undefined)track[key]=str(v[key]);
   for(const key of ['Level','BitDepth','Width','Height','BitRate','RealFrameRate','Channels','SampleRate'] as const)if(number(v[key])!==undefined)track[key]=number(v[key]);
   for(const key of ['IsExternal','IsDefault','IsForced','SupportsExternalStream','IsTextSubtitleStream'] as const)if(typeof v[key]==='boolean')track[key]=v[key] as boolean;
   return track;
  });
  return {Id:s.Id as string,Container:str(s.Container)?.toLowerCase(),Name:str(s.Name),RunTimeTicks:number(s.RunTimeTicks),Bitrate:number(s.Bitrate),SupportsDirectPlay:s.SupportsDirectPlay===true,SupportsDirectStream:s.SupportsDirectStream===true,SupportsTranscoding:s.SupportsTranscoding===true,TranscodingSubProtocol:str(s.TranscodingSubProtocol),TranscodingContainer:str(s.TranscodingContainer),TranscodingUrl:str(s.TranscodingUrl),TranscodingOffsetTicks:number(s.TranscodingOffsetTicks),DirectStreamUrl:str(s.DirectStreamUrl),DefaultAudioStreamIndex:number(s.DefaultAudioStreamIndex),DefaultSubtitleStreamIndex:number(s.DefaultSubtitleStreamIndex),RequiresOpening:s.RequiresOpening===true,MediaStreams:streams};
 });
 if(!sources.length)throw new PlaybackError('No accessible media source was returned.');return{PlaySessionId:value.PlaySessionId,MediaSources:sources};
}
export function textSubtitle(track?:MediaStream){return !!track&&track.DeliveryMethod?.toLowerCase()!=='encode'&&(track.IsTextSubtitleStream===true||['vtt','webvtt','srt','subrip','ass','ssa','ttml','mov_text'].includes(track.Codec?.toLowerCase()??''))&&(track.SupportsExternalStream!==false);}
export function selectedTracks(source:MediaSource,selection:PlaybackSelection){
 const audioIndex=selection.audioIndex??source.DefaultAudioStreamIndex??source.MediaStreams.find(t=>t.Type==='Audio'&&t.IsDefault)?.Index??source.MediaStreams.find(t=>t.Type==='Audio')?.Index;
 const subtitleIndex=selection.subtitleIndex??source.DefaultSubtitleStreamIndex??-1;
 const audio=source.MediaStreams.find(t=>t.Type==='Audio'&&t.Index===audioIndex);const subtitle=source.MediaStreams.find(t=>t.Type==='Subtitle'&&t.Index===subtitleIndex);
 if(audioIndex!==undefined&&!audio||subtitleIndex!==-1&&!subtitle)throw new PlaybackError('That track is not available in the selected media source.');
 return {audioIndex,subtitleIndex,audio,subtitle,burn:!!subtitle&&!textSubtitle(subtitle)};
}
export function playbackBody(userId:string,profile:Record<string,unknown>,selection:PlaybackSelection,canHls:boolean,canTranscode=canHls){return {UserId:userId,DeviceProfile:profile,StartTimeTicks:clampTicks(selection.startTicks),MediaSourceId:selection.sourceId,AudioStreamIndex:selection.audioIndex,SubtitleStreamIndex:selection.subtitleIndex,MaxStreamingBitrate:selection.maxBitrate,MaxAudioChannels:2,EnableDirectPlay:!selection.forceTranscode&&!resolutionCap(selection.maxHeight),EnableDirectStream:canHls&&!selection.forceTranscode&&!resolutionCap(selection.maxHeight),EnableTranscoding:canTranscode,AllowVideoStreamCopy:!selection.forceTranscode&&!resolutionCap(selection.maxHeight),AllowAudioStreamCopy:!selection.forceTranscode&&!resolutionCap(selection.maxHeight),AutoOpenLiveStream:false,IsPlayback:true};}
export interface PlayingReport {ItemId:string;MediaSourceId:string;PlaySessionId:string;PositionTicks:number;IsPaused:boolean;IsMuted:boolean;VolumeLevel:number;CanSeek:boolean;PlayMethod:'DirectPlay'|'DirectStream'|'Transcode';AudioStreamIndex?:number;SubtitleStreamIndex:number;EventName?:'timeupdate'|'pause'|'unpause'|'seek'|'volumechange'}
export interface RuntimePlan {itemId:string;sessionId:string;source:MediaSource;info:PlaybackInfo;selection:PlaybackSelection;audioIndex?:number;subtitleIndex:number;mode:'direct'|'remux'|'transcode';stream:string;subtitle?:string;duration:number;offset:number}
