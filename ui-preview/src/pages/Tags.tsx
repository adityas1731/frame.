import {useSearchParams} from 'react-router';
import {useTitleTags} from '../state/TitleTags';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {LiveCard,RequestStatus} from './Live';
import {media} from '../data/media';
import {MediaCard} from '../components/MediaCard';
export function TagsPage(){
 const [params,setParams]=useSearchParams();const name=params.get('name')??'';
 const {tags}=useTitleTags();const {client,session}=useConnection();
 const ids=Object.keys(tags).filter(id=>tags[id].some(tag=>tag.toLocaleLowerCase()===name.toLocaleLowerCase()));
 const start=Math.max(0,Math.floor(Number(params.get('start'))||0));const page=ids.slice(start,start+40);
 const data=useRemote(`tag:${JSON.stringify(page)}`,()=>session&&page.length?client!.itemsById(session.user.Id,page,undefined,'Movie,Series,Episode,Audio,MusicAlbum,MusicVideo'):Promise.resolve({Items:[],TotalRecordCount:0}),false);
 return <div className="content-page"><header className="page-heading"><h1>{name||'Custom Tags'}</h1><p>Titles You Tagged</p></header>{session&&<RequestStatus {...data}/>}
 <div className="media-grid">{session?data.data?.Items.map(item=><LiveCard key={item.Id} item={item}/>):page.flatMap(id=>{const item=media.find(value=>value.id===id);return item?[<MediaCard key={id} item={item}/>]:[];})}</div>
 {!ids.length&&<p className="request-status">No titles have this tag yet.</p>}
 {ids.length>40&&<nav className="pagination" aria-label="Tagged Titles Pages"><button className="button secondary" disabled={!start} onClick={()=>setParams({name,start:String(Math.max(0,start-40))})}>Previous</button><span>Page {Math.floor(start/40)+1}</span><button className="button secondary" disabled={start+40>=ids.length} onClick={()=>setParams({name,start:String(start+40)})}>Next</button></nav>}</div>;
}
