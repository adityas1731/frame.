import {useCollectionLayout} from '../state/collectionLayout';
import {CollectionLayoutButton,collectionGridClass} from '../components/CollectionLayout';
import {useSearchParams} from 'react-router';
import {useTitleTags} from '../state/TitleTags';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {LiveCard,RequestStatus} from './Live';
import {media} from '../data/media';
import {MediaCard} from '../components/MediaCard';
export function TagsPage(){
 const [params,setParams]=useSearchParams();const name=params.get('name')??'';
 const layout=useCollectionLayout('tags');const size=layout.value.pageSize;
 const {tags}=useTitleTags();const {client,session}=useConnection();
 const ids=Object.keys(tags).filter(id=>tags[id].some(tag=>tag.toLocaleLowerCase()===name.toLocaleLowerCase()));
 const start=Math.max(0,Math.floor(Number(params.get('start'))||0));const page=ids.slice(start,start+size);
 const data=useRemote(`tag:${JSON.stringify(page)}`,()=>session&&page.length?client!.itemsById(session.user.Id,page,undefined,'Movie,Series,Episode,Audio,MusicAlbum,MusicVideo'):Promise.resolve({Items:[],TotalRecordCount:0}),false);
 return <div className="content-page"><header className="page-heading collection-page-heading"><h1>{name||'Custom Tags'}</h1><CollectionLayoutButton layout={layout} onPageSizeChange={()=>setParams({name})}/></header>{session&&<RequestStatus {...data}/>}
 <div className={collectionGridClass(layout.value)} style={layout.style}>{session?data.data?.Items.map(item=><LiveCard key={item.Id} item={item} showTitles={layout.value.titles} showRatings={layout.value.ratings}/>):page.flatMap(id=>{const item=media.find(value=>value.id===id);return item?[<MediaCard key={id} item={item} showTitles={layout.value.titles} showRatings={layout.value.ratings}/>]:[];})}</div>
 {!ids.length&&<p className="request-status">No titles have this tag yet.</p>}
 {ids.length>size&&<nav className="pagination" aria-label="Tagged Titles Pages"><button className="button secondary" disabled={!start} onClick={()=>setParams({name,start:String(Math.max(0,start-size))})}>Previous</button><span>Page {Math.floor(start/size)+1}</span><button className="button secondary" disabled={start+size>=ids.length} onClick={()=>setParams({name,start:String(start+size)})}>Next</button></nav>}</div>;
}
