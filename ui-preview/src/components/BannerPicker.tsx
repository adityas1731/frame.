import {artworkRefreshed,useArtworkRevision} from '../providers/artworkRefresh';
import {useEffect,useId,useState} from 'react';
import {ImagePlus,RectangleVertical,RectangleHorizontal,Upload,Check,ChevronDown,RefreshCw} from 'lucide-react';
import {useConnection} from '../jellyfin/useConnection';
import {useOnline} from '../providers/context';
import type {ItemDto} from '../jellyfin/types';
import {useCustomArtwork,useProviderArtworkChoice} from './useArtworkChoice';
import {prepareArtwork,prepareProviderArtwork,type ArtworkKind} from './customArtwork';
import {ServerArtwork} from './ServerArtwork';
import {DetailArtwork} from './DetailArtwork';
import {useRichItem} from '../providers/hooks';

export function ArtworkPicker({item,kind}:{item:ItemDto;kind:ArtworkKind}) {
  const {client,session}=useConnection();const {client:online}=useOnline();
  const choice=useProviderArtworkChoice(item,kind);const custom=useCustomArtwork(item,kind);
  const revision=useArtworkRevision(item.Id);
  const inputId=useId();const panelId=useId();const banner=kind==='banner';
  const admin=!!session?.user.Policy?.IsAdministrator;const [allUsers,setAllUsers]=useState(admin);
  useEffect(()=>setAllUsers(admin),[admin]);
  const [open,setOpen]=useState(false);const [images,setImages]=useState<{url:string;width?:number;height?:number;disabledReason?:string}[]>([]);
  const rich=useRichItem(item,undefined,open);
  const [status,setStatus]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!open||!client||!online)return;let active=true;setImages([]);setStatus('Loading Artwork…');
    Promise.resolve().then(()=>online.artworkOptions(item).then(values=>banner?values.backdrops:values.posters)).then(values=>{if(!active)return;setImages(values);setStatus(values.length?'':'No provider alternatives available. You can add your own image.');},()=>{if(active)setStatus('Provider artwork is unavailable. You can still add your own image.');});
    return()=>{active=false;};
  },[open,client,online,item.Id,JSON.stringify(item.ProviderIds),banner,revision]);
  async function upload(file?:File){
    if(!file)return;setBusy(true);setError('');try{const blob=await prepareArtwork(file,kind);if(allUsers){await client!.saveSharedArtwork(item,kind,blob);await custom.save();choice.set();window.dispatchEvent(new Event('frame:server-reload'));setStatus('Artwork saved for all users.');}else await custom.save(blob);}catch(e){setError(e instanceof Error?e.message:'This image could not be saved.');}finally{setBusy(false);}
  }
  async function select(url?:string){if(url&&(!images.some(image=>image.url===url)||images.find(image=>image.url===url)?.disabledReason))return;setBusy(true);setError('');try{if(url&&allUsers){const native=await (banner?client!.remoteBackdrops(item):client!.remotePosters(item));const source=native.some(image=>image.url===url)?url:await prepareProviderArtwork(url,kind);await client!.saveSharedArtwork(item,kind,source);await custom.save();choice.set();window.dispatchEvent(new Event('frame:server-reload'));setStatus('Artwork saved for all users.');}else{await custom.save();choice.set(url);}}catch(e){setError(e instanceof Error?e.message:'Artwork could not be updated.');}finally{setBusy(false);}}
  if(!['Movie','Series'].includes(item.Type??''))return null;
  const preview=custom.url??choice.url;
  const trigger=(<button className="artwork-editor-trigger" aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(!open)}>
      <span className="artwork-editor-icon">{banner?<RectangleHorizontal size={22}/>:<RectangleVertical size={22}/>}</span>
      <span><strong>{banner?'Banner Artwork':'Card Artwork'}</strong><small>{banner?'Used on this title’s banner':'Used on this title’s cards'}</small></span>
      <ChevronDown size={18}/>
    </button>);
  return <section className={`artwork-editor artwork-editor-${kind}`} aria-busy={busy}>
    {!open&&trigger}
    {open&&<div className="artwork-editor-body" id={panelId}>
      <div className="artwork-controls">{trigger}<div className="artwork-current">{preview?<img src={preview} alt={`Current ${kind} artwork`} referrerPolicy="no-referrer"/>:banner?<DetailArtwork item={item} online={rich.online}/>:<ServerArtwork item={item}/>}<span>{custom.url?'Your Image':choice.url?'Selected Artwork':'Automatic Artwork'}</span></div>
      <label className="artwork-scope"><input type="checkbox" checked={allUsers} disabled={!admin||busy} onChange={e=>setAllUsers(e.target.checked)}/>Apply for All Users</label><p className="artwork-local-note">{allUsers?'Saves this image to Jellyfin for everyone.':admin?'Only changes artwork on this device.':'Device-only artwork. Administrator access is needed to change it for everyone.'}</p>
      <div className="artwork-upload-row"><label className={`button secondary${busy?' is-disabled':''}`} htmlFor={inputId}><Upload size={16}/>{busy?'Saving…':'Add Your Image'}</label><input className="artwork-file-input" id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void upload(file);}}/>{(custom.url||choice.url)&&<button className="text-link" disabled={busy} onClick={()=>void select()}>Use Automatic Artwork</button>}</div>
      <p className="artwork-hint">JPG, PNG or WebP · Up to 10 MB · {banner?'Landscape 16:9 recommended':'Portrait 2:3 recommended'}</p>

      {error&&<p className="artwork-error" role="alert">{error}</p>}
      </div>{online?<div className="artwork-gallery"><h4><ImagePlus size={16}/> Provider Artwork</h4>{status&&<p role="status" className="muted">{status}</p>}<div className={`banner-options artwork-options-${kind}`}>{images.map((image,index)=><button key={image.url} disabled={busy||!!image.disabledReason} title={image.disabledReason} aria-label={`Use ${kind} artwork ${index+1}`} aria-pressed={!custom.url&&choice.url===image.url} onClick={()=>void select(image.url)}><img loading="lazy" src={image.url.replace('/original/','/w780/')} referrerPolicy="no-referrer" alt=""/><span className="artwork-dimensions">{image.width&&image.height?`${image.width} × ${image.height}`:'Provider image'}{image.disabledReason&&<small>Too large</small>}</span>{!custom.url&&choice.url===image.url&&<span className="artwork-selected"><Check size={14}/><span className="sr-only">Selected</span></span>}</button>)}</div></div>:<p className="muted">Online artwork is off. Custom images still work.</p>}
    </div>}
  </section>;
}

export function RefreshArtwork({item}:{item:ItemDto}){
  const {client}=useOnline();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const {client:server,session}=useConnection();
  const tmdb=Object.entries(item.ProviderIds??{}).find(([key])=>key.toLowerCase()==='tmdb')?.[1];
  if(!['Movie','Series'].includes(item.Type??''))return null;
  async function refresh(){
    if(!client||!server||!session||busy)return;setBusy(true);setMessage('');let reloaded=false;
    try{const fresh=await server.refreshItemArtwork(session.user.Id,item.Id);reloaded=true;const result=await client.refreshArtwork(fresh);setMessage(result.backdrops.length||result.posters.length?'Artwork reloaded. Selected and uploaded images are unchanged.':'Jellyfin artwork reloaded. No provider alternatives returned.');}
    catch{setMessage(reloaded?'Jellyfin artwork reloaded. Provider artwork is unavailable.':'Artwork could not be rechecked. Try again when the server is available.');}
    finally{if(reloaded){window.dispatchEvent(new Event('frame:server-reload'));artworkRefreshed(item.Id);}setBusy(false);}
  }
  return <div className="artwork-refresh"><button className="text-link" disabled={busy||!client||!server||!session} onClick={()=>void refresh()}><RefreshCw size={16}/>{busy?'Rechecking…':'Refresh Artwork'}</button>{!client?<p className="muted">Enable Online Metadata to recheck artwork.</p>:!tmdb?<p className="muted">Refresh checks Jellyfin for updated provider IDs.</p>:null}{message&&<p className="muted" role="status">{message}</p>}</div>;
}
