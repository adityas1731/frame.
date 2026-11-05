/** Native Jellyfin ticks are absolute item times, independent of stream offsets. */
export const segmentTypes=['Intro','Recap','Outro','Preview','Commercial'] as const;
export type SegmentType=typeof segmentTypes[number];
export type SkipMode='off'|'button'|'auto';
export type SkippingPreferences=Record<SegmentType,SkipMode>;
export interface MediaSegment {type:SegmentType;start:number;end:number;key:string}
export interface SegmentInfo {status:'ready'|'restricted'|'unsupported'|'unavailable';segments:MediaSegment[]}
export const segmentLabel:Record<SegmentType,string>={Intro:'Intro',Recap:'Recap',Outro:'Credits',Preview:'Preview',Commercial:'Commercial'};
export function skippingPreferences(value:unknown):SkippingPreferences{
 const raw=value&&typeof value==='object'?value as Record<string,unknown>:{};
 return Object.fromEntries(segmentTypes.map(type=>[type,['off','button','auto'].includes(String(raw[type]))?raw[type]:['Intro','Recap','Outro'].includes(type)?'button':'off'])) as SkippingPreferences;
}
export function skippingKey(scope:string){return `${scope}:skipping.v1`;}
export function loadSkipping(scope:string,storage:Pick<Storage,'getItem'>):SkippingPreferences{try{return skippingPreferences(JSON.parse(storage.getItem(skippingKey(scope))??'null'));}catch{return skippingPreferences(null);}}
export function saveSkipping(scope:string,value:SkippingPreferences,storage:Pick<Storage,'setItem'>){storage.setItem(skippingKey(scope),JSON.stringify(skippingPreferences(value)));}
const identity=(id:string)=>id.replaceAll('-','').toLowerCase();
export function parseSegments(value:unknown,itemId:string):MediaSegment[]{
 if(!value||typeof value!=='object'||!Array.isArray((value as {Items?:unknown}).Items))return [];
 const unique=new Map<string,MediaSegment>();
 for(const raw of (value as {Items:unknown[]}).Items.slice(0,1000)){
  if(!raw||typeof raw!=='object')continue;const s=raw as Record<string,unknown>;
  if(typeof s.ItemId!=='string'||identity(s.ItemId)!==identity(itemId)||!segmentTypes.includes(s.Type as SegmentType))continue;
  if(typeof s.StartTicks!=='number'||typeof s.EndTicks!=='number'||!Number.isSafeInteger(s.StartTicks)||!Number.isSafeInteger(s.EndTicks)||s.StartTicks<0||s.EndTicks<=s.StartTicks)continue;
  const start=s.StartTicks/10000000,end=s.EndTicks/10000000,type=s.Type as SegmentType,key=`${type}:${start}:${end}`;
  unique.set(key,{type,start,end,key});
 }
 return [...unique.values()].sort((a,b)=>a.start-b.start||a.end-b.end||a.type.localeCompare(b.type));
}
/** Allow only sub-second container rounding at the credits endpoint, never rescale a cut. */
export function activeSegment(segments:MediaSegment[],position:number,duration:number,preferences:SkippingPreferences,sourceDuration?:number){
 if(!Number.isFinite(position)||!Number.isFinite(duration)||duration<=0)return undefined;
 // A materially different negotiated source must not inherit another version's timings.
 if(sourceDuration!==undefined&&(!Number.isFinite(sourceDuration)||sourceDuration<=0||Math.abs(sourceDuration-duration)>1))return undefined;
 for(const s of segments){
  if(preferences[s.type]==='off'||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start)continue;
  const overflow=s.end-duration;
  if(overflow>0&&(s.type!=='Outro'||overflow>0.5))continue;
  const end=Math.min(s.end,duration);
  if(position>=s.start&&position<end)return end===s.end?s:{...s,end};
 }
 return undefined;
}
/** One automatic attempt per segment and item lifetime, including failed seeks. */
export class SegmentSkipper {
 private attempted=new Set<string>();
 automatic(segment:MediaSegment|undefined,preferences:SkippingPreferences,playing:boolean){
  if(!segment||!playing||preferences[segment.type]!=='auto'||this.attempted.has(segment.key))return undefined;
  this.attempted.add(segment.key);return segment.end;
 }
}
