/** Strip renderer-only ASS/SSA overrides left literal by some SRT→VTT conversions. */
export function cleanSubtitleText(text:string){return text.replace(/\{\\[^}]*\}/g,'').replace(/\\[Nn]/g,'\n').replace(/\\h/g,' ').trim();}
/** The browser parses and times WebVTT; Frame renders plain text, never provider HTML. */
export function activeCaptionText(track: Pick<TextTrack, 'activeCues'> & Partial<Pick<TextTrack,'cues'>>,time?:number,readTimeline=false): string[] {
  let active=Array.from(track.activeCues??[]);
  // Progressive HTTP resumes begin at media time zero; use the full-title VTT timeline.
  if(readTimeline&&time!==undefined&&track.cues){let low=0,high=track.cues.length;while(low<high){const mid=(low+high)>>>1;if(track.cues[mid].startTime<=time)low=mid+1;else high=mid;}active=low>0?[track.cues[low-1]]:[];}
  const cues=active.filter(cue=>time===undefined||!Number.isFinite(cue.startTime)||cue.startTime<=time&&time<cue.endTime);
  // Some converted tracks contain rolling/overlapping dialogue cues. Render the
  // latest cue group, not a growing stack of earlier dialogue. Keep multiline text.
  let latest=Math.max(...cues.map(c=>Number.isFinite(c.startTime)?c.startTime:-Infinity));
  // Native TextTrackCueList is start-time ordered. An expired newer cue must
  // not allow an old long-running cue to reappear. Binary search avoids scanning
  // a feature-length subtitle track on every media timeupdate.
  if(time!==undefined&&track.cues?.length){let low=0,high=track.cues.length;while(low<high){const mid=(low+high)>>>1;if(track.cues[mid].startTime<=time)low=mid+1;else high=mid;}if(low>0)latest=track.cues[low-1].startTime;}
  const text=cues.filter(c=>!Number.isFinite(c.startTime)||c.startTime===latest).flatMap(cue => {
    const text = cue as VTTCue;
    if (typeof text.text !== 'string') return [];
    const plain = typeof text.getCueAsHTML === 'function'
      ? text.getCueAsHTML().textContent ?? '' : text.text.replace(/<[^>]*>/g, '');
    const cleaned=cleanSubtitleText(plain);return cleaned ? [cleaned] : [];
  });
  // Converted cues can share rounded start timestamps. In timed playback use
  // one latest dialogue block, retaining line breaks inside that cue, rather
  // than stacking separate dialogue blocks that happen to share a timestamp.
  return [...new Set(text)].slice(time===undefined?-2:-1);
}

/** Frame renders styled text itself; native/embedded tracks must never draw over it. */
export function reconcileCaptionTracks(tracks:Iterable<Pick<TextTrack,'mode'>>,owned?:Pick<TextTrack,'mode'>,native?:Pick<TextTrack,'mode'>){
 for(const track of tracks){const expected=track===native?'showing':track===owned?'hidden':'disabled';if(track.mode!==expected)track.mode=expected;}
}

/** Positive delay shows the same cue later; the stream offset maps resumed HTTP time to title time. */
export function subtitleDelaySeconds(value:number){return Number.isFinite(value)?Math.round(Math.max(-120,Math.min(120,value))*10)/10:0;}
export function synchronizedCaptionText(track:Parameters<typeof activeCaptionText>[0],mediaTime:number,streamOffset=0,delay=0){
 return activeCaptionText(track,mediaTime+streamOffset-subtitleDelaySeconds(delay),true);
}
