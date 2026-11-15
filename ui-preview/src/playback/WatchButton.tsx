import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router';
import {RotateCcw} from 'lucide-react';
import type {ItemDto} from '../jellyfin/types';
import {useConnection,errorMessage} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {watchTarget} from './watchTarget';
import {ticketResumeTime} from './ticketResume';
import {TicketButton,ticketMotionEnabled,ticketTearDuration,ticketAfterTearDelay} from '../components/TicketButton';
export function WatchButton({item,restart=false}:{item:ItemDto;restart?:boolean}) {
 const {client,session}=useConnection();const navigate=useNavigate();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const upcoming=useRemote(`watch-target:${session?.user.Id}:${item.Id}:${restart}`,async()=>client&&session&&!restart?watchTarget(client,session,item):undefined);
 const [openingTarget,setOpeningTarget]=useState<ItemDto>();
 const episode=openingTarget??(item.Type==='Episode'?item:upcoming.data);
 const episodeLabel=episode?.Type==='Episode'&&episode.ParentIndexNumber!==undefined&&episode.IndexNumber!==undefined?`S${episode.ParentIndexNumber} Ep${episode.IndexNumber}`:undefined;
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function open(){
  if(!client||!session||busy)return;setBusy(true);setError('');
  // Episode lookup runs during the tear and its half-second hold. This delays only route entry,
  // never an active media element's play() gesture or playback controls.
  const tear=!restart&&ticketMotionEnabled()?new Promise<void>(resolve=>setTimeout(resolve,ticketTearDuration+ticketAfterTearDelay)):Promise.resolve();
  try{
   const target=await watchTarget(client,session,item);
   if(!target)throw Error('empty');
   setOpeningTarget(target);
   await tear;if(!mounted.current)return;
   navigate(`/play/${encodeURIComponent(target.Id)}${restart?'?restart=1':''}`);
  }catch(e){if(mounted.current){setError(e instanceof Error&&e.message==='empty'?'No accessible episode is available.':errorMessage(e));setBusy(false);}}
 }
 const resume=ticketResumeTime(item.Type==='Series'?episode:item);
 const label=resume?'Resume':'Watch Now';
 const stub=episodeLabel?<span className="ticket-episode-label" title={`Season ${episode!.ParentIndexNumber} · Episode ${episode!.IndexNumber}`}>{`S${episode!.ParentIndexNumber}·E${episode!.IndexNumber}`}</span>:resume?<span className="ticket-resume-time"><span>{resume.elapsed}</span></span>:undefined;
 const accessible=[label,episodeLabel,resume?.elapsed].filter(Boolean).join(', ');
 return <span className="watch-action">{restart?<button className="button secondary" disabled={busy} aria-label="Restart From Beginning" title="Restart From Beginning" onClick={()=>void open()}><RotateCcw size={15}/>{busy?'Opening…':'Restart'}</button>:<TicketButton stub={stub} disabled={busy} aria-label={accessible} aria-busy={busy} onClick={()=>void open()}>{label}</TicketButton>}{error&&<span role="alert">{error}</span>}</span>;
}
