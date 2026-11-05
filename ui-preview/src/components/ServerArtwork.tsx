import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useConnection } from '../jellyfin/useConnection';
import { imageSource } from '../jellyfin/presentation';
import type { ItemDto } from '../jellyfin/types';
import {useCustomArtwork,useProviderArtworkChoice} from './useArtworkChoice';
import {serverArtworkWidth} from './episodeArtworkPolicy';
export function ServerArtwork({ item, backdrop = false, artwork, fit = 'cover', focal = 22, onQuality, allowInherited=true }: { item: ItemDto; backdrop?: boolean; artwork?: 'Logo' | 'Thumb' | 'Banner'; fit?: 'cover' | 'contain'; focal?: number; onQuality?: (width:number)=>void;allowInherited?:boolean }) {
  const { client } = useConnection();
  const isCard=!backdrop&&!artwork&&['Movie','Series'].includes(item.Type??'');
  const custom=useCustomArtwork(item,'card',isCard);const chosen=useProviderArtworkChoice(item,'card',isCard);
  const [failedChoice,setFailedChoice]=useState('');
  const override=[custom.url,chosen.url].find(url=>url&&url!==failedChoice);
  const candidate = imageSource(item, backdrop, artwork);const source=allowInherited||!candidate?.inherited?candidate:null;
  const key = source ? `${source.id}:${source.type}:${source.tag}:${backdrop}` : '';
  const host = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  const [error, setError] = useState('');
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    let active = true; let url: string | undefined;
    setImage(null); setError(''); setPortrait(false);
    if (!client || !source || override) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      observer.disconnect();
      client.image(source.id, source.type, source.tag, serverArtworkWidth(item,backdrop,artwork,host.current?.clientWidth??1920,window.devicePixelRatio)).then(blob => {
        if (!active) return;
        url = URL.createObjectURL(blob); setImage({ key, url });
      }, () => { if (active) { setError('Artwork unavailable'); onQuality?.(0); } });
    }, { rootMargin: '150px' });
    if (host.current) observer.observe(host.current);
    return () => { active = false; observer.disconnect(); if (url) URL.revokeObjectURL(url); };
  }, [client, key, backdrop, onQuality,override]);
  return <div className={`server-artwork ${backdrop ? 'server-backdrop' : ''} ${artwork === 'Logo' ? 'server-logo' : ''}`} data-inherited={source?.inherited || undefined} style={{ '--art-y': `${Math.max(0, Math.min(100, focal))}%` } as CSSProperties} ref={host}>
    {override?<img src={override} alt="" referrerPolicy="no-referrer" data-artwork-source={override===custom.url?'custom':'provider'} style={{objectFit:fit,objectPosition:'center'}} onError={()=>setFailedChoice(override)}/>:image?.key === key ? <img src={image.url} alt="" onLoad={e => { const isPortrait=(backdrop || artwork === 'Thumb' || item.Type === 'Episode') && e.currentTarget.naturalWidth / e.currentTarget.naturalHeight < 1.3; setPortrait(isPortrait); onQuality?.(isPortrait ? 0 : e.currentTarget.naturalWidth); }} style={{ objectFit: portrait ? 'contain' : fit, objectPosition: portrait ? 'center' : `70% ${focal}%` }} onError={() => { setImage(null); setError('Artwork unavailable'); onQuality?.(0); }}/>
      : <div className="server-artwork-fallback" aria-label={error || (!source ? 'No artwork provided' : 'Loading artwork')}><ImageOff size={30}/></div>}
  </div>;
}



