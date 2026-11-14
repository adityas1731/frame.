import {useState} from 'react';
import {Link} from 'react-router';
import {Check,Plus,Search,Tag,Trash2,X} from 'lucide-react';
import {SettingsSection} from './SettingsSection';
import {useTitleTags,tagKey} from '../state/TitleTags';
import {taggedIds} from '../state/tagSelection';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote,useDebounced} from '../jellyfin/hooks';
import {media} from '../data/media';
import type {ItemDto} from '../jellyfin/types';

const types='Movie,Series,Episode,Audio,MusicAlbum,MusicVideo';
export function TagsSettings(){
 const {tags,names,error}=useTitleTags();const [active,setActive]=useState('');
 const current=names.find(name=>tagKey(name)===tagKey(active));
 return <SettingsSection id="tags-heading" title="Tags" className="tags-settings"><p className="tags-intro">Select a tag to rename it or manage its titles.</p>
 {names.length?<><div className="tag-manager-tabs" aria-label="Your Tags">{names.map(name=><button key={name} type="button" aria-pressed={name===current} onClick={()=>setActive(name)}><Tag size={15}/><span>{name}</span><small>{taggedIds(tags,name).length}</small></button>)}</div>
 {current?<TagEditor key={current} name={current} names={names} renamed={setActive} removed={()=>setActive('')}/>:<p className="tag-manager-prompt">Select a tag above.</p>}</>:<p className="tag-manager-prompt">No custom tags yet. Add one from Manage Title on any movie or show.</p>}
 {error&&<p role="status">{error}</p>}<p className="tags-local-note">Tags are saved in this browser for this account. They do not change Jellyfin metadata.</p></SettingsSection>;
}
function TagEditor({name,names,renamed,removed}:{name:string;names:string[];renamed:(name:string)=>void;removed:()=>void}){
 const {tags,set,rename,remove}=useTitleTags();const {session,client}=useConnection();
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(name),[confirm,setConfirm]=useState(false),[adding,setAdding]=useState(false),[term,setTerm]=useState(''),[notice,setNotice]=useState('');
 const search=useDebounced(term);const ids=taggedIds(tags,name);
 const assigned=useRemote(`tag-manager:${JSON.stringify(ids)}`,async()=>{
  if(!session)return ids.flatMap(id=>{const item=media.find(m=>m.id===id);return item?[{Id:id,Name:item.title,Type:item.kind==='show'?'Series':'Movie'} as ItemDto]:[];});
  const rows:ItemDto[]=[];for(let i=0;i<ids.length;i+=40)rows.push(...(await client!.itemsById(session.user.Id,ids.slice(i,i+40),undefined,types)).Items);return rows;
 },false);
 const results=useRemote(`tag-manager-search:${adding}:${search}`,async()=>{
  if(!adding||!search.trim())return [] as ItemDto[];
  if(session)return (await client!.selectionItems(session.user.Id,search)).Items;
  return media.filter(item=>item.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).slice(0,20).map(item=>({Id:item.id,Name:item.title,Type:item.kind==='show'?'Series':'Movie'} as ItemDto));
 },false);
 const next=draft.trim().replace(/\s+/g,' ');const duplicate=names.some(value=>tagKey(value)!==tagKey(name)&&tagKey(value)===tagKey(next));
 function add(id:string){const existing=tags[id]??[];if(existing.length>=20){setNotice('This title already has 20 tags. Remove one before adding another.');return;}set(id,[...existing,name]);setNotice('');}
 return <div className="tag-manager-editor"><header><div><h3>{name}</h3><span>{ids.length} {ids.length===1?'title':'titles'}</span></div><div className="tag-manager-actions"><button type="button" onClick={()=>{setEditing(!editing);setDraft(name);}}>Rename</button><button type="button" className="tag-delete" aria-label={`Delete tag ${name}`} onClick={()=>setConfirm(!confirm)}><Trash2 size={16}/></button></div></header>
 {editing&&<form className="tag-rename-form" onSubmit={e=>{e.preventDefault();if(!next||next.length>40||duplicate)return;rename(name,next);setEditing(false);renamed(next);}}><label className="sr-only" htmlFor="tag-rename">Tag Name</label><input id="tag-rename" maxLength={40} value={draft} onChange={e=>setDraft(e.target.value)}/><button type="submit" disabled={!next||duplicate}>Save</button><button type="button" aria-label="Cancel rename" onClick={()=>setEditing(false)}><X size={16}/></button>{duplicate&&<p role="alert">A tag with this name already exists.</p>}</form>}
 {confirm&&<div className="tag-delete-confirm"><p>Remove <strong>{name}</strong> from all {ids.length} titles? Home sections filtered by this tag will be empty. No titles will be deleted.</p><button type="button" className="tag-delete" onClick={()=>{remove(name);removed();}}>Delete Tag</button><button type="button" onClick={()=>setConfirm(false)}>Cancel</button></div>}
 {assigned.loading&&<p role="status">Loading titles…</p>}{assigned.error&&<p role="alert">Titles could not load. <button type="button" onClick={assigned.retry}>Retry</button></p>}
 <ul className="tag-assigned-list">{ids.map(id=>{const item=assigned.data?.find(row=>row.Id===id);return <li key={id}><div>{item?<Link to={`/item/${encodeURIComponent(id)}`}>{item.Name||'Untitled'}</Link>:<span>{assigned.loading?'Loading…':'Title unavailable'}</span>}{item?.Type&&<small>{item.Type==='Series'?'TV Show':item.Type}</small>}</div><button type="button" aria-label={`Remove ${item?.Name||'title'} from ${name}`} onClick={()=>set(id,(tags[id]??[]).filter(value=>tagKey(value)!==tagKey(name)))}><X size={16}/></button></li>;})}</ul>
 <button type="button" className="tag-add-titles" aria-expanded={adding} onClick={()=>setAdding(!adding)}><Plus size={16}/>Add Titles</button>
 {adding&&<div className="tag-title-search"><label><Search size={16}/><input aria-label="Find titles to tag" placeholder="Search your library" value={term} onChange={e=>setTerm(e.target.value)}/></label>{search.trim()&&results.loading&&<p role="status">Searching…</p>}{results.error&&<p role="alert">Search could not load. <button type="button" onClick={results.retry}>Retry</button></p>}
 {search.trim()&&!results.loading&&!results.error&&!results.data?.length&&<p>No titles found.</p>}<ul>{results.data?.map(item=><li key={item.Id}><span>{item.Name}</span><button type="button" disabled={ids.includes(item.Id)||(tags[item.Id]?.length??0)>=20} aria-label={ids.includes(item.Id)?`${item.Name} already tagged`:`Add ${item.Name} to ${name}`} onClick={()=>add(item.Id)}>{ids.includes(item.Id)?<Check size={17}/>:<Plus size={17}/>}</button></li>)}</ul></div>}{notice&&<p role="status">{notice}</p>}</div>;
}

