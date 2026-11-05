import type {ItemDto,Session} from '../jellyfin/types.ts';
type Scope=Pick<Session,'baseUrl'|'server'|'user'>;
type Store=Pick<Storage,'getItem'|'setItem'>;
export interface EarlyProgress {id:string;position:number;duration:number;updated:number}
const lifetime=30*86400000;
export const earlyProgressKey=(session:Scope)=>`frame.early-progress.v1:${JSON.stringify([session.baseUrl,session.server.Id,session.user.Id])}`;
export function earlyProgressStore():Store|undefined{try{return globalThis.localStorage;}catch{return undefined;}}
const memory=new Map<string,EarlyProgress[]>();
export function readEarlyProgress(session:Scope,store?:Store,now=Date.now()):EarlyProgress[]{
 const key=earlyProgressKey(session);let raw:unknown=memory.get(key)??[];
 try{const value=store?.getItem(key);if(value)raw=JSON.parse(value);}catch{/* Storage may be disabled. Keep the page-session fallback. */}
 return (Array.isArray(raw)?raw:[]).filter((r):r is EarlyProgress=>!!r&&typeof r.id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(r.id)&&Number.isFinite(r.position)&&r.position>=1&&Number.isFinite(r.duration)&&r.duration>r.position&&Number.isFinite(r.updated)&&r.updated<=now&&r.updated>now-lifetime).sort((a,b)=>b.updated-a.updated).slice(0,40);
}
export function saveEarlyProgress(session:Scope,id:string,position:number,duration:number,completed=false,store?:Store,now=Date.now()){
 if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))return;
 const rows=readEarlyProgress(session,store,now).filter(row=>row.id!==id);
 if(!completed&&Number.isFinite(position)&&position>=1&&Number.isFinite(duration)&&duration>position)rows.unshift({id,position,duration,updated:now});
 const limited=rows.slice(0,40),key=earlyProgressKey(session);memory.set(key,limited);
 try{store?.setItem(key,JSON.stringify(limited));}catch{/* No credentials or media metadata are stored. */}
}
/** Jellyfin's nonzero resume position and newer watched updates always win. */
export function earlyResumeTicks(item:ItemDto,record?:EarlyProgress){
 const server=item.UserData?.PlaybackPositionTicks??0;if(server>0)return server;
 if(!record||record.id!==item.Id||!['Movie','Episode'].includes(item.Type??''))return 0;
 if((Date.parse(item.UserData?.LastPlayedDate??'')||0)>record.updated)return 0;
 return Math.round(Math.min(record.position,(item.RunTimeTicks??record.duration*10000000)/10000000)*10000000);
}
export function earlyProgressItems(items:ItemDto[],records:EarlyProgress[]){return items.flatMap(item=>{
 const record=records.find(row=>row.id===item.Id),ticks=earlyResumeTicks(item,record);
 return ticks&&record?[{...item,UserData:{...item.UserData,PlaybackPositionTicks:ticks,LastPlayedDate:new Date(Math.max(record.updated,Date.parse(item.UserData?.LastPlayedDate??'')||0)).toISOString()}}]:[];
});}
