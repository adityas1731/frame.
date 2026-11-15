import type {ItemDto,MusicQuery,Page} from '../jellyfin/types.ts';
export const musicTitle=(item:ItemDto)=>item.Name?.trim()||(item.Type==='MusicArtist'?'Unknown artist':item.Type==='MusicAlbum'?'Untitled album':item.Type==='Playlist'?'Untitled playlist':'Untitled track');
export const musicArtist=(item:ItemDto)=>item.Artists?.filter(name=>name.trim()).join(', ')||item.AlbumArtists?.map(artist=>artist.Name?.trim()).filter(Boolean).join(', ')||'Unknown artist';
export const musicDestination=(item:ItemDto,library?:string)=>`/music/${item.Type==='MusicArtist'?'artist':item.Type==='Playlist'?'playlist':'album'}/${encodeURIComponent(item.Id)}${library?'?library='+encodeURIComponent(library):''}`;
/** Album/playlist play is paginated; album metadata is never required for Songs. */
export async function collectMusic(load:(start:number)=>Promise<Page<ItemDto>>,max=5000){
 const items:ItemDto[]=[];let start=0;
 for(;;){const page=await load(start);items.push(...page.Items.filter(item=>item.Type==='Audio'));start+=page.Items.length;if(items.length>max)throw Error(`Choose a smaller collection. Queues support up to ${max} entries.`);if(start>=page.TotalRecordCount)return items;if(!page.Items.length)throw Error('This collection changed while loading. Reload it and try again.');if(start>=max)throw Error(`Choose a smaller collection. Queues support up to ${max} entries.`);}
}
export function musicCollectionQuery(library:string|undefined,kind:MusicQuery['kind'],artistId?:string):MusicQuery{return {kind,parentId:library,artistId};}
