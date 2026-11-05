export type FeaturedPage='discover'|'movies'|'shows';
export interface FeaturedRule{count:number;shuffle:boolean;custom:boolean;selected:string[];hidden:string[]}
export const defaultFeatured=():FeaturedRule=>({count:5,shuffle:true,custom:false,selected:[],hidden:[]});
export function normalizeFeatured(value:unknown):Record<FeaturedPage,FeaturedRule>{
 const raw=value&&typeof value==='object'?value as Record<string,any>:{};
 const ids=(v:unknown):string[]=>Array.isArray(v)?[...new Set(v.filter((s):s is string=>typeof s==='string'&&s.length>0&&s.length<160))].slice(0,200):[];
 return Object.fromEntries(['discover','movies','shows'].map(page=>{const v=raw[page]??{};return[page,{count:typeof v.count==='number'&&Number.isFinite(v.count)?Math.round(Math.max(2,Math.min(20,v.count))):5,shuffle:typeof v.shuffle==='boolean'?v.shuffle:true,custom:v.custom===true,selected:ids(v.selected),hidden:ids(v.hidden)}];})) as Record<FeaturedPage,FeaturedRule>;
}
export function featuredIds(ids:string[],rule:FeaturedRule,random=Math.random){
 const hidden=new Set(rule.hidden),selected=new Set(rule.selected);const pool=[...new Set(ids)].filter(id=>!hidden.has(id)&&(!rule.custom||selected.has(id)));
 if(rule.shuffle)for(let i=pool.length-1;i>0;i--){const j=Math.max(0,Math.min(i,Math.floor(random()*(i+1))));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,rule.count??5);
}
