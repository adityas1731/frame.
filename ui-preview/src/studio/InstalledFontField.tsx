import {useEffect,useState} from 'react';
import {Field} from '../components/SettingsSection';
import {installedFontAvailable,validFontName} from '../appearance/fonts';
import {readSavedFonts,saveFontName} from '../appearance/savedFonts';
export function InstalledFontField({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [status,setStatus]=useState('');
 const [saved,setSaved]=useState(readSavedFonts);const [storageError,setStorageError]=useState('');
 const [availability,setAvailability]=useState<Record<string,boolean|null>>({});
 useEffect(()=>{const update=()=>setSaved(readSavedFonts());window.addEventListener('frame:saved-fonts',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('frame:saved-fonts',update);window.removeEventListener('storage',update);};},[]);
 useEffect(()=>{let active=true;void Promise.all(saved.map(async name=>[name,await installedFontAvailable(name)] as const)).then(values=>{if(active)setAvailability(Object.fromEntries(values));});return()=>{active=false;};},[saved]);
 function remember(name:string,remove=false){setStorageError(saveFontName(name,remove)?'':'This browser could not save the font list.');}
 useEffect(()=>{let active=true;setStatus('');if(!value.trim())return;
   const timer=setTimeout(()=>{setStatus('Checking Font…');void installedFontAvailable(value).then(available=>{if(active)setStatus(available===true?'Available On This Device':available===false?'Font not found. Using system sans.':'This browser cannot check installed fonts. System sans is used if unavailable.');});},350);
   return()=>{active=false;clearTimeout(timer);};
 },[value]);
 return <div className="installed-font-manager"><Field label="Installed Font Family" hint="Uses fonts installed on this device. Only names are saved."><input value={value} maxLength={80} placeholder="e.g. Aptos" onChange={e=>{const next=e.target.value;if(!next||validFontName(next)||!next.trim())onChange(next);}}/><span className="installed-font-status" role="status">{status||'Enter the font’s family name to preview it.'}</span></Field>
 <button type="button" className="button secondary font-save-name" disabled={!validFontName(value)||saved.some(name=>name.toLocaleLowerCase()===value.trim().replace(/ +/g,' ').toLocaleLowerCase())} onClick={()=>remember(value)}>Save Font</button>
 {!!saved.length&&<><h4 className="saved-font-heading">Saved Fonts</h4><div className="saved-fonts" aria-label="Saved installed fonts">{saved.map(name=><div key={name} className="saved-font-row"><button type="button" className="saved-font-choice" aria-pressed={name.toLocaleLowerCase()===value.trim().toLocaleLowerCase()} onClick={()=>onChange(name)}><span>{name}</span><small>{availability[name]===false?'Not installed':availability[name]===true?'Available':availability[name]===null?'Check unavailable':'Checking…'}</small></button><button type="button" className="saved-font-remove" aria-label={`Remove ${name} from saved fonts`} onClick={()=>remember(name,true)}>×</button></div>)}</div></>}
 {storageError&&<p className="muted" role="status">{storageError}</p>}</div>;
}
