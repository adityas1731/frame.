/** Public provider responses and episode stills only. No Jellyfin DTOs or tokens. */
export interface PublicCacheEntry { key:string; savedAt:number; freshUntil:number; value:string|Blob; bytes:number }
export interface PublicCacheStore {
 get(key:string):Promise<PublicCacheEntry|undefined>;
 put(entry:PublicCacheEntry):Promise<void>;
 remove(key:string):Promise<void>;
 clear():Promise<void>;
}
export const PUBLIC_CACHE_MAX_AGE=30*86400000;
export function publicCacheKey(key:string){
 return /^api:(?:lookup\/shows\?(?:imdb=tt\d{7,10}|thetvdb=[1-9]\d*)|(?:shows|episodes)\/[1-9]\d*\?embed=(?:cast|guestcast)|shows\/[1-9]\d*\/episodes\?specials=1)$/.test(key)||
 /^image:https:\/\/static\.tvmaze\.com\/uploads\/images\/(?:original_untouched|original|medium_landscape)\/\d+\/\d+\.(?:jpg|png|webp)$/.test(key);
}
export function usablePublicEntry(entry:PublicCacheEntry|undefined,key:string,now:number){
 return !!entry&&entry.key===key&&publicCacheKey(key)&&Number.isFinite(entry.savedAt)&&entry.savedAt<=now&&now-entry.savedAt<PUBLIC_CACHE_MAX_AGE;
}
export function cacheEvictions(entries:PublicCacheEntry[],now:number){
 const newest=entries.sort((a,b)=>b.savedAt-a.savedAt);let count=0,bytes=0;
 return newest.filter(e=>{if(!usablePublicEntry(e,e.key,now))return true;count++;bytes+=e.bytes;return count>100||bytes>48*1024*1024;}).map(e=>e.key);
}
export class BrowserPublicCache implements PublicCacheStore {
 private name:string;
 constructor(name='frame-public-provider-cache'){this.name=name;}
 private async db(){
  if(typeof indexedDB==='undefined')return undefined;
  return new Promise<IDBDatabase|undefined>(resolve=>{
   let done=false;const finish=(db?:IDBDatabase)=>{if(done){db?.close();return;}done=true;clearTimeout(timer);resolve(db);};
   const timer=setTimeout(()=>finish(),1500);
   try{const r=indexedDB.open(this.name,1);r.onupgradeneeded=()=>r.result.createObjectStore('entries',{keyPath:'key'});r.onsuccess=()=>finish(r.result);r.onerror=()=>finish();r.onblocked=()=>finish();}catch{finish();}
  });
 }
 async get(key:string){
  if(!publicCacheKey(key))return;const db=await this.db();if(!db)return;
  try{return await new Promise<PublicCacheEntry|undefined>(resolve=>{const tx=db.transaction('entries');const r=tx.objectStore('entries').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(undefined);tx.onabort=()=>resolve(undefined);});}catch{return undefined;}finally{db.close();}
 }
 private async write(action:(store:IDBObjectStore)=>void){
  const db=await this.db();if(!db)return;
  try{await new Promise<void>(resolve=>{const tx=db.transaction('entries','readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();action(tx.objectStore('entries'));});}catch{/* Storage denial must never break a card. */}finally{db.close();}
 }
 async put(entry:PublicCacheEntry){
  if(!publicCacheKey(entry.key)||entry.bytes>5*1024*1024)return;
  await this.write(store=>{store.put(entry);const all=store.getAll();all.onsuccess=()=>cacheEvictions(all.result,Date.now()).forEach(key=>store.delete(key));});
 }
 async remove(key:string){await this.write(store=>store.delete(key));}
 async clear(){await this.write(store=>store.clear());}
}
export const publicProviderCache:PublicCacheStore=new BrowserPublicCache();
