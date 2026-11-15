/** Synthetic contract data. No real server paths, credentials or listening history. */
import type {Fetcher,ItemDto} from '../../src/jellyfin/types';
export const musicIds={loose:'10000000000000000000000000000001',records:'10000000000000000000000000000002',empty:'10000000000000000000000000000003',bare:'20000000000000000000000000000001',first:'20000000000000000000000000000002',second:'20000000000000000000000000000003',album:'30000000000000000000000000000001',artist:'40000000000000000000000000000001',playlist:'50000000000000000000000000000001'};
export const musicFixtureSession={baseUrl:'https://frame-fixture.invalid',token:'fictional-session-token',deviceId:'music-fixture',created:Date.now(),server:{Id:'frame-fixture',Version:'12.3.0',ServerName:'Music fixture'},user:{Id:'fixture-user',Name:'Fixture listener'}};
export const musicFixtureItems:ItemDto[]=[
 {Id:musicIds.bare,Name:'A standalone MP3',Type:'Audio',RunTimeTicks:300000000},
 {Id:musicIds.first,Name:'Night Walk',Type:'Audio',Artists:['Frame Test Ensemble'],ArtistItems:[{Id:musicIds.artist,Name:'Frame Test Ensemble'}],Album:'Small Hours',AlbumId:musicIds.album,IndexNumber:1,RunTimeTicks:300000000},
 {Id:musicIds.second,Name:'An unusually long track title that should wrap without covering the playback controls',Type:'Audio',Artists:['Frame Test Ensemble'],Album:'Small Hours',AlbumId:musicIds.album,IndexNumber:2,RunTimeTicks:300000000},
 {Id:musicIds.album,Name:'Small Hours',Type:'MusicAlbum',Artists:['Frame Test Ensemble'],ProductionYear:2026},
 {Id:musicIds.artist,Name:'Frame Test Ensemble',Type:'MusicArtist'},
 {Id:musicIds.playlist,Name:'Late nights',Type:'Playlist',MediaType:'Audio'}
];
export function createMusicFixture(hidden=false,onActivity:(value:string)=>void=()=>{}):Fetcher{
 let session=0;
 return async(input,init)=>{
  const url=new URL(input),path=url.pathname,p=url.searchParams;
  const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  const page=(items:ItemDto[])=>{const start=Number(p.get('startIndex')??0),limit=Number(p.get('limit')??40);return json({Items:items.slice(start,start+limit),TotalRecordCount:items.length});};
  if(init?.signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(path==='/UserViews')return page([{Id:'60000000000000000000000000000001',Name:'Movie nights',CollectionType:'movies'},...hidden?[]:[{Id:musicIds.loose,Name:'Loose files',CollectionType:'music'},{Id:musicIds.records,Name:'Records',CollectionType:'music'},{Id:musicIds.empty,Name:'Empty shelves',CollectionType:'music',ChildCount:0}]]);
  if(path.includes('/PlaybackInfo'))return json({PlaySessionId:`fixture-audio-${++session}`,MediaSources:[{Id:'source-audio',Container:'mp3',RunTimeTicks:300000000,SupportsDirectPlay:true,SupportsTranscoding:true,MediaStreams:[{Type:'Audio',Index:0,Codec:'mp3',Channels:2,BitRate:32000}]}]});
  if(path.startsWith('/Sessions/Playing')){const body=JSON.parse(String(init?.body??'{}'));onActivity(`${path.split('/').at(-1)} ${body.ItemId} ${body.PositionTicks}`);return new Response(null,{status:204});}
  if(path==='/Sessions/Logout'||path==='/Videos/ActiveEncodings')return new Response(null,{status:204});
  if(path.startsWith('/Playlists/'))return page([musicFixtureItems[2],musicFixtureItems[1],{...musicFixtureItems[1],PlaylistItemId:'repeat'}]);
  if(path.startsWith('/Genres')||path.startsWith('/MusicGenres'))return page([]);
  if(path==='/Items'||path==='/Artists'){
   if(hidden)return page([]);const kind=p.get('includeItemTypes')??'';const parent=p.get('parentId');let items=path==='/Artists'?musicFixtureItems.filter(i=>i.Type==='MusicArtist'):musicFixtureItems.filter(i=>kind.split(',').includes(i.Type??''));
   if(parent===musicIds.loose)items=items.filter(i=>i.Id===musicIds.bare);else if(parent===musicIds.empty)items=[];else if(parent===musicIds.records||p.has('artistIds'))items=items.filter(i=>i.Id!==musicIds.bare);else if(parent===musicIds.album)items=items.filter(i=>i.AlbumId===musicIds.album);
   const search=p.get('searchTerm')?.toLowerCase();if(search)items=items.filter(i=>i.Name?.toLowerCase().includes(search));
   if(p.has('ids'))items=items.filter(i=>p.get('ids')!.split(',').includes(i.Id));return page(items);
  }
  const item=musicFixtureItems.find(i=>path===`/Items/${i.Id}`);return item?json(item):json({},404);
 };
}
