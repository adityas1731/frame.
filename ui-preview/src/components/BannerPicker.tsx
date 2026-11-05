import {useEffect,useId,useState} from 'react';
import {ImagePlus,RectangleVertical,RectangleHorizontal,Upload,Check,ChevronDown} from 'lucide-react';
import {useConnection} from '../jellyfin/useConnection';
import {useOnline} from '../providers/context';
import type {ItemDto} from '../jellyfin/types';
import {useCustomArtwork,useProviderArtworkChoice} from './useArtworkChoice';
import {prepareArtwork,type ArtworkKind} from './customArtwork';
import {ServerArtwork} from './ServerArtwork';

export function ArtworkPicker({item,kind}:{item:ItemDto;kind:ArtworkKind}) {
  const {client}=useConnection();const {client:online}=useOnline();
  const choice=useProviderArtworkChoice(item,kind);const custom=useCustomArtwork(item,kind);
  const inputId=useId();const panelId=useId();const banner=kind==='banner';
  const [open,setOpen]=useState(false);const [images,setImages]=useState<Awaited<ReturnType<NonNullable<typeof client>['remoteBackdrops']>>>([]);
  const [status,setStatus]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!open||!client||!online)return;let active=true;setImages([]);setStatus('Loading Artwork…');
    Promise.resolve().then(()=>banner?client.remoteBackdrops(item):client.remotePosters(item)).then(values=>{if(!active)return;setImages(values);setStatus(values.length?'':'No provider alternatives available. You can add your own image.');},()=>{if(active)setStatus('Provider artwork is unavailable. You can still add your own image.');});
    return()=>{active=false;};
  },[open,client,online,item.Id,JSON.stringify(item.ProviderIds),banner]);
  async function upload(file?:File){
    if(!file)return;setBusy(true);setError('');try{const blob=await prepareArtwork(file,kind);await custom.save(blob);}catch(e){setError(e instanceof Error?e.message:'This image could not be saved.');}finally{setBusy(false);}
  }
  async function select(url?:string){setBusy(true);setError('');try{await custom.save();choice.set(url);}catch(e){setError(e instanceof Error?e.message:'Artwork could not be updated.');}finally{setBusy(false);}}
  if(!['Movie','Series'].includes(item.Type??''))return null;
  const preview=custom.url??choice.url;
  return <section className={`artwork-editor artwork-editor-${kind}`}>
    <button className="artwork-editor-trigger" aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(!open)}>
      <span className="artwork-editor-icon">{banner?<RectangleHorizontal size={22}/>:<RectangleVertical size={22}/>}</span>
      <span><strong>{banner?'Banner Artwork':'Card Artwork'}</strong><small>{banner?'The backdrop behind this title':'The poster used throughout your library'}</small></span>
      <ChevronDown size={18}/>
    </button>
    {open&&<div className="artwork-editor-body" id={panelId}>
      <div className="artwork-current">{preview?<img src={preview} alt={`Current ${kind} artwork`} referrerPolicy="no-referrer"/>:<ServerArtwork item={item} backdrop={banner}/>}<span>{custom.url?'Your Image':choice.url?'Selected Artwork':'Automatic Artwork'}</span></div>
      <div className="artwork-upload-row"><label className={`button secondary${busy?' is-disabled':''}`} htmlFor={inputId}><Upload size={16}/>{busy?'Saving…':'Add Your Image'}</label><input className="artwork-file-input" id={inputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void upload(file);}}/>{(custom.url||choice.url)&&<button className="text-link" disabled={busy} onClick={()=>void select()}>Use Automatic Artwork</button>}</div>
      <p className="artwork-hint">JPG, PNG or WebP · Up to 10 MB · {banner?'Landscape 16:9 recommended':'Portrait 2:3 recommended'}</p>
      <p className="artwork-local-note">Saved on this device. Your Jellyfin artwork stays unchanged.</p>
      {error&&<p className="artwork-error" role="alert">{error}</p>}
      {online?<><h4><ImagePlus size={16}/> Provider Artwork</h4>{status&&<p role="status" className="muted">{status}</p>}<div className={`banner-options artwork-options-${kind}`}>{images.map((image,index)=><button key={image.url} disabled={busy} aria-label={`Use ${kind} artwork ${index+1}`} aria-pressed={!custom.url&&choice.url===image.url} onClick={()=>void select(image.url)}><img loading="lazy" src={image.url.replace('/original/','/w780/')} referrerPolicy="no-referrer" alt=""/><span>{image.width} × {image.height}{!custom.url&&choice.url===image.url&&<Check size={14}/>}</span></button>)}</div></>:<p className="muted">Online artwork is off. Custom images still work.</p>}
    </div>}
  </section>;
}
