import {useRef,useState} from 'react';
import {formatPlaybackClock} from '../platform/duration';
/** Pointer scrubbing previews locally; only release commits a stream seek. */
export function MusicTimeline({position,duration,disabled,seek}:{position:number;duration:number;disabled:boolean;seek:(seconds:number)=>void}){
 const [draft,setDraft]=useState<number>();const pending=useRef<number|undefined>(undefined);const pointer=useRef<number|undefined>(undefined);
 function clear(){pointer.current=undefined;pending.current=undefined;setDraft(undefined);}
 function commit(){const target=pending.current;clear();if(target!==undefined)seek(target);}
 const shown=Math.max(0,Math.min(draft??position,duration||1));
 return <div className="music-progress"><span>{formatPlaybackClock(shown)}</span><input aria-label="Music playback position" type="range" min={0} max={duration||1} step={.1} disabled={disabled||!duration} value={shown}
  onPointerDown={event=>{pointer.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);}}
  onChange={event=>{const value=Number(event.target.value);if(pointer.current!==undefined){pending.current=value;setDraft(value);}else seek(value);}}
  onPointerUp={event=>{if(pointer.current===event.pointerId)commit();}}
  onPointerCancel={clear} onLostPointerCapture={clear} onBlur={clear}
 /><span>{formatPlaybackClock(duration)}</span></div>;
}
