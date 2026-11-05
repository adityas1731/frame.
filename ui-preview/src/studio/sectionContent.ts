import {widget,type Widget} from './model.ts';

export const sectionContentOptions=[
 {value:'selection',label:'Choose My Own Titles'},
 {value:'continue',label:'Continue Watching'},
 {value:'recent',label:'Recently Added'},
 {value:'favorites',label:'Favorites'},
 {value:'genre',label:'A Genre Or Custom Tag'},
 {value:'library',label:'A Library Or Collection'},
 {value:'rated',label:'Highest Rated'},
 {value:'unwatched',label:'Unwatched'},
 {value:'released',label:'Recently Released'},
 {value:'nextup',label:'Next Up Episodes'},
 {value:'categories',label:'Browse Categories'},
] as const;
export function sectionContent(value:Widget){return value.kind==='custom'?value.source:value.kind;}
export function changeSectionContent(current:Widget,value:string):Widget{
 if(!sectionContentOptions.some(option=>option.value===value)||sectionContent(current)===value)return current;
 const kind=value==='continue'||value==='recent'||value==='categories'?value:'custom';
 const next=widget(kind,current.id);
 return {...next,title:current.title,visible:current.visible,layout:current.layout,size:current.size,spacing:current.spacing,limit:current.limit,
  source:kind==='custom'?value as Widget['source']:next.source,
  selection:current.selection,art:kind==='continue'?'episode':current.art};
}
