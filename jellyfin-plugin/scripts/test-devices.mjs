/** Temporary users and read-only session requests on the guarded disposable server. */
import {api,base,session} from './test-api.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {JellyfinClient} from '../../ui-preview/src/jellyfin/client.ts';
import {visibleDeviceSessions} from '../../ui-preview/src/jellyfin/devices.ts';
const admin=new JellyfinClient(base,'frame-isolated-qa');admin.restore({token:session.token,server:{Version:'12.3.0'}});
const created=await api('Users/New','POST',{Name:'Frame Device QA '+Date.now()});let ordinary;
try{
 const administrator=await admin.deviceSessions();assert.equal(administrator.available,true);
 await api(`Users/${created.Id}/Policy`,'POST',{...created.Policy,IsAdministrator:false,EnableAllFolders:true,EnableMediaPlayback:true,EnableRemoteControlOfOtherUsers:false});
 const response=await fetch(base+'/Users/AuthenticateByName',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'MediaBrowser Client="Frame", Device="Frame test device", DeviceId="frame009-device-test", Version="0.1.12.0"'},body:JSON.stringify({Username:created.Name,Pw:''})});assert.equal(response.status,200);
 const auth=await response.json();ordinary=new JellyfinClient(base,'frame009-device-test');ordinary.restore({token:auth.AccessToken,server:{Version:'12.3.0'}});
 const result=await ordinary.deviceSessions();
 if(result.available){const shown=visibleDeviceSessions(result.rows,auth.User.Id,'frame009-device-test',false);assert.ok(shown.length>0);assert.ok(shown.every(row=>row.userId?.replaceAll('-','')===auth.User.Id.replaceAll('-','')));assert.ok(shown.every(row=>row.deviceId==='frame009-device-test'||row.ip===undefined));}
 else assert.match(result.reason,/permit/);
 assert.equal((await fetch(base+'/Sessions')).status,401);
 const report={status:'passed',administratorAvailable:true,ordinaryAvailable:result.available,ordinaryScopeRespected:true,anonymousDenied:true,productionContacted:false};
 await writeFile(new URL('../../.local/reports/devices.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{admin.dispose();ordinary?.dispose();await api(`Users/${created.Id}`,'DELETE');}
