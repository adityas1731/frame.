import type {MediaSource,PlaybackInfo} from '../playback/protocol.ts';
import {PlaybackError} from '../playback/protocol.ts';
const audioTypes:Record<string,string>={mp3:'audio/mpeg',aac:'audio/aac',m4a:'audio/mp4',mp4:'audio/mp4',flac:'audio/flac',ogg:'audio/ogg',opus:'audio/ogg; codecs="opus"',wav:'audio/wav',webm:'audio/webm'};
const codecTypes:Record<string,string>={mp3:'audio/mpeg',aac:'audio/mp4; codecs="mp4a.40.2"',flac:'audio/flac',opus:'audio/ogg; codecs="opus"',vorbis:'audio/ogg; codecs="vorbis"',pcm_s16le:'audio/wav',pcm_s24le:'audio/wav',pcm_f32le:'audio/wav'};
const containerCodecs:Record<string,string>={mp3:'mp3',aac:'aac',m4a:'aac',mp4:'aac,mp3',flac:'flac',ogg:'opus,vorbis',opus:'opus',wav:'pcm_s16le,pcm_s24le,pcm_f32le',webm:'opus,vorbis'};
export function audioProfile(canPlay:(mime:string)=>string,force=false){return {Name:'frame. Audio',MaxStreamingBitrate:40000000,MusicStreamingTranscodingBitrate:192000,DirectPlayProfiles:force?[]:Object.entries(audioTypes).filter(([,mime])=>!!canPlay(mime)).map(([Container])=>({Type:'Audio',Container,AudioCodec:containerCodecs[Container]})),TranscodingProfiles:[{Type:'Audio',Container:'mp3',Protocol:'http',AudioCodec:'mp3',Context:'Streaming',MaxAudioChannels:'2'}]};}
export interface AudioPlan {itemId:string;sessionId:string;source:MediaSource;url:string;transcoded:boolean;offset:number;duration:number}
export function audioPlan(itemId:string,info:PlaybackInfo,canPlay:(mime:string)=>string,deviceId:string,force=false,start=0):AudioPlan{
 if(!info.PlaySessionId)throw new PlaybackError('Jellyfin did not return an audio playback session.');
 const sources=info.MediaSources.filter(source=>!source.RequiresOpening&&source.MediaStreams.some(t=>t.Type==='Audio'));
 const direct=!force?sources.find(source=>source.SupportsDirectPlay&&!!audioTypes[source.Container??'']&&!!canPlay(audioTypes[source.Container!])&&source.MediaStreams.filter(t=>t.Type==='Audio').every(track=>!!codecTypes[track.Codec?.toLowerCase()??'']&&!!canPlay(codecTypes[track.Codec!.toLowerCase()]))):undefined;
 const source=direct??sources.find(source=>source.SupportsTranscoding);
 if(!source)throw new PlaybackError('No compatible audio stream is available. Check this account’s playback and audio transcoding permissions.');
 const transcoded=!direct;
 const params=new URLSearchParams({static:String(!transcoded),mediaSourceId:source.Id,playSessionId:info.PlaySessionId,deviceId});
 if(transcoded){params.set('audioCodec','mp3');params.set('audioBitRate','192000');params.set('maxAudioChannels','2');if(start>0)params.set('startTimeTicks',String(Math.round(start*10000000)));}
 return {itemId,sessionId:info.PlaySessionId,source,url:`Audio/${encodeURIComponent(itemId)}/stream.${transcoded?'mp3':source.Container}?${params}`,transcoded,offset:transcoded?start:0,duration:(source.RunTimeTicks??0)/10000000};
}
