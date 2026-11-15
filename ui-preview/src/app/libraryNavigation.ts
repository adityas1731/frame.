import type {ItemDto} from '../jellyfin/types.ts';
export function libraryNavigation(libraries:ItemDto[]){
 const seen=new Set<string>();
 return libraries.flatMap(library=>{
  const type=(library.CollectionType??'').toLowerCase();
  if(!library.Id||seen.has(library.Id)||!['movies','tvshows','music','mixed',''].includes(type))return [];
  seen.add(library.Id);
  const mode=type==='movies'?'movies':type==='tvshows'?'shows':type==='music'?'music':'library';
  return [{id:library.Id,mode,title:library.Name?.trim()||library.Id,to:`/${mode}?library=${encodeURIComponent(library.Id)}`,count:library.ChildCount}];
 });
}
export function activeLibrary(id:string,mode:string,pathname:string,search:string){
 return (pathname===`/${mode}`||mode==='music'&&pathname.startsWith('/music/'))&&new URLSearchParams(search).get('library')===id;
}

/** Labels always come from the accessible server views; type is only a routing key. */
export function libraryHeading(libraries:ItemDto[],mode:string,id?:string){
 const links=libraryNavigation(libraries);
 if(id)return links.find(link=>link.id===id)?.title??'Your Library';
 const matching=links.filter(link=>link.mode===mode);
 return matching.length?matching.map(link=>link.title).join(' · '):'Your Library';
}
export function ancestorLibrary(libraries:ItemDto[],ancestors:ItemDto[]){
 const links=libraryNavigation(libraries);
 return ancestors.map(ancestor=>links.find(link=>link.id===ancestor.Id)).find(Boolean);
}
