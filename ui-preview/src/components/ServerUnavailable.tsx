import {ServerOff, RefreshCw} from 'lucide-react';
import {Link} from 'react-router';
import {useState} from 'react';
import './server-unavailable.css';

export function ServerUnavailable({retry}:{retry:()=>Promise<void>}) {
  const [busy,setBusy]=useState(false);
  async function reconnect(){if(busy)return;setBusy(true);try{await retry();}finally{setBusy(false);}}
  return <main className="server-unavailable">
    <span className="server-unavailable-brand">frame<span>.</span></span>
    <section aria-labelledby="server-unavailable-heading">
      <ServerOff size={30} strokeWidth={1.4} aria-hidden="true"/>
      <h1 id="server-unavailable-heading">Jellyfin Isn’t Available</h1>
      <p>Start your Jellyfin server, then try again. If it’s already running, check your connection.</p>
      <div className="server-unavailable-actions">
        <button className="button primary" disabled={busy} onClick={()=>void reconnect()}><RefreshCw size={16} aria-hidden="true"/>{busy?'Connecting…':'Try Again'}</button>
        <Link className="server-unavailable-settings" to="/connect">Connection Settings</Link>
      </div>
      <small>Your saved sign-in is still here.</small>
    </section>
  </main>;
}
