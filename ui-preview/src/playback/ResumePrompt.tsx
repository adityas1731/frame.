import {formatPlaybackProgress} from '../platform/duration';
import {Play,RotateCcw} from 'lucide-react';
import type {ItemDto} from '../jellyfin/types';
import type {OnlineMetadata} from '../providers/metadata';
import {episodeLabel} from '../providers/metadata';
import {PlayerStory} from './PlayerStory';
import {resumeProgress} from './resumeProgress';
import './resume.css';

export function ResumePrompt({item,title,position,onChoose}:{item:ItemDto;title:string;online?:OnlineMetadata|null;position:number;onChoose:(choice:'resume'|'restart')=>void}){
 const progress=resumeProgress(position,item.RunTimeTicks);
 const context=item.Type==='Episode'?[item.SeriesName,episodeLabel(item)].filter(Boolean).join(' · '):item.ProductionYear?String(item.ProductionYear):undefined;
 return <section className="player-pause-screen player-resume-screen player-entry" aria-label="Continue watching">
  <PlayerStory title={title} context={context} description={item.Overview}>
   <div className="player-entry-progress">
    {progress.percent!==undefined&&<div className="resume-track" role="progressbar" aria-label="Previously watched" aria-valuenow={Math.round(progress.percent)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${progress.percent}%`}}/></div>}
    <div className="resume-time"><span>{formatPlaybackProgress(progress.position,item.RunTimeTicks?item.RunTimeTicks/10000000:undefined)}</span></div>
   </div>
   <div className="player-entry-actions" role="group" aria-label="Choose playback start" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.stopPropagation();const buttons=Array.from(event.currentTarget.querySelectorAll('button'));const index=buttons.indexOf(event.target as HTMLButtonElement);buttons[(index+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length]?.focus();}}><button autoFocus className="resume-primary" onClick={()=>onChoose('resume')}><Play size={19} fill="currentColor"/>Resume</button><button className="resume-restart" onClick={()=>onChoose('restart')}><RotateCcw size={17}/>Start over</button></div>
  </PlayerStory>
 </section>;
}
