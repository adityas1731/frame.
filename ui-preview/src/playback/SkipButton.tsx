import {useEffect,useRef,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {segmentLabel,type MediaSegment} from './segments';
/** Stay mounted so both entry and exit can fade; an exiting control cannot seek. */
export function SkipButton({segment,visible,seek}:{segment?:MediaSegment;visible:boolean;seek:(seconds:number)=>void}){
 const [revealed,setRevealed]=useState<string>();
 const key=visible?segment?.key:undefined;
 useEffect(()=>{
  setRevealed(undefined);
  if(!key)return;
  // Let the first video frame settle before transitioning from the mounted hidden state.
  const timer=setTimeout(()=>setRevealed(key),900);
  return()=>clearTimeout(timer);
 },[key]);
 const previous=useRef<MediaSegment|undefined>(undefined);
 if(segment)previous.current=segment;
 const shown=segment??previous.current;const active=visible&&!!segment&&revealed===segment.key;
 return <button className={`player-segment-skip ${active?'segment-visible':''}`} disabled={!active} aria-hidden={!active} tabIndex={active?0:-1} onClick={()=>{if(active&&segment)seek(segment.end);}}><span>Skip {shown?segmentLabel[shown.type]:'Intro'}</span><ArrowRight size={18} aria-hidden="true"/></button>;
}
