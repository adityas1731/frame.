import type {ItemDto} from '../jellyfin/types.ts';
/** API protocol fixture backed by an original CC0 clip, never a real Jellyfin stream. */
export function playbackFixture(){
 const updates=new Map<string,NonNullable<ItemDto['UserData']>>();let sequence=0;
 const episodes=Array.from({length:6},(_,i):ItemDto=>({Id:`episode-${i}`,Type:'Episode',Name:i===0?'fictional.series.s01e01':i===3?'Episode 4':`An original chapter ${i+1}`,SeriesId:'fixture-2',SeriesName:'After Hours',ParentIndexNumber:1,IndexNumber:i+1,ImageTags:i===0?{Primary:'original-portrait-poster'}:i===4?{Thumb:'broken-thumbnail',Primary:'mislabelled-landscape'}:undefined,PrimaryImageAspectRatio:i===0?2/3:i===4?16/9:undefined,Overview:i?'An independently generated clip for playback testing.':undefined,RunTimeTicks:300000000,UserData:{Played:false,PlaybackPositionTicks:i===0?80000000:0},ProviderIds:{Tmdb:String(990001001+i),...(i<3?{Tvmaze:String(990001001+i)}:{})}}));
 const updated=(item:ItemDto):ItemDto=>({...item,...(updates.has(item.Id)?{UserData:{...item.UserData,...updates.get(item.Id)}}:{})});
 function handle(path:string,init?:RequestInit):Response|undefined{
  const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
  if(/^\/Items\/[^/]+\/PlaybackInfo$/.test(path)&&init?.method==='POST'){
   const body=JSON.parse(String(init.body));const id=path.split('/')[2];const incompatible=id==='fixture-1';const transcode=body.EnableDirectPlay===false||incompatible;const hls=transcode||body.AudioStreamIndex===2||body.MaxStreamingBitrate<1500000;
   return json({PlaySessionId:`fixture-play-${++sequence}`,MediaSources:[{Id:`source-${id}`,Name:'Original Frame test pattern · 30 seconds',Container:incompatible?'mkv':'mp4',RunTimeTicks:300000000,Bitrate:1500000,SupportsDirectPlay:!hls,SupportsDirectStream:!transcode,SupportsTranscoding:true,TranscodingSubProtocol:incompatible?'http':'hls',TranscodingContainer:'ts',TranscodingUrl:`/Videos/${id}/master.m3u8?AudioStreamIndex=${body.AudioStreamIndex??1}&api_key=fictional-session-token`,DefaultAudioStreamIndex:body.AudioStreamIndex??1,DefaultSubtitleStreamIndex:body.SubtitleStreamIndex??-1,MediaStreams:[{Index:0,Type:'Video',Codec:incompatible?'hevc':'h264',Profile:incompatible?'Main 10':'High',Level:40,BitDepth:incompatible?10:8,VideoRangeType:incompatible?'HDR10':'SDR',Width:640,Height:360,BitRate:1200000,RealFrameRate:24},{Index:1,Type:'Audio',Codec:'aac',Channels:2,SampleRate:48000,BitRate:96000,Language:'eng',DisplayTitle:'Test tone · 440 Hz'},{Index:2,Type:'Audio',Codec:'aac',Channels:2,SampleRate:48000,BitRate:96000,Language:'fra',DisplayTitle:'Alternate test tone · 660 Hz'},{Index:3,Type:'Subtitle',Codec:'vtt',Language:'eng',DisplayTitle:'English · original test captions',IsExternal:true,SupportsExternalStream:true}]}]});
  }
  if(/^\/Sessions\/Playing(?:\/(Progress|Stopped))?$/.test(path)&&init?.method==='POST'){
   const body=JSON.parse(String(init.body));const completed=body.PositionTicks>=290000000;
   updates.set(body.ItemId,{PlaybackPositionTicks:completed?0:body.PositionTicks,Played:completed,LastPlayedDate:new Date().toISOString()});return new Response(null,{status:204});
  }
  if(path==='/Videos/ActiveEncodings'&&init?.method==='DELETE')return new Response(null,{status:204});
 }
 function setWatched(item:ItemDto,played:boolean){const data={...updated(item).UserData,Played:played,PlaybackPositionTicks:0};updates.set(item.Id,data);return data;}
 function setFavorite(item:ItemDto,favorite:boolean){const data={...updated(item).UserData,IsFavorite:favorite};updates.set(item.Id,data);return data;}
 return {handle,updated,episodes,setWatched,setFavorite};
}

