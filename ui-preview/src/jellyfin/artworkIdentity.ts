import type {ItemDto} from './types.ts';
const ids=(value:Record<string,string>)=>Object.fromEntries(Object.entries(value).map(([key,id])=>[key.toLowerCase(),id.trim()]));
export function artworkIdentity(item:ItemDto){
 const source=ids(item.ProviderIds??{}),result:Record<string,string>={};
 if(/^tt\d{7,10}$/.test(source.imdb??''))result.Imdb=source.imdb;
 for(const key of item.Type==='Series'?['Tmdb','Tvdb']:['Tmdb']){const value=source[key.toLowerCase()];if(/^[1-9]\d*$/.test(value??'')&&Number.isSafeInteger(Number(value)))result[key]=value;}
 return result;
}
/** The same RemoteSearch as a pasted provider link, without applying a library edit. */
export function exactMetadataMatch(item:ItemDto,value:unknown){
 const expected=ids(artworkIdentity(item));if(!Object.keys(expected).length||!Array.isArray(value))return null;
 const matches=new Map<string,{tmdbId:string;name?:string;overview?:string;year?:number;url?:string}>();
 for(const candidate of value.slice(0,50)){
  if(!candidate||candidate.SearchProviderName!=='TheMovieDb'||!candidate.ProviderIds||typeof candidate.ProviderIds!=='object'||Array.isArray(candidate.ProviderIds))continue;
  const found=ids(Object.fromEntries(Object.entries(candidate.ProviderIds).filter((entry):entry is [string,string]=>typeof entry[1]==='string')));
  if(!/^[1-9]\d*$/.test(found.tmdb??'')||!Number.isSafeInteger(Number(found.tmdb)))continue;
  const common=Object.keys(expected).filter(key=>found[key]);
  if(!common.length||common.some(key=>expected[key]!==found[key]))continue;
  const clean=(v:unknown,max:number)=>typeof v==='string'&&v.trim()?v.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max):undefined;
  let url:string|undefined;
  try{const image=new URL(candidate.ImageUrl);if(image.origin==='https://image.tmdb.org'&&!image.username&&!image.password&&!image.search&&!image.hash&&/^\/t\/p\/(original|w\d+)\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(image.pathname)){image.pathname=image.pathname.replace(/^\/t\/p\/w\d+\//,'/t/p/original/');url=image.href;}}catch{/* Metadata can be valid without a poster. */}
  matches.set(found.tmdb,{tmdbId:found.tmdb,name:clean(candidate.Name,300),overview:clean(candidate.Overview,20000),year:Number.isInteger(candidate.ProductionYear)&&candidate.ProductionYear>1800&&candidate.ProductionYear<3000?candidate.ProductionYear:undefined,url});
 }
 return matches.size===1?[...matches.values()][0]:null;
}
/** Require corroborating IDs and reject conflicts, ambiguity and unsafe images. */
export function exactArtworkPoster(item:ItemDto,value:unknown){
 const expected=ids(artworkIdentity(item));if(!Object.keys(expected).length||!Array.isArray(value))return null;
 const matches=new Map<string,{url:string;tmdbId:string}>();
 for(const candidate of value.slice(0,50)){
  if(!candidate||candidate.SearchProviderName!=='TheMovieDb'||!candidate.ProviderIds||typeof candidate.ProviderIds!=='object'||Array.isArray(candidate.ProviderIds))continue;
  const found=ids(Object.fromEntries(Object.entries(candidate.ProviderIds).filter((entry):entry is [string,string]=>typeof entry[1]==='string')));
  if(!/^[1-9]\d*$/.test(found.tmdb??'')||!Number.isSafeInteger(Number(found.tmdb)))continue;
  const common=Object.keys(expected).filter(key=>found[key]);
  if(!common.length||common.some(key=>expected[key]!==found[key]))continue;
  try{const url=new URL(candidate.ImageUrl);
   if(url.origin!=='https://image.tmdb.org'||url.username||url.password||url.search||url.hash||!/^\/t\/p\/(original|w\d+)\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(url.pathname))continue;
   url.pathname=url.pathname.replace(/^\/t\/p\/w\d+\//,'/t/p/original/');matches.set(found.tmdb,{url:url.href,tmdbId:found.tmdb});
  }catch{/* Ignore unsafe or missing image URLs. */}
 }
 return matches.size===1?[...matches.values()][0]:null;
}
