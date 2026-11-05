import {formatPlaybackProgress} from '../platform/duration';
import {useEffect,useRef} from 'react';
import {Check,RotateCcw,ListVideo,ArrowLeft} from 'lucide-react';
import {PlayerStory} from './PlayerStory';
import './resume.css';

/** Retained canvas fades above the last video frame without starting another stream. */
export function CompletedScreen({active,title,context,description,duration,episodes,replay,browse,leave}:{active:boolean;title:string;context?:string;description?:string|null;duration:number;episodes:boolean;replay:()=>void;browse:()=>void;leave:()=>void}){
 const first=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(active)first.current?.focus({preventScroll:true});},[active]);
 return <section className="player-pause-screen player-completed-screen" aria-label="Playback finished" aria-hidden={!active} inert={!active} data-visible={active}>
  <PlayerStory title={title} context={context} description={description}>
   <p className="playback-completed-label"><Check size={16}/>{episodes?'Episode Finished':'Finished Watching'}{Number.isFinite(duration)&&duration>0&&<span> · {formatPlaybackProgress(duration,duration)}</span>}</p>
   <div className="player-entry-actions" role="group" aria-label="After playback">
    <button ref={first} className="resume-primary" onClick={replay}><RotateCcw size={18}/>Watch Again</button>
    {episodes?<button className="resume-restart" onClick={browse}><ListVideo size={19}/>Browse Episodes</button>:<button className="resume-restart" onClick={leave}><ArrowLeft size={18}/>Back To Details</button>}
   </div>
  </PlayerStory>
 </section>;
}
