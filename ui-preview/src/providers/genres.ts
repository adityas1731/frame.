import type {ItemDto,Page} from '../jellyfin/types.ts';
const groups:Record<string,string[]>={
  'sci-fi & fantasy':['Sci-Fi','Fantasy'],
  'action & adventure':['Action','Adventure'],
};
export function genreLabel(value:string) {
  const label=value.trim();return /^(science fiction|science-fiction|sci[ -]?fi)$/i.test(label)?'Sci-Fi':label;
}
/** A broad provider bucket is not evidence that a title has every constituent genre. */
export function displayGenres(server:string[]=[],verified:string[]=[]) {
  const independent=verified.map(genreLabel);
  return [...new Set(server.flatMap(value=>{
    const group=groups[value.trim().toLowerCase()];
    return group?group.filter(label=>independent.some(other=>other.toLowerCase()===label.toLowerCase())):[genreLabel(value)];
  }).filter(Boolean))];
}
export function genreCandidates(genre:string) {
  const label=genreLabel(genre);
  const buckets=Object.entries(groups).filter(([,members])=>members.includes(label)).map(([group])=>group==='sci-fi & fantasy'?'Sci-Fi & Fantasy':'Action & Adventure');
  return [label,...(label==='Sci-Fi'?['Science Fiction','Science-Fiction']:[]),...buckets].join('|');
}
/** Refine one server candidate page without scanning the library or inventing a total. */
export async function refineGenrePage(page:Page<ItemDto>,genre:string,enrich?:(item:ItemDto)=>Promise<{genres?:string[]}|null>) {
  const items=await Promise.all(page.Items.map(async item=>{
    const ambiguous=item.Genres?.some(value=>!!groups[value.trim().toLowerCase()]);
    const details=ambiguous&&enrich?await enrich(item).catch(()=>null):null;
    return {...item,Genres:displayGenres(item.Genres,details?.genres)};
  }));
  const label=genreLabel(genre).toLowerCase();
  return {...page,candidateCount:page.Items.length,Items:items.filter(item=>item.Genres.some(value=>value.toLowerCase()===label))};
}

/** Provider group labels are search candidates, not independent title classifications. */
export function independentGenreChoices(values:string[]){
 return [...new Set(values.flatMap(value=>groups[value.trim().toLowerCase()]??[genreLabel(value)]))].sort((a,b)=>a.localeCompare(b));
}
/** Bounded filtered page filling, with exact-ID enrichment for ambiguous provider buckets. */
export async function genreSectionItems(load:(start:number)=>Promise<Page<ItemDto>>,genre:string,limit:number,enrich?:(item:ItemDto)=>Promise<{genres?:string[]}|null>){
 const found:ItemDto[]=[];let start=0;
 for(let pageNumber=0;pageNumber<5;pageNumber++){
  const page=await load(start);const refined=await refineGenrePage(page,genre,enrich);
  for(const item of refined.Items)if(!found.some(existing=>existing.Id===item.Id))found.push(item);
  start+=page.Items.length;
  if(found.length>=limit||!page.Items.length||start>=page.TotalRecordCount)break;
 }
 return found.slice(0,limit);
}
