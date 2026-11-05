import {useState} from 'react';
import {Link,useNavigate} from 'react-router';
import {X} from 'lucide-react';
import {useTitleTags} from '../state/TitleTags';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {media} from '../data/media';
import {displayGenres} from '../providers/genres';
import {Select} from './Select';

export function TitleTagsEditor({id}:{id:string}){
 const {tags,set,error}=useTitleTags();const [draft,setDraft]=useState('');const selected=tags[id]??[];
 return <section className="manage-title-section"><h3>Custom Genres &amp; Tags</h3><p className="muted">Your own labels, saved in this browser for this account.</p>
 <form className="title-tag-form" onSubmit={event=>{event.preventDefault();if(!draft.trim())return;set(id,[...selected,draft]);setDraft('');}}><label className="sr-only" htmlFor={`title-tag-${id}`}>New Tag</label><input id={`title-tag-${id}`} value={draft} maxLength={40} placeholder="Add A Tag" onChange={event=>setDraft(event.target.value)} disabled={selected.length>=20}/><button className="button secondary" disabled={!draft.trim()||selected.length>=20}>Add</button></form>
 <div className="title-tag-list">{selected.map(tag=><span key={tag}><Link to={`/tags?name=${encodeURIComponent(tag)}`}>{tag}</Link><button type="button" aria-label={`Remove ${tag}`} onClick={()=>set(id,selected.filter(value=>value!==tag))}><X size={14}/></button></span>)}</div>{error&&<p role="status">{error}</p>}</section>;
}
export function TitleTagLinks({id}:{id:string}){
 const {tags}=useTitleTags();return <nav className="title-tag-list" aria-label="Custom Tags">{(tags[id]??[]).map(tag=><Link key={tag} to={`/tags?name=${encodeURIComponent(tag)}`}>{tag}</Link>)}</nav>;
}
export function GenreMenu(){
 const {client,session}=useConnection();const {tags}=useTitleTags();const navigate=useNavigate();
 const data=useRemote('topbar-genres',()=>session?client!.genres(session.user.Id):Promise.resolve([...new Set(media.flatMap(item=>item.genres))]),false);
 const genres=displayGenres(data.data??[]);
 const custom=[...new Set(Object.values(tags).flat())].sort((a,b)=>a.localeCompare(b));
 return <Select className="topbar-genres" aria-label="Browse Genres" value="" onValueChange={value=>{if(value==='all'){navigate('/library');return;}const [kind,...parts]=value.split(':');const name=parts.join(':');navigate(kind==='tag'?`/tags?name=${encodeURIComponent(name)}`:`/library?genre=${encodeURIComponent(name)}`);}}>
 <option value="all">All Genres</option>
 <option value="" disabled>{data.loading?'Loading Genres…':data.error?'Genres Unavailable':'Genres'}</option>
 {genres.map(genre=><option key={`genre:${genre}`} value={`genre:${genre}`}>{genre}</option>)}
 {custom.map(tag=><option key={`tag:${tag}`} value={`tag:${tag}`}>Tag · {tag}</option>)}
 {!genres.length&&!custom.length&&!data.loading&&!data.error&&<option disabled value="empty">No Genres Available</option>}
 </Select>;
}
