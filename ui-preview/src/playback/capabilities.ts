import {resolutionCap} from './resolution.ts';
import type {MediaSource,MediaStream} from './protocol.ts';
export interface BrowserSupport {nativeHls:boolean;mseHls:boolean;progressiveWebm?:boolean;video:string[];audio:string[];containers:string[];canDirect:(source:MediaSource,audio?:MediaStream)=>Promise<boolean>}
const videoMimes:Record<string,string>={h264:'video/mp4; codecs="avc1.640028"',hevc:'video/mp4; codecs="hvc1.1.6.L120.B0"',av1:'video/mp4; codecs="av01.0.08M.08"',vp9:'video/webm; codecs="vp09.00.10.08"',vp8:'video/webm; codecs="vp8"'};
const audioMimes:Record<string,string>={aac:'audio/mp4; codecs="mp4a.40.2"',mp3:'audio/mpeg',opus:'audio/webm; codecs="opus"',vorbis:'audio/webm; codecs="vorbis"',ac3:'audio/mp4; codecs="ac-3"',eac3:'audio/mp4; codecs="ec-3"'};
export function browserSupport(video:HTMLVideoElement,mseHls:boolean,nativeRelay=false):BrowserSupport {
 const supported=(mime:string)=>!!video.canPlayType(mime);
 const codecs=Object.keys(videoMimes).filter(c=>supported(videoMimes[c]));const audio=Object.keys(audioMimes).filter(c=>supported(audioMimes[c]));
 // Native HLS requests bypass a page service worker; enable only with the cookie relay.
 // Native HLS advertises "maybe" in browsers whose internal playlist requests bypass
 // a page-owned service worker. Do not advertise that unauthenticated transport.
 // The approved MSE HLS adapter uses fetch through our authenticated gateway.
 const nativeHls=nativeRelay&&['maybe','probably'].includes(video.canPlayType('application/vnd.apple.mpegurl')); 
 return{nativeHls,mseHls,progressiveWebm:!mseHls&&supported('video/webm; codecs="vp8, vorbis"'),video:codecs,audio,containers:['mp4','m4v','webm'].filter(c=>supported(`video/${c==='m4v'?'mp4':c}`)),async canDirect(source,selectedAudio){
  const stream=source.MediaStreams.find(t=>t.Type==='Video');const codec=stream?.Codec?.toLowerCase()==='h265'?'hevc':stream?.Codec?.toLowerCase();
  if(!stream||!codec||!codecs.includes(codec)||!source.Container||!['mp4','m4v','webm'].includes(source.Container)||source.RequiresOpening)return false;
  if(stream.VideoRangeType&&stream.VideoRangeType!=='SDR')return false;
  if((stream.BitDepth??8)>8||codec==='h264'&&stream.Profile&&!['baseline','constrained baseline','main','high'].includes(stream.Profile.toLowerCase()))return false;
  // Container and decoder support must agree. Never claim arbitrary MKV/AC3/HEVC support.
  if(source.Container==='webm'&&!['vp8','vp9','av1'].includes(codec)||source.Container!=='webm'&&['vp8','vp9'].includes(codec))return false;
  if(selectedAudio&&(!audio.includes(selectedAudio.Codec?.toLowerCase()??'')||(selectedAudio.Channels??2)>2))return false;
  if(source.Container==='webm'&&selectedAudio&&!['opus','vorbis'].includes(selectedAudio.Codec??''))return false;
  if(source.Container!=='webm'&&selectedAudio&&!['aac','mp3','ac3','eac3'].includes(selectedAudio.Codec??''))return false;
  if(codec==='hevc'&&stream.Profile&&!['main','main still picture'].includes(stream.Profile.toLowerCase()))return false;
  let mime=videoMimes[codec];
  if(codec==='h264'){
   const profile=({'baseline':'42','constrained baseline':'42','main':'4d','high':'64'})[stream.Profile?.toLowerCase()??'high'];
   const level=stream.Level??40;if(!profile||level>51||level<10)return false;
   mime=`video/mp4; codecs="avc1.${profile}00${Math.round(level).toString(16).padStart(2,'0')}"`;
  }
  if(!supported(mime))return false;
  if(navigator.mediaCapabilities?.decodingInfo&&stream.Width&&stream.Height&&stream.BitRate&&stream.RealFrameRate){
   try{const result=await navigator.mediaCapabilities.decodingInfo({type:'file',video:{contentType:mime,width:stream.Width,height:stream.Height,bitrate:stream.BitRate,framerate:stream.RealFrameRate},...(selectedAudio?{audio:{contentType:audioMimes[selectedAudio.Codec!.toLowerCase()],channels:String(selectedAudio.Channels??2),bitrate:selectedAudio.BitRate??192000,samplerate:selectedAudio.SampleRate??48000}}:{})});if(!result.supported)return false;}catch{return false;}
  }
  return true;
 }};
}
export function deviceProfile(support:BrowserSupport,maxBitrate:number,force=false,maxHeight?:number):Record<string,unknown>{
 const cap=resolutionCap(maxHeight);const dimensions=cap?[{Condition:'LessThanEqual',Property:'Width',Value:String(cap.width),IsRequired:true},{Condition:'LessThanEqual',Property:'Height',Value:String(cap.height),IsRequired:true}]:[];
 const mp4Video=support.video.filter(c=>['h264','hevc','av1'].includes(c));const webmVideo=support.video.filter(c=>['vp8','vp9','av1'].includes(c));
 return{Name:'frame.',MaxStreamingBitrate:maxBitrate,MaxStaticBitrate:maxBitrate,MusicStreamingTranscodingBitrate:192000,
 DirectPlayProfiles:force?[]:[...(mp4Video.length?[{Container:'mp4,m4v',Type:'Video',VideoCodec:mp4Video.join(','),AudioCodec:support.audio.filter(c=>['aac','mp3','ac3','eac3'].includes(c)).join(',')}]:[]),...(webmVideo.length?[{Container:'webm',Type:'Video',VideoCodec:webmVideo.join(','),AudioCodec:support.audio.filter(c=>['opus','vorbis'].includes(c)).join(',')}]:[])],
 TranscodingProfiles:support.nativeHls||support.mseHls?[{Container:'ts',Type:'Video',Protocol:'hls',VideoCodec:'h264',AudioCodec:'aac',MaxAudioChannels:'2',MinSegments:2,SegmentLength:6,BreakOnNonKeyFrames:false,Conditions:dimensions}]:support.progressiveWebm?[{Container:'webm',Type:'Video',Protocol:'http',Context:'Streaming',VideoCodec:'vp8',AudioCodec:'vorbis',MaxAudioChannels:'2',Conditions:[{Condition:'LessThanEqual',Property:'Width',Value:'1920',IsRequired:true},...dimensions]}]:[],
 CodecProfiles:[...(cap?[{Type:'Video',Conditions:dimensions}]:[]),{Type:'Video',Codec:'h264',Conditions:[{Condition:'LessThanEqual',Property:'VideoBitDepth',Value:'8',IsRequired:false},{Condition:'LessThanEqual',Property:'VideoLevel',Value:'51',IsRequired:false}]},{Type:'VideoAudio',Conditions:[{Condition:'LessThanEqual',Property:'AudioChannels',Value:'2',IsRequired:false}]}],
 SubtitleProfiles:[{Format:'vtt',Method:'External'},{Format:'srt',Method:'External'},{Format:'ass',Method:'External'},{Format:'ssa',Method:'External'},{Format:'pgssub',Method:'Encode'},{Format:'dvdsub',Method:'Encode'}]};
}

