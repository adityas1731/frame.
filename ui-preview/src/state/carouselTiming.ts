export const FEATURE_INTERVAL_MS=6000;
/** Elapsed visible time, independent from browser scheduling and rendering. */
export function advanceFeatured(elapsed:number,delta:number,count:number,paused=false){
 if(paused||count<2)return{elapsed,advance:false};
 const next=elapsed+Math.max(0,delta);
 return{elapsed:next>=FEATURE_INTERVAL_MS?0:next,advance:next>=FEATURE_INTERVAL_MS};
}
