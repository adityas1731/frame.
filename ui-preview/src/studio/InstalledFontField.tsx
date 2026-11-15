import {useEffect,useState} from 'react';
import {Field} from '../components/SettingsSection';
import {installedFontAvailable,validFontName} from '../appearance/fonts';
import {readSavedFonts,saveFontName} from '../appearance/savedFonts';
export function InstalledFontField({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [status,setStatus]=useState('');
 const [saved,setSaved]=useState(readSavedFonts);const [storageError,setStorageError]=useState('');
 useEffect(()=>{const update=()=>setSaved(readSavedFonts());window.addEventListener('frame:saved-fonts',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('frame:saved-fonts',update);window.removeEventListener('storage',update);};},[]);
 function remember(name:string,remove=false){setStorageError(saveFontName(name,remove)?'':'This browser could not save the font list.');}
 useEffect(()=>{let active=true;setStatus('');if(!value.trim())return;
   const timer=setTimeout(()=>{void installedFontAvailable(value).then(available=>{if(active)setStatus(available===true?'Available on this device':available===false?'Font not found. Using system sans.':'Font availability could not be checked. The preview uses the font if available.');});},350);
   return()=>{active=false;clearTimeout(timer);};
 },[value]);
 return <div className="installed-font-manager"><Field label="Installed Font Family" hint="Uses fonts installed on this device. Only names are saved."><input value={value} maxLength={80} placeholder="e.g. Aptos" onChange={e=>{const next=e.target.value;if(!next||validFontName(next)||!next.trim())onChange(next);}}/>{status&&<span className="installed-font-status" role="status">{status}</span>}</Field>
 <button type="button" className="button primary font-save-name" disabled={!validFontName(value)||saved.some(name=>name.toLocaleLowerCase()===value.trim().replace(/ +/g,' ').toLocaleLowerCase())} onClick={()=>remember(value)}>Save Font</button>
 {!!saved.length&&<><h4 className="saved-font-heading">Saved Fonts</h4><div className="saved-fonts" aria-label="Saved installed fonts">{saved.map(name=><div key={name} className="saved-font-row"><button type="button" className="saved-font-choice" aria-pressed={name.toLocaleLowerCase()===value.trim().toLocaleLowerCase()} onClick={()=>onChange(name)}><span>{name}</span></button><button type="button" className="saved-font-remove" aria-label={`Remove ${name} from saved fonts`} onClick={()=>remember(name,true)}>×</button></div>)}</div></>}
 {storageError&&<p className="muted" role="status">{storageError}</p>}</div>;
}
