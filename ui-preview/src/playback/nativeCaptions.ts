import {cleanSubtitleText,subtitleDelaySeconds} from './subtitles.ts';
/** Native iPhone fullscreen cannot display Frame's DOM caption overlay. Create
 * separate, plain-text cues on the media timeline; never alter the source cues. */
export function nativeCaptionTimeline(cues:Iterable<TextTrackCue>,offset:number,delay:number){
 const ordered=Array.from(cues);const result:{start:number;end:number;text:string}[]=[];
 for(let i=0;i<ordered.length;i++){
  const cue=ordered[i] as VTTCue;
  const start=cue.startTime-offset+subtitleDelaySeconds(delay);
  // Match Frame's latest-dialogue rendering rather than stacking old cues.
  const next=ordered[i+1]?.startTime??Infinity;
  const end=Math.min(cue.endTime,next)-offset+subtitleDelaySeconds(delay);
  const plain=typeof cue.getCueAsHTML==='function'?cue.getCueAsHTML().textContent??'':(cue.text??'').replace(/<[^>]*>/g,'');
  const text=cleanSubtitleText(plain);
  if(text&&Number.isFinite(start)&&Number.isFinite(end)&&end>Math.max(0,start))result.push({start:Math.max(0,start),end,text});
 }
 return result;
}
