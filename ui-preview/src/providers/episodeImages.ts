import {requestSignal} from '../platform/browser.ts';
import {publicCacheKey,publicProviderCache,usablePublicEntry,type PublicCacheStore} from './publicCache.ts';

/** Immutable public image URLs are the cache identity, never a filename/title guess. */
export class EpisodeImageClient {
 private pending=new Map<string,Promise<Blob>>();private active=0;private queue:(()=>void)[]=[];private generation=0;
 private store:PublicCacheStore;private fetcher:typeof fetch;private now:()=>number;
 constructor(store:PublicCacheStore=publicProviderCache,fetcher:typeof fetch=(input,init)=>fetch(input,init),now=Date.now){this.store=store;this.fetcher=fetcher;this.now=now;}
 async clear(){this.generation++;await this.store.clear();}
 load(url:string):Promise<Blob>{
  const key=`image:${url}`;if(!publicCacheKey(key))return Promise.reject(Error('Unsupported episode image.'));
  const pending=this.pending.get(url);if(pending)return pending;
  const generation=this.generation;
  const work=(async()=>{
   const cached=await this.store.get(key).catch(()=>undefined);
   if(usablePublicEntry(cached,key,this.now())&&cached!.value instanceof Blob)return cached!.value;
   if(this.active>=3)await new Promise<void>(resolve=>this.queue.push(resolve));else this.active++;
   const cancellation=requestSignal([],10000);
   try{
    const r=await this.fetcher(url,{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:cancellation.signal});
    if(!r.ok||r.url&&r.url!==url)throw Error('Episode image unavailable.');
    const blob=await r.blob();if(!/^image\/(?:jpeg|png|webp)$/.test(blob.type)||!blob.size||blob.size>5*1024*1024)throw Error('Invalid episode image.');
    if(generation===this.generation)await this.store.put({key,savedAt:this.now(),freshUntil:this.now()+30*86400000,value:blob,bytes:blob.size}).catch(()=>{});
    return blob;
   }finally{cancellation.dispose();const next=this.queue.shift();if(next)next();else this.active--;}
  })();
  this.pending.set(url,work);void work.finally(()=>{if(this.pending.get(url)===work)this.pending.delete(url);}).catch(()=>{});return work;
 }
}
export const episodeImages=new EpisodeImageClient();
