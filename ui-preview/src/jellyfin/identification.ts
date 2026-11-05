export interface IdentificationQuery { Name?:string; Year?:number; ProviderIds?:Record<string,string> }
export interface IdentificationResult { Name:string; ProductionYear?:number; Overview?:string; SearchProviderName?:string; ProviderIds:Record<string,string> }
/** Parse identifiers only. Never fetch a user-supplied URL. */
export function identificationQuery(input:string,kind:'Movie'|'Series',year?:string):IdentificationQuery {
 const value=input.trim();if(!value)throw Error('Enter a title or a TMDb / IMDb link.');
 if(/^tt\d{7,10}$/.test(value))return {ProviderIds:{Imdb:value}};
 if(/^https?:\/\//i.test(value)){
  const url=new URL(value);if(url.username||url.password||url.search||url.hash)throw Error('Use a plain title link without extra parameters.');
  if(['imdb.com','www.imdb.com'].includes(url.hostname)&&/^\/title\/tt\d{7,10}\/?$/.test(url.pathname))return {ProviderIds:{Imdb:url.pathname.split('/')[2]}};
  const match=url.pathname.match(/^\/(movie|tv)\/([1-9]\d*)(?:-[^/]*)?\/?$/);
  if(['themoviedb.org','www.themoviedb.org'].includes(url.hostname)&&match){if(match[1]!== (kind==='Movie'?'movie':'tv'))throw Error('That link is for a different media type.');return {ProviderIds:{Tmdb:match[2]}};}
  throw Error('Use a TMDb movie/show link or IMDb title link.');
 }
 if(value.length>200||/[\r\n]/.test(value))throw Error('Enter a shorter title.');
 if(year&&!/^\d{4}$/.test(year))throw Error('Use a four-digit year.');
 return {Name:value,...(year?{Year:Number(year)}:{})};
}
export function identificationResults(value:unknown):IdentificationResult[]{
 if(!Array.isArray(value))throw Error('Jellyfin returned an invalid search response.');
 return value.slice(0,50).filter(v=>v&&typeof v.Name==='string'&&v.ProviderIds&&typeof v.ProviderIds==='object').map(v=>({Name:v.Name,ProductionYear:Number.isInteger(v.ProductionYear)?v.ProductionYear:undefined,Overview:typeof v.Overview==='string'?v.Overview:undefined,SearchProviderName:typeof v.SearchProviderName==='string'?v.SearchProviderName:undefined,ProviderIds:Object.fromEntries(Object.entries(v.ProviderIds).filter((entry):entry is [string,string]=>typeof entry[1]==='string'&&(/^(Imdb|Tmdb|Tvdb|TvRage)$/i.test(entry[0]))))})).filter(v=>Object.keys(v.ProviderIds).length>0);
}
