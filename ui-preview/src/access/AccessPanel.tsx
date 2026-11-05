import {useRef,useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {Copy,Check} from 'lucide-react';
import {Modal} from '../components/Primitives';
import {useConnection} from '../jellyfin/useConnection';
import {frameAddress,suggestedFrameUrl,loopbackHost} from './url';
export function AccessPanel({close}:{close:()=>void}){
 const opener=useRef(document.activeElement as HTMLElement|null);
 function finish(){close();requestAnimationFrame(()=>{if(opener.current?.isConnected)opener.current.focus();});}
 const {session}=useConnection();const suggestion=suggestedFrameUrl(window.location.href,session?.baseUrl);const local=loopbackHost(window.location.hostname);
 const [input,setInput]=useState(suggestion.url);const [selected,setSelected]=useState('');const [error,setError]=useState('');const [copied,setCopied]=useState(false);const field=useRef<HTMLInputElement>(null);
 const [platform,setPlatform]=useState<'Windows'|'macOS'|'Linux'>('Windows');
 const addressSteps={Windows:'Settings → Network & Internet → Wi-Fi or Ethernet → Properties → IPv4 Address.',macOS:'System Settings → Network → Wi-Fi or Ethernet → Details → TCP/IP → IP Address.',Linux:'Network Settings → Active Connection → Details → IPv4 Address.'};
 async function copy(){if(!selected)return;try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(selected);setCopied(true);}catch{field.current?.focus();field.current?.select();setError('Copy is unavailable here. Select and copy the address below.');}}
 return <Modal title="Open frame. On Another Device" className="frame-access-modal" onClose={finish}><div className="frame-access">
 <p className="frame-access-intro">{suggestion.note}</p>
 <form onSubmit={event=>{event.preventDefault();const result=frameAddress(input,window.location.href);setError(result.error??'');setSelected(result.url??'');setCopied(false);if(result.url)setInput(result.url);}}>
 <label><span className="frame-address-heading">Server Address</span><input ref={field} type="text" inputMode="url" autoComplete="off" spellCheck={false} aria-label="frame. address to share" value={input} onChange={e=>{setInput(e.target.value);setSelected('');setError('');setCopied(false);}}/></label>
 <button type="submit" className="button secondary">{selected?'Update QR':'Create QR'}</button></form>
 {error&&<p className="frame-access-status" role="status">{error}</p>}
 {local&&!selected&&<details className="frame-address-help"><summary>Find Your Server’s Address</summary><p>On the device running Jellyfin, choose its operating system.</p><div className="address-platforms" role="group" aria-label="Server operating system">{(['Windows','macOS','Linux'] as const).map(name=><button key={name} type="button" aria-pressed={platform===name} onClick={()=>setPlatform(name)}>{name}</button>)}</div><p className="address-platform-steps" aria-live="polite">{addressSteps[platform]}</p><p>Paste the address above. frame. adds the server port and page path.</p></details>}
 {selected&&<><div className="frame-access-code"><QRCodeSVG value={selected} size={224} level="M" marginSize={4} bgColor="#ffffff" fgColor="#101114" title="Scan to open frame."/></div><button className="button secondary" onClick={()=>void copy()}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'Copied':'Copy Address'}</button></>}
 </div></Modal>;
}
