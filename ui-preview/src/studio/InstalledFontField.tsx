import {useEffect,useState} from 'react';
import {Field} from '../components/SettingsSection';
import {installedFontAvailable,validFontName} from '../appearance/fonts';
export function InstalledFontField({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [status,setStatus]=useState('');
 useEffect(()=>{let active=true;setStatus('');if(!value.trim())return;
   const timer=setTimeout(()=>{setStatus('Checking Font…');void installedFontAvailable(value).then(available=>{if(active)setStatus(available===true?'Available On This Device':available===false?'Font not found. Using system sans.':'This browser cannot check installed fonts. System sans is used if unavailable.');});},350);
   return()=>{active=false;clearTimeout(timer);};
 },[value]);
 return <Field label="Installed Font Family" hint="Install a font on this device, then enter its family name. No upload or external requests."><input value={value} maxLength={80} placeholder="e.g. Aptos" onChange={e=>{const next=e.target.value;if(!next||validFontName(next)||!next.trim())onChange(next);}}/><span className="installed-font-status" role="status">{status||'Enter the font’s family name to preview it.'}</span></Field>;
}
