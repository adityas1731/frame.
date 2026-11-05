import {requestSignal} from '../platform/browser.ts';
import type { JellyfinClient } from '../jellyfin/client.ts';
import type { Fetcher, ItemDto } from '../jellyfin/types.ts';
import { ProviderError, providerId, type OnlineMetadata, type ProviderCast } from './metadata.ts';
import {episodeScheduleCompatible} from './episodeIdentity.ts';
import {publicProviderCache,usablePublicEntry,type PublicCacheStore} from './publicCache.ts';

const record = (v: unknown): Record<string, any> => v && typeof v==='object' && !Array.isArray(v) ? v as Record<string,any> : {};
const text = (v: unknown): string|undefined => typeof v==='string' && v.trim() ? v.trim() : undefined;
const positiveId = (v?:string) => !!v && /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v));
// Provider HTML is rendered as plain React text, never inserted as HTML.
export function plainSummary(v:unknown) {
  return text(v)?.replace(/<[^>]*>/g,' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[entity]!)).replace(/\s+/g,' ').trim() || undefined;
}
function publicImage(v:unknown) {
  if(typeof v!=='string')return undefined;
  try { const url=new URL(v);return url.origin==='https://static.tvmaze.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/uploads\/images\/(?:original_untouched|original|medium_portrait|medium_landscape)\/\d+\/\d+\.(jpg|png|webp)$/.test(url.pathname)?url.href:undefined; } catch { return undefined; }
}

/** No provider key. Public TVmaze reads plus authenticated, read-only Jellyfin artwork discovery. */
export class FreeMetadataClient {
  private server: JellyfinClient;
  private fetcher: Fetcher;
  private imageUrl: (url:string)=>string;
  private now: ()=>number;
  private controller=new AbortController();
  private cache=new Map<string,{expires:number;promise:Promise<any>}>();
  private active=0;
  private queue:(()=>void)[]=[];
  private cooldown=0;
  private portraitsActive=0;
  private portraitQueue:(()=>void)[]=[];
  private generation=0;
  private store:PublicCacheStore;
  constructor(server:JellyfinClient, fetcher:Fetcher=(url,init)=>fetch(url,init), imageUrl=(url:string)=>url, now=Date.now,store:PublicCacheStore=publicProviderCache) {
    this.server=server;this.fetcher=fetcher;this.imageUrl=imageUrl;this.now=now;this.store=store;
  }
  async clearCache(){this.generation++;this.cache.clear();this.server.invalidateRemoteImages();await this.store.clear().catch(()=>{});}
  dispose(){this.controller.abort();this.cache.clear();this.queue.splice(0).forEach(resolve=>resolve());this.portraitQueue.splice(0).forEach(resolve=>resolve());}
  /** Movie cast uses verified person IDs, never actor-name guesses. */
  portrait(userId:string,personId:string):Promise<string|null>{
    return this.cached(`portrait:${userId}:${personId}`,async()=>{
      if(this.portraitsActive>=3)await new Promise<void>(resolve=>this.portraitQueue.push(resolve));else this.portraitsActive++;
      try{
        if(this.controller.signal.aborted)throw new ProviderError('Online metadata is disabled.');
        const person=await this.server.item(userId,personId);
        if(person.Id!==personId||person.Type!=='Person')return null;
        if(!positiveId(providerId(person,'Tmdb')))throw new ProviderError('Photo unavailable: no verified TMDB person ID.');
        const image=await this.server.remotePortrait(person);
        if(this.controller.signal.aborted)throw new ProviderError('Online metadata is disabled.');
        if(!image)throw new ProviderError('Photo unavailable: Jellyfin’s provider returned no portrait.');
        return this.imageUrl(image.url);
      }finally{const next=this.portraitQueue.shift();if(next)next();else this.portraitsActive--;}
    });
  }
  private cached<T>(key:string, work:()=>Promise<T>,ttl=21600000):Promise<T> {
    if(this.controller.signal.aborted)return Promise.reject(new ProviderError('Online metadata is disabled.'));
    const cached=this.cache.get(key);if(cached&&cached.expires>this.now())return cached.promise;
    const entry={expires:this.now()+ttl,promise:Promise.resolve() as Promise<T>};
    entry.promise=work().then(value=>{
      const data=record(value);
      const incompleteEpisode=key.startsWith('item:')&&data.kind==='episode'&&!data.still;
      const missingProviderImage=key.startsWith('tvmaze:')&&key.includes('/episodes')&&(Array.isArray(value)?value.some(row=>!record(row).image):!data.image);
      if(value===null||Array.isArray(value)&&value.length===0||incompleteEpisode||missingProviderImage)entry.expires=this.now()+120000;
      return value;
    }).catch(error=>{entry.expires=this.now()+5000;throw error;});
    this.cache.set(key,entry);if(this.cache.size>150)this.cache.delete(this.cache.keys().next().value!);return entry.promise;
  }
  private json(path:string):Promise<any> {
    return this.cached(`tvmaze:${path}`,async()=>{
      const generation=this.generation,key=`api:${path}`;
      const saved=await this.store.get(key).catch(()=>undefined);
      let previous:any;
      if(usablePublicEntry(saved,key,this.now())&&typeof saved!.value==='string')try{previous=JSON.parse(saved!.value);}catch{/* Ignore a corrupt snapshot. */}
      if(this.controller.signal.aborted)throw new ProviderError('Online metadata is disabled.');
      if(previous&&saved!.freshUntil>this.now())return previous;
      if(this.active>=3)await new Promise<void>(resolve=>this.queue.push(resolve));else this.active++;
      const cancellation=requestSignal([this.controller.signal],10000);
      try {
        if(this.controller.signal.aborted)throw new ProviderError('Online metadata is disabled.');
        if(this.now()<this.cooldown){if(previous)return previous;throw new ProviderError('TVmaze is busy. Jellyfin data remains available.');}
        const response=await this.fetcher(`https://api.tvmaze.com/${path}`,{method:'GET',headers:{Accept:'application/json'},credentials:'omit',referrerPolicy:'no-referrer',redirect:'follow',cache:'no-store',signal:cancellation.signal});
        if(response.url&&new URL(response.url).origin!=='https://api.tvmaze.com')throw new ProviderError('Unexpected provider response.');
        if(response.status===429){const seconds=Number(response.headers.get('Retry-After'));this.cooldown=this.now()+(Number.isFinite(seconds)&&seconds>0?seconds*1000:60000);}
        if(!response.ok){
          if(previous&&(response.status===429||response.status>=500))return previous;
          if(response.status===404)await this.store.remove(key).catch(()=>{});
          throw new ProviderError(response.status===404?'No exact TVmaze record is available.':'TV details are temporarily unavailable.');
        }
        const parsed=await response.json();const value=Array.isArray(parsed)?parsed:record(parsed);
        const serialized=JSON.stringify(value),missingImage=path.includes('/episodes')&&(Array.isArray(value)?value.some(row=>!record(row).image):!value.image);
        if(generation===this.generation&&!this.controller.signal.aborted&&serialized.length<2*1024*1024)await this.store.put({key,savedAt:this.now(),freshUntil:this.now()+(missingImage?120000:3600000),value:serialized,bytes:serialized.length*2}).catch(()=>{});
        return value;
      } catch(error){
        if(!this.controller.signal.aborted&&!(error instanceof ProviderError)&&previous)return previous;
        throw error instanceof ProviderError?error:new ProviderError('TV details could not be loaded. Jellyfin data remains available.');
      }
      finally {cancellation.dispose();const next=this.queue.shift();if(next)next();else this.active--;}
    },3600000);
  }
  private async tvDetails(item:ItemDto,parent?:ItemDto):Promise<OnlineMetadata|null> {
    if(item.Type!=='Series'&&item.Type!=='Episode')return null;
    const own=providerId(item,'Tvmaze'), imdb=providerId(item,'Imdb'), tvdb=providerId(item,'Tvdb');
    if(own&&!positiveId(own)||imdb&&!/^tt\d{7,10}$/.test(imdb)||tvdb&&!positiveId(tvdb))throw new ProviderError('Provider IDs need review. No identity was guessed.');
    const episode=item.Type==='Episode';
    if(episode&&item.IndexNumberEnd!==undefined&&item.IndexNumberEnd!==item.IndexNumber)return null;
    if(episode&&!own){
      if(!parent||parent.Type!=='Series'||item.SeriesId!==parent.Id||!Number.isInteger(item.ParentIndexNumber)||!Number.isInteger(item.IndexNumber)||item.ParentIndexNumber!<1||item.IndexNumber!<1||parent.DisplayOrder&&!/^aired$/i.test(parent.DisplayOrder))return null;
      const series=await this.tvDetails(parent);if(!series)return null;
      // One cached aired-order list per verified show, never one provider call per card.
      const values=await this.json(`shows/${series.id}/episodes?specials=1`);
      if(!Array.isArray(values))throw new ProviderError('Episode details unavailable.');
      const matches=values.map(record).filter(value=>value.season===item.ParentIndexNumber&&value.number===item.IndexNumber);
      if(matches.length!==1)return null;const value=matches[0];
      if(!positiveId(String(value.id)))return null;
      if(value._links?.show?.href&&value._links.show.href!==`https://api.tvmaze.com/shows/${series.id}`)throw new ProviderError('Episode identity mismatch.');
      if(!episodeScheduleCompatible(item,parent,value))return null;
      return this.episodeDetails(value);
    }
    if(!own&&!imdb&&!tvdb)return null;
    let matched=own;
    if(!episode&&!matched){const lookup=await this.json(`lookup/shows?${imdb?`imdb=${encodeURIComponent(imdb)}`:`thetvdb=${encodeURIComponent(tvdb!)}`}`);matched=String(lookup.id);}
    if(!positiveId(matched))throw new ProviderError('No exact provider record is available.');
    const value=await this.json(`${episode?'episodes':'shows'}/${matched}?embed=${episode?'guestcast':'cast'}`);
    if(value.id!==Number(matched))throw new ProviderError('Provider identity mismatch. Jellyfin data was preserved.');
    if(!episode&&(imdb&&value.externals?.imdb!==imdb||tvdb&&String(value.externals?.thetvdb)!==tvdb))throw new ProviderError('Provider IDs conflict. Jellyfin data was preserved.');
    const rows=record(value._embedded)[episode?'guestcast':'cast'];
    const cast:ProviderCast[]=Array.isArray(rows)?rows.slice(0,30).map(record).filter(p=>text(p.person?.name)).map(p=>({name:text(p.person.name)!,role:text(p.character?.name),image:this.mapImage(p.person?.image?.original??p.person?.image?.medium)})):[];
    const rating=record(value.rating).average, runtime=value.runtime??value.averageRuntime, date=value.airdate??value.premiered;
    return {id:value.id,kind:episode?'episode':'tv',label:'TVmaze',name:text(value.name),overview:plainSummary(value.summary),rating:typeof rating==='number'&&rating>=0&&rating<=10?rating:undefined,runtime:typeof runtime==='number'&&Number.isFinite(runtime)&&runtime>0?runtime:undefined,date:typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))?date:undefined,genres:Array.isArray(value.genres)?value.genres.filter((v:unknown)=>typeof v==='string'):undefined,cast,still:episode?(this.mapImage(value.image?.original)??this.mapImage(value.image?.medium)):undefined,stillFallback:episode?this.mapImage(value.image?.medium):undefined,source:`https://www.tvmaze.com/${episode?'episodes':'shows'}/${value.id}`};
  }
  private episodeDetails(value:Record<string,any>):OnlineMetadata {
    const rating=value.rating?.average;
    return {id:value.id,kind:'episode',name:text(value.name),overview:plainSummary(value.summary),rating:typeof rating==='number'&&rating>=0&&rating<=10?rating:undefined,runtime:typeof value.runtime==='number'&&Number.isFinite(value.runtime)&&value.runtime>0?value.runtime:undefined,date:typeof value.airdate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.airdate)&&Number.isFinite(Date.parse(value.airdate))?value.airdate:undefined,still:(this.mapImage(value.image?.original)??this.mapImage(value.image?.medium)),stillFallback:this.mapImage(value.image?.medium),cast:[],label:'TVmaze',source:`https://www.tvmaze.com/episodes/${value.id}`};
  }
  private mapImage(value:unknown){const safe=publicImage(value);return safe?this.imageUrl(safe):undefined;}
  enrich(item:ItemDto, parent?:ItemDto):Promise<OnlineMetadata|null> {
    return this.cached(`item:${JSON.stringify([item.Id,item.Name,item.Type,item.ProviderIds,item.ParentIndexNumber,item.IndexNumberEnd,item.IndexNumber,parent?.Id,parent?.ProviderIds,parent?.DisplayOrder,item.PremiereDate])}`,async()=>{
      const [metadata,art]=await Promise.allSettled([this.tvDetails(item,parent),this.server.remoteBackdrop(item)]);
      if(this.controller.signal.aborted)throw new ProviderError('Online metadata is disabled.');
      const details=metadata.status==='fulfilled'?metadata.value:null;
      const backdrop=art.status==='fulfilled'?art.value:null;
      if(!details&&!backdrop){if(metadata.status==='rejected')throw metadata.reason;return null;}
      const tmdb=providerId(item,'Tmdb');
      return {...(details??{id:Number(tmdb),kind:item.Type==='Movie'?'movie' as const:'tv' as const,cast:[],source:''}),...(backdrop?{backdrop:this.imageUrl(backdrop.url),backdropWidth:backdrop.width,artworkLabel:'TMDB via Jellyfin',artworkSource:`https://www.themoviedb.org/${item.Type==='Movie'?'movie':'tv'}/${tmdb}`}:{})};
    },item.Type==='Episode'?900000:21600000);
  }
}

