import {SettingsSection} from '../components/SettingsSection';
import { useState } from 'react';
import { usePreview } from '../state/PreviewContext';
import { useOnline } from './context';
import {episodeImages} from './episodeImages';
export function ProviderSettings(){
  const {preferences,setPreference}=usePreview();const online=useOnline();const [cleared,setCleared]=useState(false);
  return <SettingsSection id="online-heading" title="Online Artwork & TV Details" className="online-settings"><div className="settings-group provider-settings">
    <p>Fills missing artwork and TV details using Jellyfin’s providers and public TV metadata.</p>
    <label className="check-label"><input type="checkbox" checked={preferences.onlineMetadata} onChange={e=>setPreference('onlineMetadata',e.target.checked)}/>Online Artwork & TV Details</label>
    <p>Uses provider IDs to find backdrops, cast photos and missing TV details. Episode names can also use the identified series and aired episode numbers. Uncertain matches are left unchanged.</p>
    <p>Fetched details are display-only. To save artwork to Jellyfin, an administrator can select Apply for All Users in Manage Title.</p>
    <p>Sends provider IDs to metadata services and loads images from their servers. These requests do not include your Jellyfin token, server address or file paths.</p>
    {online.simulated&&<p role="status">Synthetic provider responses · original artwork · no network</p>}
    <p>TV details and episode stills are cached in this browser for up to 30 days and remain available during provider outages.</p>
    {online.client&&<button className="button secondary" onClick={async()=>{await Promise.all([online.client?.clearCache(),episodeImages.clear()]);setCleared(true);}}>Clear Online Metadata Cache</button>}
    {cleared&&<p role="status">Cache cleared. Reopen a title to fetch current provider data.</p>}
    <div className="provider-credits"><p>Artwork availability depends on your server’s configured providers and permissions.</p><a href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img className="tmdb-logo" src={new URL("providers/tmdb.svg",document.baseURI).href} alt="TMDB · The Movie Database"/></a><p>This product uses the TMDB API through Jellyfin but is not endorsed or certified by TMDB.</p></div>
  </div></SettingsSection>;
}
