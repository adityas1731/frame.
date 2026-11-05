export interface DeviceSession {id:string;deviceId:string;device:string;client:string;userId?:string;user:string;lastActivity?:string;status:'Playing'|'Paused'|'Connected';ip?:string}
const text=(value:unknown,max=100)=>typeof value==='string'?value.trim().slice(0,max):'';
/** Keep a minimal DTO: never retain access tokens, media paths or playback URLs. */
export function parseDeviceSessions(value:unknown):DeviceSession[]{
 if(!Array.isArray(value))return [];
 return value.slice(0,100).flatMap(raw=>{
  if(!raw||typeof raw!=='object')return [];const s=raw as Record<string,unknown>;
  if(!text(s.Id)||!text(s.DeviceId))return [];
  const play=s.PlayState&&typeof s.PlayState==='object'?s.PlayState as Record<string,unknown>:{};
  const last=text(s.LastActivityDate);const endpoint=text(s.RemoteEndPoint,64);
  return [{id:text(s.Id),deviceId:text(s.DeviceId),device:text(s.DeviceName)||'Unnamed device',client:text(s.Client)||'Jellyfin client',userId:text(s.UserId)||undefined,user:text(s.UserName)||'Unknown user',lastActivity:last&&Number.isFinite(Date.parse(last))?last:undefined,status:s.NowPlayingItem&&typeof s.NowPlayingItem==='object'?(play.IsPaused===true?'Paused':'Playing'):'Connected',ip:/^[\da-fA-F:.\[\]]+$/.test(endpoint)?endpoint:undefined} as DeviceSession];
 });
}
export function visibleDeviceSessions(rows:DeviceSession[],userId:string,deviceId:string,administrator:boolean){
 const sameUser=(id:string|undefined)=>!!id&&id.replaceAll('-','').toLowerCase()===userId.replaceAll('-','').toLowerCase();
 return rows.filter(row=>administrator||sameUser(row.userId)||(!row.userId&&row.deviceId===deviceId)).map(row=>({...row,ip:administrator||row.deviceId===deviceId?row.ip:undefined}));
}
export function currentDevice(row:DeviceSession,deviceId:string){return row.deviceId===deviceId;}
export function canRevokeDevice(row:DeviceSession,deviceId:string,administrator:boolean){return administrator&&!!row.deviceId&&!currentDevice(row,deviceId);}
