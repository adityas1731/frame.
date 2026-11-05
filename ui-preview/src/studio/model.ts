import {selectedTag} from '../state/tagSelection.ts';
import {randomId} from '../platform/browser.ts';
import {atmosphereFromSeed,isHex,readableAccent} from '../appearance/palette.ts';
import type { BrowseQuery, ItemDto } from '../jellyfin/types.ts';
export type WidgetKind='continue'|'categories'|'recent'|'custom';
export type WidgetSource='favorites'|'rated'|'unwatched'|'genre'|'library'|'selection'|'released'|'nextup';
export interface Widget {id:string;kind:WidgetKind;title:string;visible:boolean;source:WidgetSource;media:'all'|'Movie'|'Series';library:string;genre:string;year:string;minRating:number;watched:'all'|'watched'|'unwatched';sort:NonNullable<BrowseQuery['sort']>;limit:number;layout:'row'|'grid'|'carousel';art:'poster'|'backdrop'|'episode';size:'small'|'medium'|'large';spacing:number;includeMovies:boolean;selection:string[]}
export interface Category {id:string;title:string;target:'movies'|'shows'|'genre'|'library';value:string;visible:boolean;image:'auto'|'builtin'|'upload'|'library';imageKey?:string;itemId?:string;zoom:number;x:number;y:number;placeholder:number}
export interface CategoryLayout {columns:number;shape:'landscape'|'square'|'portrait'|'circle'|'pill';presentation:'minimal'|'artwork';height:number;radius:number;labels:'overlay'|'below'|'hidden'}
export interface Appearance {enabled:boolean;atmosphereSeed?:string;accentCustom?:boolean;accent:string;background:string;surface:string;text:string;secondary:string;radius:number;spacing:number;poster:number;blur:boolean;transparency:boolean;effects:boolean}
export interface StudioConfig {version:1;homeRevision?:2;widgets:Widget[];categories:Category[];categoryLayout:CategoryLayout;appearance:Appearance}
export const defaultAppearance:Appearance={enabled:false,accent:'#e6a039',background:'#101111',surface:'#202326',text:'#f0f0ed',secondary:'#b0b6b7',radius:12,spacing:20,poster:172,blur:true,transparency:true,effects:true};
export function widget(kind:WidgetKind,id:string=randomId()):Widget{return{id,kind,title:({continue:'Continue Watching',categories:'Browse Your Collection',recent:'Recently Added',custom:'Custom Section'})[kind],visible:true,source:kind==='custom'?'selection':'favorites',media:kind==='continue'?'Series':'all',library:'',genre:'',year:'',minRating:0,watched:'all',sort:kind==='continue'?'DatePlayed':kind==='recent'?'DateCreated':'SortName',limit:kind==='continue'?3:12,layout:kind==='continue'?'carousel':'row',art:kind==='continue'?'episode':'poster',size:kind==='continue'?'large':'medium',spacing:20,includeMovies:kind==='continue',selection:[]};}
export function defaultStudio():StudioConfig{return{version:1,homeRevision:2,widgets:[widget('continue','continue'),widget('categories','categories'),widget('recent','recent'),{...widget('custom','favorites'),title:'Favorites',source:'favorites'}],categories:[{id:'movies',title:'All Movies',target:'movies',value:'',visible:true,image:'auto',zoom:1,x:50,y:30,placeholder:0},{id:'shows',title:'All TV Shows',target:'shows',value:'',visible:true,image:'auto',zoom:1,x:50,y:30,placeholder:1}],categoryLayout:{columns:4,shape:'landscape',presentation:'minimal',height:180,radius:14,labels:'overlay'},appearance:{...defaultAppearance}};}
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
const str=(v:unknown,f='',max=120)=>typeof v==='string'?v.slice(0,max):f;
const num=(v:unknown,f:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;
const one=<T extends string>(v:unknown,values:readonly T[],f:T):T=>values.includes(v as T)?v as T:f;
const bool=(v:unknown,f:boolean)=>typeof v==='boolean'?v:f;
export function normalizeStudio(value:unknown):StudioConfig {
 const raw=obj(value),base=defaultStudio();if(raw.version!==1)return base;
 const widgets:Widget[]=Array.isArray(raw.widgets)?raw.widgets.slice(0,20).map((entry:unknown,i:number)=>{const r=obj(entry);const kind=one(r.kind,['continue','categories','recent','custom'],'custom'),d=widget(kind,`restored-${i}`);return{...d,id:/^[a-zA-Z0-9-]{1,80}$/.test(r.id)?r.id:d.id,title:str(r.title,d.title),visible:bool(r.visible,true),source:one(r.source,['favorites','rated','unwatched','genre','library','selection','released','nextup'],d.source),media:one(r.media,['all','Movie','Series'],'all'),library:str(r.library),genre:str(r.genre),year:typeof r.year==='string'&&/^\d{0,4}$/.test(r.year)?r.year:'',minRating:num(r.minRating,0,0,10),watched:one(r.watched,['all','watched','unwatched'],'all'),sort:one(r.sort,['SortName','DateCreated','CommunityRating','DatePlayed','PremiereDate'],'SortName'),limit:Math.round(num(r.limit,d.limit,1,40)),layout:one(r.layout,['row','grid','carousel'],d.layout),art:one(r.art,['poster','backdrop','episode'],d.art),size:one(r.size,['small','medium','large'],d.size),spacing:num(r.spacing,20,8,40),includeMovies:bool(r.includeMovies,d.includeMovies),selection:Array.isArray(r.selection)?[...new Set(r.selection.filter((v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(v)))].slice(0,40) as string[]:[]};}):base.widgets;
 if(raw.homeRevision!==2){const legacy=widgets.find((w:Widget)=>w.id==='custom'&&w.kind==='custom'&&w.source==='favorites'&&/^(My Custom Section|Favorites)$/i.test(w.title.trim()));if(legacy){legacy.id='favorites';legacy.title='Favorites';widgets.splice(widgets.indexOf(legacy),1);const recent=widgets.findIndex((w:Widget)=>w.kind==='recent');widgets.splice(recent<0?widgets.length:recent+1,0,legacy);}}
 const categories=Array.isArray(raw.categories)?raw.categories.slice(0,20).map((entry:unknown,i:number)=>{const r=obj(entry);return{id:/^[a-zA-Z0-9-]{1,80}$/.test(r.id)?r.id:`category-${i}`,title:str(r.title,'Category'),target:one(r.target,['movies','shows','genre','library'],'genre'),value:str(r.value),visible:bool(r.visible,true),image:one(r.image,['auto','builtin','upload','library'],'auto'),imageKey:str(r.imageKey,undefined,500)||undefined,itemId:str(r.itemId)||undefined,zoom:num(r.zoom,1,1,3),x:num(r.x,50,0,100),y:num(r.y,30,0,100),placeholder:num(r.placeholder,0,0,3)};}):base.categories;
 const a=obj(raw.appearance),appearance:Appearance={...defaultAppearance,enabled:bool(a.enabled,false),accentCustom:bool(a.accentCustom,bool(a.enabled,false)),radius:num(a.radius,12,0,28),spacing:num(a.spacing,20,8,40),poster:num(a.poster,172,120,260),blur:bool(a.blur,true),transparency:bool(a.transparency,true),effects:bool(a.effects,true)};
 for(const k of ['accent','background','surface','text','secondary'] as const)if(/^#[0-9a-f]{6}$/i.test(a[k]))appearance[k]=a[k];
 if(isHex(a.atmosphereSeed))appearance.atmosphereSeed=a.atmosphereSeed;
 if(appearance.enabled){appearance.atmosphereSeed=isHex(a.atmosphereSeed)?a.atmosphereSeed:appearance.background;Object.assign(appearance,atmosphereFromSeed(appearance.atmosphereSeed));}
 if(appearanceErrors({...appearance,accent:readableAccent(appearance.accent,appearance.background,appearance.surface)}).length)appearance.enabled=false;
 const c=obj(raw.categoryLayout);
 return{version:1,homeRevision:2,widgets:widgets.filter((w:Widget,i:number,all:Widget[])=>all.findIndex(v=>v.id===w.id)===i),categories:categories.filter((w:Category,i:number,all:Category[])=>all.findIndex(v=>v.id===w.id)===i),appearance,categoryLayout:{columns:Math.round(num(c.columns,4,1,6)),shape:one(c.shape,['landscape','square','portrait','circle','pill'],'landscape'),presentation:one(c.presentation,['minimal','artwork'],'minimal'),height:num(c.height,180,120,320),radius:num(c.radius,14,0,28),labels:one(c.labels,['overlay','below','hidden'],'overlay')}};
}
export function luminance(hex:string){const rgb=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
export function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function appearanceErrors(a:Appearance){if(['accent','background','surface','text','secondary'].some(k=>!/^#[0-9a-f]{6}$/i.test(a[k as keyof Appearance] as string)))return['Use complete six-digit HEX colors.'];const errors:string[]=[];if(luminance(a.background)>.18||luminance(a.surface)>.22)errors.push('Choose a dark background and surface to keep Cinema readable.');for(const k of ['text','secondary'] as const)if(Math.min(contrast(a[k],a.background),contrast(a[k],a.surface))<4.5)errors.push(`${k==='text'?'Primary':'Secondary'} text needs at least 4.5:1 contrast against both colors.`);if(Math.min(contrast(a.accent,a.background),contrast(a.accent,a.surface))<3)errors.push('Accent needs at least 3:1 contrast against the background and surface.');return errors;}
export function widgetQuery(w:Widget):BrowseQuery{return{kind:w.kind==='continue'?(w.includeMovies?undefined:'Episode'):w.media==='all'?undefined:w.media,parentId:w.library||undefined,limit:w.kind==='continue'?40:w.limit,sort:w.kind==='continue'?'DatePlayed':w.kind==='recent'?'DateCreated':w.source==='rated'?'CommunityRating':w.source==='released'?'PremiereDate':w.sort,resume:w.kind==='continue'||undefined,favorite:w.kind==='custom'&&w.source==='favorites'||undefined,genre:selectedTag(w.genre)?undefined:w.genre||undefined,year:/^\d{4}$/.test(w.year)?w.year:undefined,maxPremiereDate:w.kind==='custom'&&w.source==='released'?new Date().toISOString():undefined,minRating:w.minRating||undefined,played:w.source==='unwatched'||w.watched==='unwatched'?false:w.watched==='watched'?true:undefined};}
export function continueItems(items:ItemDto[],w:Widget,nextUp:ItemDto[]=[],early:ItemDto[]=[]){
 const seen=new Set<string>();const earlyIds=new Set(early.map(item=>item.Id));
 const resumes=[...early,...items].filter(i=>(!i.UserData?.Played||earlyIds.has(i.Id))&&(i.UserData?.PlaybackPositionTicks??0)>0&&(i.Type==='Episode'||w.includeMovies&&i.Type==='Movie')).sort((a,b)=>(Date.parse(b.UserData?.LastPlayedDate??'')||0)-(Date.parse(a.UserData?.LastPlayedDate??'')||0));
 // Actual recent playback takes priority over a different Next Up episode in that series.
 const next=nextUp.filter(i=>i.Type==='Episode'&&!i.UserData?.Played);
 return [...resumes,...next].filter(i=>{const key=i.Type==='Episode'?i.SeriesId??i.Id:i.Id;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,w.limit);
}
export function moveWidget(config:StudioConfig,from:number,to:number){if(from<0||to<0||from>=config.widgets.length||to>=config.widgets.length)return config;const widgets=[...config.widgets];const [item]=widgets.splice(from,1);widgets.splice(to,0,item);return{...config,widgets};}
/** Upgrade a deliberately edited pre-Studio demo home; untouched legacy defaults adopt four rows. */
export function migrateLegacyHome(sections:unknown):StudioConfig {
 const base=defaultStudio();
 if(!Array.isArray(sections)||sections.join(',')==='continue,new,picks,top,shows')return base;
 const known=[...new Set(sections.filter((s):s is string=>typeof s==='string'&&['continue','new','picks','top','shows'].includes(s)))];
 const old=known.map(id=>{
  if(id==='continue')return widget('continue','continue');
  if(id==='new')return widget('recent','recent');
  const result=widget('custom',id);result.title=id==='top'?'Highly rated':id==='shows'?'Your next great series':'From your collection';result.source=id==='top'?'rated':'library';result.media=id==='shows'?'Series':'all';return result;
 });
 if(old.length)old.splice(Math.min(1,old.length),0,widget('categories','categories'));
 return{...base,widgets:old};
}




