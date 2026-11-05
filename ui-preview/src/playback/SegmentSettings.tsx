import {Select} from '../components/Select';
import {segmentLabel,type SegmentInfo,type SkippingPreferences,type SkipMode} from './segments';

function timestamp(seconds:number){const n=Math.floor(seconds);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
export function SegmentSettings({info,preferences,change,refresh}:{info?:SegmentInfo;preferences:SkippingPreferences;change:(value:SkippingPreferences)=>void;refresh?:()=>void}){
 const notice=!info?'Checking Jellyfin…':info.status==='restricted'?'This account cannot read skip timings.':info.status==='unsupported'?'This server does not provide skip timings.':info.status==='unavailable'?'Could not check timings. Playback is unchanged.':undefined;
 return <div className="player-segments" aria-label="Skip timings"><p className="segment-introduction">For this title</p>{notice&&<p role="status">{notice}</p>}
 {(['Intro','Outro'] as const).map(type=>{const timings=info?.segments.filter(s=>s.type===type)??[];return <div className="player-segment-row" key={type}><div><h3>{segmentLabel[type]}</h3><span className={timings.length?'segment-available':''}>{info?.status==='ready'?timings.length?timings.map(s=>`${timestamp(s.start)}–${timestamp(s.end)}`).join(' · '):'No timing yet':'Timing unavailable'}</span></div><Select aria-label={`${segmentLabel[type]} skipping`} value={preferences[type]} onValueChange={mode=>change({...preferences,[type]:mode as SkipMode})}><option value="off">Off</option><option value="button">Show button</option><option value="auto">Auto-skip</option></Select></div>;})}
 <p>Buttons appear during marked sections. Jellyfin prepares the timings; frame. uses those ranges for skipping.</p>{refresh&&<button type="button" className="segment-check" disabled={!info} onClick={refresh}>Check again</button>}</div>;
}
