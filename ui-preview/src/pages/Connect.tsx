import {streamingRequirement} from '../platform/browser';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Server, ShieldCheck } from 'lucide-react';
import { useConnection, errorMessage } from '../jellyfin/useConnection';
import { normalizeServerUrl, type JellyfinClient } from '../jellyfin/client';
import type { ServerInfo } from '../jellyfin/types';
import {hosting} from '../build/hosting';
export function Connect() {
  const connection = useConnection();
  const hostedServer=hosting(document.baseURI).serverUrl;
  const playbackRequirement=streamingRequirement(window.isSecureContext,'serviceWorker' in navigator);
  const navigate = useNavigate();
  const [url, setUrl] = useState(()=>hosting(document.baseURI).serverUrl??''); const [http, setHttp] = useState(false); const [consent, setConsent] = useState(false);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [remember, setRemember] = useState(true);
  const [server, setServer] = useState<ServerInfo | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const pending = useRef<JellyfinClient | null>(null);
  useEffect(() => () => { pending.current?.dispose(); }, []);
  function resetProbe() { pending.current?.dispose(); pending.current = null; setServer(null); }
  async function probe(event: FormEvent) {
    event.preventDefault(); if (!consent || busy) return;
    setBusy(true); setError(''); resetProbe();
    try { const base = normalizeServerUrl(url, http, location.protocol); setUrl(base); const client = connection.createClient(base); pending.current = client; setServer(await client.probe()); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function signIn(event: FormEvent) {
    event.preventDefault(); if (!server || !pending.current || busy) return;
    setBusy(true); setError('');
    try { const client = pending.current; const session = await client.authenticate(server, username, password); pending.current = null; connection.activate(client, session, remember); navigate('/'); }
    catch (e) { setError(errorMessage(e)); } finally { setPassword(''); setBusy(false); }
  }
  async function resume() { await connection.resumeSaved(); }
  return <div className="content-page connection-page">
<header className="page-heading">
<span className="eyebrow">frame.</span>
<h1>Connect To Jellyfin</h1>
<p>Sign in to open your library.</p>
</header>
    {hostedServer && <p className="connection-note">This server address was filled in from the current page. Change it if needed.</p>}
    {playbackRequirement && <p className="connection-note" role="status">{hostedServer?'Playback stays in frame. using this server’s item-scoped media relay. No extra sign-in or certificate is needed.':playbackRequirement}</p>}
    {connection.message && <p className="connection-note" role="status">{connection.message}</p>}
    {connection.session && !connection.unavailable ? <section className="settings-group connection-card">
<Server size={25}/>
<h2>{connection.session.server.ServerName}</h2>
<p>Signed in as {connection.session.user.Name} · Jellyfin {connection.session.server.Version}</p>
<p>Library access follows your Jellyfin account permissions.</p>
<label className="check-label"><input type="checkbox" checked={connection.remembered} onChange={e=>connection.rememberCurrent(e.target.checked)}/>Remember me on this device</label>
<p className="muted">Saves a session token in this browser, not your password. Signing out removes it.</p>
<div className="modal-actions">
<Link className="button primary" to="/library">Browse libraries</Link>
<button className="button secondary" onClick={() => { void connection.disconnect(); }}>Sign Out</button>
</div>
</section>
    : <div className="connection-layout">
<section className="settings-group connection-card">
<Server size={25}/>
<h2>Your Jellyfin Server</h2>
      <form onSubmit={probe} className="connection-form">
<label>Server URL<input required type="url" placeholder="https://media.example.com/jellyfin" value={url} disabled={busy} onChange={e => { setUrl(e.target.value); resetProbe(); }}/>
</label>
        <label className="check-label">
<input type="checkbox" checked={http} disabled={busy} onChange={e => { setHttp(e.target.checked); resetProbe(); }}/>Allow unencrypted HTTP on a trusted network</label>
        <label className="check-label">
<input type="checkbox" checked={consent} disabled={busy} onChange={e => { setConsent(e.target.checked); resetProbe(); }}/>I authorize frame. to contact the server I enter or resume.</label>
        <button className="button secondary" disabled={!consent || busy || !url}>{busy ? 'Contacting server…' : 'Test connection'}</button>
      </form>
      {server && <>
<p className="connection-note" role="status">Connected to {server.ServerName} · Jellyfin {server.Version}</p>
<form className="connection-form" onSubmit={signIn}>
        <label>Username<input required autoComplete="username" value={username} disabled={busy} onChange={e => setUsername(e.target.value)}/>
</label>
        <label>Password<input type="password" autoComplete="current-password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)}/>
</label>
        <label className="check-label">
<input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/>Remember me on this device</label>
        <button className="button primary" disabled={busy || !consent || !username}>Sign in</button>
      </form>
</>}
      {connection.saved && <div className="connection-note">
<p>A remembered session is available for {connection.saved.user.Name} at {connection.saved.baseUrl}. frame. validates the saved session with this server before restoring access.</p>
<button className="button secondary" disabled={busy} onClick={() => void resume()}>Retry saved connection</button>
<button className="text-link" onClick={connection.forget}>Forget saved session</button>
</div>}
      {error && <p className="connection-error" role="alert">{error}</p>}
    </section>
<aside className="connection-card connection-privacy">
<ShieldCheck size={25}/>
<h2>Sign-In & Privacy</h2>
<p>frame. connects to your Jellyfin server and never saves your password. Remember Me keeps a sign-in token in this browser. Leave it off on shared devices. Signing out removes the token.</p>
<p>Site scripts and browser extensions may be able to read the saved token. HTTPS protects traffic to your server. When frame. and Jellyfin use different origins, Jellyfin must allow the connection through CORS.</p>
<p>If you have a saved sign-in, frame. checks it with your server when you open the app. Otherwise, it waits until you test a connection.</p>
</aside>
</div>}
  </div>;
}




