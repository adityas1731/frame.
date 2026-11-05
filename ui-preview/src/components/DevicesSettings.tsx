import {useRef,useState} from 'react';
import {Modal} from './Primitives';
import {JellyfinError} from '../jellyfin/client';
import {Monitor,RefreshCw,LogOut} from 'lucide-react';
import {SettingsSection} from './SettingsSection';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {canRevokeDevice,currentDevice,visibleDeviceSessions,type DeviceSession} from '../jellyfin/devices';
export function DevicesSettings(){
 const {session,client}=useConnection();const [revoking,setRevoking]=useState<DeviceSession>();const [busy,setBusy]=useState(false);const pending=useRef(false);const [notice,setNotice]=useState('');const [error,setError]=useState('');const [revoked,setRevoked]=useState<string[]>([]);
 const scope=session?`${session.server.Id}:${session.user.Id}:${session.created}`:'demo';
 const result=useRemote(`devices:${scope}`,()=>client&&session?client.deviceSessions():Promise.resolve({available:false as const,reason:'Connect to Jellyfin to see your active devices.'}),false);
 const rows=session&&result.data?.available?visibleDeviceSessions(result.data.rows.filter(row=>!revoked.includes(row.deviceId)),session.user.Id,session.deviceId,session.user.Policy?.IsAdministrator===true):[];
 async function revoke(){
  if(!client||!session||!revoking||pending.current||!canRevokeDevice(revoking,session.deviceId,session.user.Policy?.IsAdministrator===true))return;
  pending.current=true;setBusy(true);setError('');
  try{await client.revokeDevice(revoking.deviceId);setRevoked(previous=>[...previous,revoking.deviceId]);setNotice(`Access revoked for ${revoking.device}. They can sign in again.`);setRevoking(undefined);result.revalidate();}
  catch(cause){setError(cause instanceof JellyfinError&&cause.status===403?'Jellyfin requires administrator permission to revoke this device.':cause instanceof JellyfinError&&cause.status===404?'This device is no longer registered. Refresh the list.':'Access could not be revoked. Refresh the list before trying again.');}
  finally{pending.current=false;setBusy(false);}
 }
 return <SettingsSection id="devices-heading" title="Devices" aside={<button className="text-link" disabled={!session||result.loading} onClick={()=>{client?.clearDeviceSessions();result.revalidate();}}><RefreshCw size={15}/>Refresh</button>}><div className="device-settings"><p className="studio-footnote">Active sessions visible to your Jellyfin account.</p>{notice&&<p className="device-notice" role="status">{notice}</p>}{result.loading?<p role="status">Loading devices…</p>:result.error?<p role="status">Devices could not be loaded. Your connection is unchanged.</p>:result.data&&!result.data.available?<p role="status">{result.data.reason}</p>:!rows.length?<p>No active devices are available to this account.</p>:<ul className="device-list">{rows.map(row=><li key={row.id}><Monitor size={20} aria-hidden="true"/><div className="device-identity"><strong>{row.device}</strong><span>{row.client} · {row.user}</span>{row.ip&&<small>{row.ip}</small>}</div><div className="device-activity">{session&&currentDevice(row,session.deviceId)&&<span className="device-current">This Device</span>}<span>{row.status}</span>{row.lastActivity&&<time dateTime={row.lastActivity}>{new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.lastActivity))}</time>}{session&&canRevokeDevice(row,session.deviceId,session.user.Policy?.IsAdministrator===true)&&<button type="button" className="device-revoke" onClick={()=>{setError('');setRevoking(row);}}><LogOut size={14}/>Revoke Access</button>}</div></li>)}</ul>}</div>{revoking&&<Modal title="Revoke Device Access?" className="device-revoke-modal" onClose={()=>{if(!pending.current)setRevoking(undefined);}}><p>Sign out <strong>{revoking.device}</strong> from Jellyfin. This removes its saved sessions and may interrupt playback. Anyone using this device can sign in again.</p>{error&&<p role="alert" className="device-revoke-error">{error}</p>}<div className="device-revoke-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setRevoking(undefined)}>Cancel</button><button type="button" className="button device-revoke-confirm" disabled={busy} onClick={()=>void revoke()}>{busy?'Revoking…':'Revoke Access'}</button></div></Modal>}</SettingsSection>;
}
