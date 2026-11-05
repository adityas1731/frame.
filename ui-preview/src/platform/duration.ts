/** Compact HH:MM durations. Inputs are minutes, with seconds omitted. */
export function formatMinutes(value:number):string{
 if(!Number.isFinite(value)||value<0)return '';
 const minutes=Math.floor(value);
 return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}
export function formatPlaybackTime(seconds:number):string{
 return formatMinutes(Number.isFinite(seconds)?Math.max(0,seconds)/60:0);
}
/** Precise player control clock, independent of compact card durations. */
export function formatPlaybackClock(seconds:number):string{
 const value=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;
 return `${String(Math.floor(value/3600)).padStart(2,'0')}:${String(Math.floor(value/60)%60).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
}
export function formatPlaybackProgress(position:number,duration?:number):string{
 const total=duration!==undefined&&Number.isFinite(duration)&&duration>0?duration:undefined;
 const current=total===undefined?position:Math.min(position,total);
 return `${formatPlaybackTime(current)}${total===undefined?'':` / ${formatPlaybackTime(total)}`}`;
}
