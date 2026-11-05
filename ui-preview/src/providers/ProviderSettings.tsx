import {SettingsSection} from '../components/SettingsSection';
import { useState } from 'react';
import { usePreview } from '../state/PreviewContext';
import { useOnline } from './context';
import {episodeImages} from './episodeImages';
export function ProviderSettings(){
  const {preferences,setPreference}=usePreview();const online=useOnline();const [cleared,setCleared]=useState(false);
  return <SettingsSection id="online-heading" title="Free Online Artwork & TV Details" className="online-settings"><div className="settings-group provider-settings">
    <p>No extra account, payment or API key. frame. uses Jellyfin’s configured artwork providers and free public TV metadata.</p>
    <label className="check-label"><input type="checkbox" checked={preferences.onlineMetadata} onChange={e=>setPreference('onlineMetadata',e.target.checked)}/>Online Artwork & TV Details</label>
    <p>HD backdrops use existing Jellyfin provider IDs. Missing TV descriptions, cast and ratings use verified provider IDs. Missing movie and TV cast portraits can use verified TMDB person IDs from Jellyfin, with no personal API key. Missing episode names can use an identified parent series and consistent aired numbering; ambiguous records stay unchanged.</p>
    <p>Jellyfin remains authoritative. These are display-only additions: frame. never replaces server metadata or saves provider artwork onto your server.</p>
    <p>When enabled, TV provider IDs go to the public metadata service and public artwork loads from provider CDNs. Jellyfin credentials, server URLs and file paths stay out of those requests.</p>
    {online.simulated&&<p role="status">Synthetic provider responses · original artwork · no network</p>}
    <p>Successfully loaded TV details and episode stills stay cached on this browser for up to 30 days, so temporary provider outages do not remove them.</p>
    {online.client&&<button className="button secondary" onClick={async()=>{await Promise.all([online.client?.clearCache(),episodeImages.clear()]);setCleared(true);}}>Clear Online Metadata Cache</button>}
    {cleared&&<p role="status">Cache cleared. Reopen a title to fetch current provider data.</p>}
    <div className="provider-credits"><p>Artwork availability depends on your server’s configured providers and permissions.</p><a href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img className="tmdb-logo" src={new URL("providers/tmdb.svg",document.baseURI).href} alt="TMDB · The Movie Database"/></a><p>This product uses the TMDB API through Jellyfin but is not endorsed or certified by TMDB.</p></div>
  </div></SettingsSection>;
}
