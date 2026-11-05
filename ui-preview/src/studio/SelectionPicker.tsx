import {useState} from 'react';
import {ArrowDown,ArrowUp,Plus,Trash2,Check} from 'lucide-react';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote,useDebounced} from '../jellyfin/hooks';
import {media} from '../data/media';
import type {ItemDto} from '../jellyfin/types';
import {Field} from '../components/SettingsSection';

export function SelectionPicker({selected,onChange}:{selected:string[];onChange:(ids:string[])=>void}){
 const {session,client}=useConnection();const [term,setTerm]=useState('');const search=useDebounced(term);const [page,setPage]=useState(0);
 const results=useRemote(`section-search:${search}:${page}`,async()=>{
  if(session)return client!.selectionItems(session.user.Id,search,page*20);
  const items=media.filter(item=>item.title.toLowerCase().includes(search.toLowerCase())).map(item=>({Id:item.id,Name:item.title,Type:item.kind==='movie'?'Movie':'Series',ProductionYear:item.year}));
  return {Items:items.slice(page*20,page*20+20),TotalRecordCount:items.length};
 });
 const picks=useRemote(`section-picks:${JSON.stringify(selected)}`,async()=>{
  const rows=await Promise.allSettled(selected.map(id=>session?client!.item(session.user.Id,id):Promise.resolve((()=>{const item=media.find(item=>item.id===id);return item?{Id:id,Name:item.title,Type:item.kind==='movie'?'Movie':'Series',ProductionYear:item.year}:undefined;})())));
  return rows.flatMap(row=>row.status==='fulfilled'&&row.value?[row.value]:[]);
 });
 function move(index:number,delta:number){const next=[...selected];const target=index+delta;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];onChange(next);}
 function caption(item:ItemDto){return [item.Type==='Series'?'TV Show':item.Type==='MusicAlbum'?'Album':item.Type==='MusicVideo'?'Music Video':item.Type,item.ProductionYear,item.SeriesName].filter(Boolean).join(' · ');}
 return <div className="selection-picker">
  <header><h4>Your Selection</h4><span>{selected.length} / 40</span></header>
  <p className="studio-footnote">Choose entries from your library. They appear in the order below, independently of Favorites.</p>
  {!selected.length?<p className="selection-empty">Your section is empty. Add your first title below.</p>:<ol className="selection-picks">{selected.map((id,index)=>{const item=picks.data?.find(item=>item.Id===id);return <li key={id}><span className="selection-order">{index+1}</span><div><strong>{item?.Name??(picks.loading?'Loading title…':'Unavailable title')}</strong>{item&&<small>{caption(item)}</small>}</div><button type="button" className="icon-button" disabled={!index} aria-label={`Move ${item?.Name??'title'} up`} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button type="button" className="icon-button" disabled={index===selected.length-1} aria-label={`Move ${item?.Name??'title'} down`} onClick={()=>move(index,1)}><ArrowDown size={16}/></button><button type="button" className="icon-button widget-delete" aria-label={`Remove ${item?.Name??'title'} from section`} onClick={()=>onChange(selected.filter(value=>value!==id))}><Trash2 size={16}/></button></li>;})}</ol>}
  {picks.error&&<p role="alert">Selected title details could not load. Your selection is kept.</p>}
  <Field label="Add Titles"><input type="search" placeholder="Search your library" value={term} onChange={event=>{setTerm(event.target.value);setPage(0);}}/></Field>
  {results.loading&&<p role="status">Finding titles…</p>}{results.error&&<p role="alert">{results.error} <button type="button" className="text-link" onClick={results.retry}>Retry</button></p>}
  <div className="selection-results">{!results.loading&&results.data?.Items.map(item=>{const added=selected.includes(item.Id);return <button type="button" key={item.Id} className="selection-result" aria-label={`${added?'Remove':'Add'} ${item.Name}`} aria-pressed={added} disabled={!added&&selected.length>=40} onClick={()=>onChange(added?selected.filter(id=>id!==item.Id):[...selected,item.Id])}><span><strong>{item.Name}</strong><small>{caption(item)}</small></span>{added?<Check size={18}/>:<Plus size={18}/>}</button>;})}</div>
  {!results.loading&&!results.error&&results.data?.TotalRecordCount===0&&<p className="studio-footnote">No matching titles.</p>}
  {(results.data?.TotalRecordCount??0)>20&&<div className="studio-actions"><button type="button" className="button secondary" disabled={!page||results.loading} onClick={()=>setPage(page-1)}>Previous</button><span>{page+1} / {Math.ceil((results.data?.TotalRecordCount??0)/20)}</span><button type="button" className="button secondary" disabled={results.loading||(page+1)*20>=(results.data?.TotalRecordCount??0)} onClick={()=>setPage(page+1)}>Next</button></div>}
 </div>;
}
