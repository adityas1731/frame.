/** Presentation only: never changes the stream or server playback position. */
export function remainingSeconds(position:number,duration:number){return Number.isFinite(position)&&Number.isFinite(duration)?Math.max(0,duration-Math.max(0,position)):0;}
export function remainingMinutes(position:number,duration:number){return Math.ceil(remainingSeconds(position,duration)/60);}
export function estimatedEnd(now:number,position:number,duration:number,rate=1){return now+remainingSeconds(position,duration)*1000/(Number.isFinite(rate)&&rate>0?rate:1);}

/** A wall-clock estimate is valid only while actively advancing at a known rate. */
export function projectedEnd(now:number,position:number,duration:number,rate:number,advancing:boolean):number|undefined{
 if(!advancing||![now,position,duration,rate].every(Number.isFinite)||position<0||duration<=0||position>=duration||rate<=0)return undefined;
 return estimatedEnd(now,position,duration,rate);
}
