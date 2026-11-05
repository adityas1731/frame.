import type {BrowseQuery,ItemDto,Page} from '../jellyfin/types';

const prefix='@frame-tag:';
export const tagSelection=(name:string)=>prefix+name;
export const selectedTag=(value:string)=>value.startsWith(prefix)?value.slice(prefix.length):undefined;
export function taggedIds(tags:Record<string,string[]>,name:string){
 const key=name.trim().toLocaleLowerCase();
 return Object.keys(tags).filter(id=>tags[id].some(tag=>tag.trim().toLocaleLowerCase()===key));
}
/** Fetch only explicitly tagged IDs. Keep server permissions and section filters intact. */
export async function loadTaggedItems(ids:string[],query:BrowseQuery,load:(query:BrowseQuery)=>Promise<Page<ItemDto>>){
 const items:ItemDto[]=[];
 for(let start=0;start<ids.length;start+=40){
  const page=await load({...query,genre:undefined,ids:ids.slice(start,start+40),start:0,limit:40});
  items.push(...page.Items);
 }
 const timestamp=(value?:string)=>Date.parse(value??'')||0;
 items.sort((a,b)=>query.sort==='CommunityRating'?(b.CommunityRating??0)-(a.CommunityRating??0):query.sort==='DateCreated'?timestamp(b.DateCreated)-timestamp(a.DateCreated):query.sort==='DatePlayed'?timestamp(b.UserData?.LastPlayedDate)-timestamp(a.UserData?.LastPlayedDate):query.sort==='PremiereDate'?timestamp(b.PremiereDate)-timestamp(a.PremiereDate):(a.Name??'').localeCompare(b.Name??''));
 return items.filter((item,index,all)=>all.findIndex(other=>other.Id===item.Id)===index).slice(0,query.limit??40);
}
