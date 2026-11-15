import {Link} from 'react-router';import {useConnection} from '../jellyfin/useConnection';import {useRemote} from '../jellyfin/hooks';import {widgetQuery,type Widget} from '../studio/model';import {RequestStatus} from '../pages/LiveShared';import {MusicTrackCard} from './MusicTrackCard';
export function MusicWidget({widget}:{widget:Widget}){
 const {client,session}=useConnection();const data=useRemote(`music-widget:${session?.server.Id}:${session?.user.Id}:${JSON.stringify(widget)}`,async()=>{
  if(!client||!session)return [];
  if(widget.source==='selection'){const page=await client.itemsById(session.user.Id,widget.selection,widget.library||undefined,'Audio');return widget.selection.flatMap(id=>page.Items.find(item=>item.Id===id)?[page.Items.find(item=>item.Id===id)!]:[]);}
  return (await client.items(session.user.Id,{...widgetQuery(widget),kind:'Audio'})).Items;
 },false);
 return <section className="media-section music-home-section" data-widget-id={widget.id}><header className="section-heading"><h2>{widget.title}</h2><Link className="text-link" to={`/music${widget.library?'?library='+encodeURIComponent(widget.library):''}`}>View library</Link></header><RequestStatus {...data}/><div className={`music-widget-items ${widget.layout==='grid'?'music-grid':'music-widget-row'}`} style={{gap:widget.spacing}}>{data.data?.map(item=><MusicTrackCard key={item.Id} item={item}/>)}</div>{!data.loading&&!data.error&&!data.data?.length&&<p className="muted">No audio tracks returned.</p>}</section>;
}
