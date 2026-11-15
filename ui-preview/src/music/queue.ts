import type {ItemDto} from '../jellyfin/types.ts';
export interface QueueEntry {key:number;item:ItemDto}
export interface MusicQueue {entries:QueueEntry[];base:number[];current?:number;shuffle:boolean;repeat:'off'|'all'|'one'}
export const emptyQueue=():MusicQueue=>({entries:[],base:[],shuffle:false,repeat:'off'});
export function nextEntry(queue:MusicQueue,ended=false){
 const index=queue.entries.findIndex(entry=>entry.key===queue.current);
 if(ended&&queue.repeat==='one'&&index>=0)return queue.entries[index];
 return queue.entries[index+1]??(queue.repeat==='all'?queue.entries[0]:undefined);
}
export function shuffleQueue(queue:MusicQueue,enabled:boolean,random:()=>number=Math.random){
 const index=queue.entries.findIndex(entry=>entry.key===queue.current);
 const past=queue.entries.slice(0,index+1),future=queue.entries.slice(index+1);
 if(enabled){for(let i=future.length-1;i>0;i--){const n=Math.max(0,Math.min(i,Math.floor(random()*(i+1))));[future[i],future[n]]=[future[n],future[i]];}}
 else future.sort((a,b)=>queue.base.indexOf(a.key)-queue.base.indexOf(b.key));
 return {...queue,shuffle:enabled,entries:[...past,...future]};
}
export function insertQueue(queue:MusicQueue,entries:QueueEntry[],next=false){
 const index=next?Math.max(0,queue.entries.findIndex(entry=>entry.key===queue.current)+1):queue.entries.length;
 const base=[...queue.base];const at=next?Math.max(0,base.indexOf(queue.current??-1)+1):base.length;base.splice(at,0,...entries.map(entry=>entry.key));
 const ordered=[...queue.entries];ordered.splice(index,0,...entries);return {...queue,base,entries:ordered};
}
export function moveQueue(queue:MusicQueue,key:number,direction:number){const entries=[...queue.entries],from=entries.findIndex(e=>e.key===key),to=from+direction;if(from<0||to<0||to>=entries.length)return queue;[entries[from],entries[to]]=[entries[to],entries[from]];return {...queue,entries,base:entries.map(e=>e.key)};}
export function removeQueue(queue:MusicQueue,key:number){return {...queue,entries:queue.entries.filter(e=>e.key!==key),base:queue.base.filter(id=>id!==key),...(queue.current===key?{current:undefined}:{})};}
