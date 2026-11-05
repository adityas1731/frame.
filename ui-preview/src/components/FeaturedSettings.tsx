import {SettingsSection,Field} from './SettingsSection';
import {useState} from 'react';
import {useFeaturedSettings} from '../state/featured';
import {defaultFeatured,type FeaturedPage} from '../state/featuredModel';
import {useConnection} from '../jellyfin/useConnection';
import {useDebounced,useRemote} from '../jellyfin/hooks';
import {media} from '../data/media';
import {SettingsSelect as Select} from './Select';
import {Toggle} from './Primitives';
export function FeaturedSettings(){
 const {client,session}=useConnection();const {rules,update}=useFeaturedSettings();const [page,setPage]=useState<FeaturedPage>('discover');const [query,setQuery]=useState('');const term=useDebounced(query);const [start,setStart]=useState(0);const rule=rules[page];
 const data=useRemote(`banner-editor:${session?.server.Id}:${session?.user.Id}:${page}:${term}:${start}`,()=>client&&session?client.items(session.user.Id,{kind:page==='movies'?'Movie':page==='shows'?'Series':undefined,search:term,start,limit:40,sort:'SortName'}):Promise.resolve({Items:[],TotalRecordCount:0}),false);
 const mock=media.filter(item=>(page==='discover'||item.kind===(page==='movies'?'movie':'show'))&&item.title.toLowerCase().includes(term.toLowerCase()));
 const items=session?(data.data?.Items??[]).filter(item=>['Movie','Series'].includes(item.Type??'')).map(item=>({id:item.Id,title:item.Name??'Untitled',kind:item.Type==='Movie'?'Movie':'TV show'})):mock.map(item=>({id:item.id,title:item.title,kind:item.kind==='movie'?'Movie':'TV show'}));
 const changeList=(list:'selected'|'hidden',id:string)=>update(page,{...rule,[list]:rule[list].includes(id)?rule[list].filter(value=>value!==id):[...rule[list],id]});
 return <SettingsSection id="featured-settings-heading" title="Featured Banners" aside={<button className="text-link" onClick={()=>update(page,defaultFeatured())}>Reset This Banner</button>}><div className="studio-panel featured-settings">
 <div className="studio-fields"><Field label="Banner Page"><Select aria-label="Banner page" value={page} onValueChange={value=>{setPage(value as FeaturedPage);setStart(0);setQuery('');}}><option value="discover">Discover</option><option value="movies">Movies</option><option value="shows">TV Shows</option></Select></Field><Field label={`Banner Titles (${rule.count})`} hint="Up to 20 titles. Fewer appear when your selection or library has fewer available."><input aria-label="Banner Title Count" type="range" min={2} max={20} value={rule.count} onChange={event=>update(page,{...rule,count:Number(event.target.value)})}/><span className="banner-count-ticks"><span>2</span><span>20</span></span></Field></div>
 <div className="studio-toggle-row"><div><strong>Shuffle Banners</strong><p>A fresh random order each time you open this page.</p></div><Toggle label="Shuffle banners" checked={rule.shuffle} onChange={shuffle=>update(page,{...rule,shuffle})}/></div>
 <div className="studio-toggle-row"><div><strong>Choose Featured Titles</strong><p>{rule.custom?`${rule.selected.length} selected · ${rule.hidden.length} hidden`:'Use a sample from your library, excluding hidden titles.'}</p></div><Toggle label="Choose featured titles" checked={rule.custom} onChange={custom=>update(page,{...rule,custom})}/></div>
 <input className="banner-title-search" aria-label="Search banner titles" placeholder="Find a movie or show…" value={query} onChange={e=>{setQuery(e.target.value);setStart(0);}}/>
 {session&&data.loading&&<p role="status">Loading titles…</p>}{data.error&&<p role="alert">{data.error}<button className="text-link" onClick={data.retry}>Try again</button></p>}
 <div className="banner-title-list">{items.map(item=><div className="banner-title-row" key={item.id}><span><strong>{item.title}</strong><small>{item.kind}</small></span><div>{rule.custom&&<label><input type="checkbox" aria-label={`Feature ${item.title}`} checked={rule.selected.includes(item.id)} disabled={rule.hidden.includes(item.id)} onChange={()=>changeList('selected',item.id)}/>Feature</label>}<label><input type="checkbox" aria-label={`Hide ${item.title} from banners`} checked={rule.hidden.includes(item.id)} onChange={()=>changeList('hidden',item.id)}/>Hide</label></div></div>)}</div>
 {!items.length&&!data.loading&&<p>No matching titles.</p>}{rule.custom&&!rule.selected.length&&<p>Choose titles above to show this banner.</p>}
 {session&&!!data.data&&data.data.TotalRecordCount>40&&<div className="studio-actions"><button className="button secondary" disabled={!start||data.loading} onClick={()=>setStart(n=>Math.max(0,n-40))}>Previous</button><span>{start+1}–{start+data.data.Items.length} of {data.data.TotalRecordCount}</span><button className="button secondary" disabled={start+data.data.Items.length>=data.data.TotalRecordCount||data.loading} onClick={()=>setStart(n=>n+40)}>Next</button></div>}
 </div></SettingsSection>;
}
