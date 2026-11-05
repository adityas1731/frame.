/** Static resume presentation only; this never seeks or reports playback. */
export function resumeProgress(position:number,durationTicks?:number){
 const duration=durationTicks&&Number.isFinite(durationTicks)&&durationTicks>0?durationTicks/10000000:undefined;
 const safe=Number.isFinite(position)?Math.max(0,position):0;
 const current=duration===undefined?safe:Math.min(safe,duration);
 return {position:current,remaining:duration===undefined?undefined:Math.max(0,duration-current),percent:duration===undefined?undefined:current/duration*100};
}
