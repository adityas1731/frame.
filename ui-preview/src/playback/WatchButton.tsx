import {useState} from 'react';
import {useNavigate} from 'react-router';
import {Play,RotateCcw} from 'lucide-react';
import type {ItemDto} from '../jellyfin/types';
import {useConnection,errorMessage} from '../jellyfin/useConnection';
/** Series resolution happens only after an explicit Watch gesture. Jellyfin supplies episode order. */
export function WatchButton({item,restart=false}:{item:ItemDto;restart?:boolean}) {
 const {client,session}=useConnection();const navigate=useNavigate();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function open(){
  if(!client||!session||busy)return;setBusy(true);setError('');
  try{
   let target=item;
   if(item.Type==='Series'){
    const next=await client.nextUp(session.user.Id,1,undefined,item.Id);target=next.Items[0];
    if(!target){const seasons=await client.seasons(session.user.Id,item.Id);const season=seasons.Items.find(s=>s.IndexNumber===1)??seasons.Items[0];if(season)target=(await client.episodes(session.user.Id,item.Id,season.Id)).Items[0];}
   }
   if(!target)throw Error('empty');
   navigate(`/play/${encodeURIComponent(target.Id)}${restart?'?restart=1':''}`);
  }catch(e){setError(e instanceof Error&&e.message==='empty'?'No accessible episode is available.':errorMessage(e));setBusy(false);}
 }
 return <span className="watch-action"><button className={`button ${restart?'secondary':'hero-primary'}`} disabled={busy} aria-label={restart?'Restart From Beginning':undefined} title={restart?'Restart From Beginning':undefined} onClick={()=>void open()}>{restart?<RotateCcw size={15}/>:<Play size={18}/>} {busy?'Finding episode…':restart?'Restart':(item.UserData?.PlaybackPositionTicks??0)>0?'Resume':'Watch now'}</button>{error&&<span role="alert">{error}</span>}</span>;
}
