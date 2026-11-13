import {SettingsSection,Field} from './SettingsSection';
import {useEffect,useRef,useState} from 'react';
import {useFeaturedSettings} from '../state/featured';
import {defaultFeatured,type FeaturedPage} from '../state/featuredModel';
import {useConnection} from '../jellyfin/useConnection';
import {useDebounced,useRemote} from '../jellyfin/hooks';
import {media} from '../data/media';
import {Toggle} from './Primitives';
import {ServerArtwork} from './ServerArtwork';
import {Artwork} from './Artwork';
import {Home,Film,Tv,Star,EyeOff} from 'lucide-react';
export function FeaturedSettings(){
 const {client,session}=useConnection();const {rules,update}=useFeaturedSettings();const [page,setPage]=useState<FeaturedPage>('discover');const [query,setQuery]=useState('');const term=useDebounced(query);const [start,setStart]=useState(0);const rule=rules[page];
 const data=useRemote(`banner-editor:${session?.server.Id}:${session?.user.Id}:${page}:${term}:${start}`,()=>client&&session?client.items(session.user.Id,{kind:page==='movies'?'Movie':page==='shows'?'Series':undefined,search:term,start,limit:40,sort:'SortName'}):Promise.resolve({Items:[],TotalRecordCount:0}),false);
 const mock=media.filter(item=>(page==='discover'||item.kind===(page==='movies'?'movie':'show'))&&item.title.toLowerCase().includes(term.toLowerCase()));
 const items=session?(data.data?.Items??[]).filter(item=>['Movie','Series'].includes(item.Type??'')).map(item=>({id:item.Id,title:item.Name??'Untitled',kind:item.Type==='Movie'?'Movie':'TV Show',art:<ServerArtwork item={item}/>})):mock.map(item=>({id:item.id,title:item.title,kind:item.kind==='movie'?'Movie':'TV Show',art:<Artwork item={item}/>}));
 const selectAll=useRef<HTMLInputElement>(null);
 const selectedCount=items.filter(item=>rule.custom&&rule.selected.includes(item.id)&&!rule.hidden.includes(item.id)).length;
 const allSelected=items.length>0&&selectedCount===items.length;
 useEffect(()=>{if(selectAll.current)selectAll.current.indeterminate=rule.custom&&selectedCount>0&&!allSelected;},[selectedCount,allSelected,rule.custom]);
 function selectVisible(checked:boolean){
  if(!rule.custom)return;
  const ids=new Set(items.map(item=>item.id));
  update(page,{...rule,custom:true,selected:checked?[...new Set([...rule.selected,...ids])]:rule.selected.filter(id=>!ids.has(id)),hidden:checked?rule.hidden.filter(id=>!ids.has(id)):rule.hidden});
 }
 const changeList=(list:'selected'|'hidden',id:string)=>{
  if(list==='selected'&&!rule.custom)return;
  const removing=rule[list].includes(id),other=list==='selected'?'hidden':'selected';
  update(page,{...rule,...(list==='selected'&&!removing?{custom:true}:{}),[list]:removing?rule[list].filter(value=>value!==id):[...rule[list],id],[other]:rule[other].filter(value=>value!==id)});
 };
 return <SettingsSection id="featured-settings-heading" title="Featured Banners" aside={<button className="text-link" onClick={()=>update(page,defaultFeatured())}>Reset This Banner</button>}><div className="studio-panel featured-settings">
 <div className="featured-page-grid" role="group" aria-label="Banner Page">{([{id:'discover',label:'frame.',detail:'Home',Icon:Home},{id:'movies',label:'Movies',detail:'Movie Banners',Icon:Film},{id:'shows',label:'TV Shows',detail:'Series Banners',Icon:Tv}] as const).map(({id,label,detail,Icon})=><button key={id} aria-pressed={page===id} onClick={()=>{setPage(id);setStart(0);setQuery('');}}><Icon size={22}/><span><strong>{label}</strong><small>{detail}</small></span><span className="featured-page-count">{rules[id].custom?`${rules[id].selected.length} Featured`:'Library Mix'}</span></button>)}</div>
 <div className="featured-count-control"><Field label={`Banner Titles (${rule.count})`} hint="Choose 2 to 20 titles. The banner uses as many as are available."><input aria-label="Banner Title Count" type="range" min={2} max={20} value={rule.count} onChange={event=>update(page,{...rule,count:Number(event.target.value)})}/><span className="banner-count-ticks"><span>2</span><span>20</span></span></Field></div>
 <div className="studio-toggle-row"><div><strong>Shuffle Banners</strong><p>A fresh random order each time you open this page.</p></div><Toggle label="Shuffle banners" checked={rule.shuffle} onChange={shuffle=>update(page,{...rule,shuffle})}/></div>
 <div className="studio-toggle-row"><div><strong>Choose Featured Titles</strong><p>{rule.custom?`${rule.selected.length} selected · ${rule.hidden.length} hidden`:'All non-hidden titles are eligible. Turn this on to pick your own.'}</p></div><Toggle label="Choose featured titles" checked={rule.custom} onChange={custom=>update(page,{...rule,custom})}/></div>
 <div className="featured-grid-toolbar"><input className="banner-title-search" aria-label="Search banner titles" placeholder="Find a movie or show…" value={query} onChange={e=>{setQuery(e.target.value);setStart(0);}}/><label className="featured-select-all"><input ref={selectAll} type="checkbox" checked={!rule.custom||allSelected} disabled={!rule.custom||!items.length||!!session&&data.loading} onChange={e=>selectVisible(e.target.checked)}/>{session&&(data.data?.TotalRecordCount??0)>40?'Feature All On This Page':'Feature All'}</label></div>
 {session&&data.loading&&<p role="status">Loading titles…</p>}{data.error&&<p role="alert">{data.error}<button className="text-link" onClick={data.retry}>Try again</button></p>}
 <div className="featured-title-grid">{items.map(item=><article className="featured-title-card" data-hidden={rule.hidden.includes(item.id)} key={item.id}><div className="featured-title-art">{item.art}</div><div className="featured-title-copy"><strong>{item.title}</strong><small>{item.kind}</small></div><div className="featured-title-actions"><button aria-label={`Feature ${item.title}`} disabled={!rule.custom} aria-pressed={rule.custom&&rule.selected.includes(item.id)} onClick={()=>changeList('selected',item.id)}><Star size={15} fill={rule.custom&&rule.selected.includes(item.id)?'currentColor':'none'}/>Feature</button><button aria-label={`Hide ${item.title} from banners`} aria-pressed={rule.hidden.includes(item.id)} onClick={()=>changeList('hidden',item.id)}><EyeOff size={15}/>Hide</button></div></article>)}</div>
 {!items.length&&!data.loading&&<p>No matching titles.</p>}{rule.custom&&!rule.selected.length&&<p>Choose titles above to show this banner.</p>}
 {session&&!!data.data&&data.data.TotalRecordCount>40&&<div className="studio-actions"><button className="button secondary" disabled={!start||data.loading} onClick={()=>setStart(n=>Math.max(0,n-40))}>Previous</button><span>{start+1}–{start+data.data.Items.length} of {data.data.TotalRecordCount}</span><button className="button secondary" disabled={start+data.data.Items.length>=data.data.TotalRecordCount||data.loading} onClick={()=>setStart(n=>n+40)}>Next</button></div>}
 </div></SettingsSection>;
}
