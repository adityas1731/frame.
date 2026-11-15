/** Keep the surface mounted so short stalls fade away instead of flashing. */
export function PlayerLoading({active,phase}:{active:boolean;phase:string}){
 const label=phase==='buffering'?'Buffering':phase==='seeking'?'Seeking':phase==='negotiating'?'Preparing playback':'Loading';
 return <div className="player-loading" data-active={active||undefined} aria-hidden={!active}>
  <div className="player-loading-pill" role="status" aria-live="polite">
   <span className="player-loading-mark" aria-hidden="true"><i/><i/><i/></span>
   <span>{active?label:''}</span>
  </div>
 </div>;
}
