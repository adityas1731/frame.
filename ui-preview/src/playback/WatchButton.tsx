import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router';
import {RotateCcw} from 'lucide-react';
import type {ItemDto} from '../jellyfin/types';
import {useConnection,errorMessage} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import type {JellyfinClient} from '../jellyfin/client';
import {TicketButton,ticketMotionEnabled,ticketTearDuration,ticketAfterTearDelay} from '../components/TicketButton';
/** Resolve metadata only; playback still starts exclusively from the Watch gesture. */
async function watchTarget(client:JellyfinClient,userId:string,item:ItemDto):Promise<ItemDto|undefined>{
 if(item.Type!=='Series')return item;
 const next=await client.nextUp(userId,1,undefined,item.Id);
 if(next.Items[0])return next.Items[0];
 const seasons=await client.seasons(userId,item.Id);
 const season=seasons.Items.find(s=>s.IndexNumber===1)??seasons.Items[0];
 return season?(await client.episodes(userId,item.Id,season.Id)).Items[0]:undefined;
}
export function WatchButton({item,restart=false}:{item:ItemDto;restart?:boolean}) {
 const {client,session}=useConnection();const navigate=useNavigate();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const upcoming=useRemote(`watch-target:${session?.user.Id}:${item.Id}:${restart}`,async()=>client&&session&&!restart?watchTarget(client,session.user.Id,item):undefined);
 const episode=item.Type==='Episode'?item:upcoming.data;
 const episodeLabel=episode?.Type==='Episode'&&episode.ParentIndexNumber!==undefined&&episode.IndexNumber!==undefined?`S${episode.ParentIndexNumber} Ep${episode.IndexNumber}`:undefined;
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function open(){
  if(!client||!session||busy)return;setBusy(true);setError('');
  // Episode lookup runs during the tear and its half-second hold. This delays only route entry,
  // never an active media element's play() gesture or playback controls.
  const tear=!restart&&ticketMotionEnabled()?new Promise<void>(resolve=>setTimeout(resolve,ticketTearDuration+ticketAfterTearDelay)):Promise.resolve();
  try{
   const target=await watchTarget(client,session.user.Id,item);
   if(!target)throw Error('empty');
   await tear;if(!mounted.current)return;
   navigate(`/play/${encodeURIComponent(target.Id)}${restart?'?restart=1':''}`);
  }catch(e){if(mounted.current){setError(e instanceof Error&&e.message==='empty'?'No accessible episode is available.':errorMessage(e));setBusy(false);}}
 }
 const label=(item.UserData?.PlaybackPositionTicks??0)>0?'Resume':'Watch Now';
 return <span className="watch-action">{restart?<button className="button secondary" disabled={busy} aria-label="Restart From Beginning" title="Restart From Beginning" onClick={()=>void open()}><RotateCcw size={15}/>{busy?'Opening…':'Restart'}</button>:<TicketButton stub={episodeLabel&&<span className="ticket-episode-label">{episodeLabel}</span>} disabled={busy} aria-label={episodeLabel?`${label}, ${episodeLabel}`:label} aria-busy={busy} onClick={()=>void open()}>{label}</TicketButton>}{error&&<span role="alert">{error}</span>}</span>;
}
