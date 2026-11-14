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
 const {tags,names:saved,set,error}=useTitleTags();const [draft,setDraft]=useState('');const selected=tags[id]??[];
 const key=(value:string)=>value.trim().replace(/\s+/g,' ').toLocaleLowerCase();
 const available=saved.filter(tag=>!selected.some(value=>key(value)===key(tag))&&(!draft.trim()||key(tag).includes(key(draft))));
 const canAdd=!!draft.trim()&&selected.length<20&&!selected.some(tag=>key(tag)===key(draft));
 function addTag(value:string){const name=value.trim().replace(/\s+/g,' ');if(!name||name.length>40||selected.length>=20||selected.some(tag=>key(tag)===key(name)))return;set(id,[...selected,saved.find(tag=>key(tag)===key(name))??name]);setDraft('');}
 return <section className="manage-title-section title-tags-editor"><h3>Custom Genres &amp; Tags</h3><p className="muted">Add a tag or choose an existing one.</p>
 <form className="title-tag-form" onSubmit={event=>{event.preventDefault();if(canAdd)addTag(draft);}}><label className="sr-only" htmlFor={`title-tag-${id}`}>New Tag</label><input id={`title-tag-${id}`} value={draft} maxLength={40} placeholder="Add A Tag" onChange={event=>setDraft(event.target.value)} disabled={selected.length>=20}/><button className="button secondary" disabled={!canAdd}>Add</button></form>
 {!!selected.length&&<div className="title-tags-assigned"><p>Added to this title</p><div className="title-tag-list title-tags-selected" aria-label="Tags On This Title">{selected.map(tag=><span key={tag}><span>{tag}</span><button type="button" aria-label={`Remove ${tag} from this title`} title="Remove from this title" onClick={()=>set(id,selected.filter(value=>value!==tag))}><X size={14}/></button></span>)}</div></div>}
 {!!available.length&&<div className="title-tags-saved"><p>Add an existing tag</p><div aria-label="Saved Tags">{available.map(tag=><button key={tag} type="button" disabled={selected.length>=20} onClick={()=>addTag(tag)}><span aria-hidden="true">+</span>{tag}</button>)}</div></div>}
 <small className="title-tags-storage">Saved in this browser for your account.</small>{error&&<p role="status">{error}</p>}</section>;
}
export function TitleTagLinks({id}:{id:string}){
 const {tags}=useTitleTags();return <nav className="title-tag-list" aria-label="Custom Tags">{(tags[id]??[]).map(tag=><Link key={tag} to={`/tags?name=${encodeURIComponent(tag)}`}>{tag}</Link>)}</nav>;
}
export function GenreMenu(){
 const {client,session}=useConnection();const {names:custom}=useTitleTags();const navigate=useNavigate();
 const data=useRemote('topbar-genres',()=>session?client!.genres(session.user.Id):Promise.resolve([...new Set(media.flatMap(item=>item.genres))]),false);
 const genres=displayGenres(data.data??[]);
 return <Select className="topbar-genres" aria-label="Browse Genres" value="" onValueChange={value=>{if(value==='all'){navigate('/library');return;}const [kind,...parts]=value.split(':');const name=parts.join(':');navigate(kind==='tag'?`/tags?name=${encodeURIComponent(name)}`:`/library?genre=${encodeURIComponent(name)}`);}}>
 <option value="all">All Genres</option>
 <option value="" disabled>{data.loading?'Loading Genres…':data.error?'Genres Unavailable':'Genres'}</option>
 {genres.map(genre=><option key={`genre:${genre}`} value={`genre:${genre}`}>{genre}</option>)}
 {custom.map(tag=><option key={`tag:${tag}`} value={`tag:${tag}`}>Tag · {tag}</option>)}
 {!genres.length&&!custom.length&&!data.loading&&!data.error&&<option disabled value="empty">No Genres Available</option>}
 </Select>;
}
