import type {ItemDto} from '../jellyfin/types.ts';
import {formatPlaybackTime} from '../platform/duration.ts';
export function ticketResumeTime(item?:ItemDto){
 const ticks=item?.UserData?.PlaybackPositionTicks;
 if(typeof ticks!=='number'||!Number.isFinite(ticks)||ticks<=0)return null;
 const duration=item?.RunTimeTicks;
 const total=typeof duration==='number'&&Number.isFinite(duration)&&duration>0?duration:undefined;
 return {elapsed:formatPlaybackTime(Math.min(ticks,total??ticks)/10000000),total:total?formatPlaybackTime(total/10000000):undefined};
}
