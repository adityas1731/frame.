import {useState} from 'react';
import {useStudio} from '../studio/context';
import {SettingsSection,Field} from '../components/SettingsSection';
import {SettingsSelect as Select} from '../components/Select';
import {loadSkipping,saveSkipping,segmentTypes,segmentLabel,type SkipMode} from './segments';
export function SkippingSettings(){const {scope}=useStudio();return <ScopedSkipping key={scope} scope={scope}/>;}
function ScopedSkipping({scope}:{scope:string}){
 const [value,setValue]=useState(()=>loadSkipping(scope,localStorage));const [error,setError]=useState('');
 return <SettingsSection id="playback-heading" title="Playback"><div className="studio-panel"><h3>Skipping</h3><p className="studio-footnote">Choose whether to show a button or skip automatically. Timings come from Jellyfin. Check a title’s available timings in the player’s Skipping tab.</p><div className="studio-fields">{segmentTypes.map(type=><Field key={type} label={segmentLabel[type]}><Select aria-label={`${segmentLabel[type]} skipping`} value={value[type]} onValueChange={mode=>{const next={...value,[type]:mode as SkipMode};setValue(next);try{saveSkipping(scope,next,localStorage);setError('');}catch{setError('Browser storage is unavailable. This preference cannot be saved.');}}}><option value="off">Off</option><option value="button">Show Skip Button</option><option value="auto">Automatically Skip</option></Select></Field>)}</div>{error&&<p role="status">{error}</p>}</div></SettingsSection>;
}
