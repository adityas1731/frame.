import {api,base} from './test-api.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const created=await api('Users/New','POST',{Name:'Frame Relay Permission QA '+Date.now()});
const item=(await api('Items?recursive=true&includeItemTypes=Movie&limit=1')).Items[0];assert.ok(item);
let grant,cookie,auth;
const headers=()=>({Authorization:auth,'Content-Type':'application/json','X-Frame-Request':'1',Origin:new URL(base).origin,...(cookie?{Cookie:cookie}:{})});
const checks=[];
try {
 const policy=created.Policy;await api(`Users/${created.Id}/Policy`,'POST',{...policy,IsAdministrator:false,EnableAllFolders:true,EnableMediaPlayback:true});
 const login=await fetch(base+'/Users/AuthenticateByName',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'MediaBrowser Client="Frame Relay QA", Device="Disposable", DeviceId="relay-permission-test", Version="0.1.0"'},body:JSON.stringify({Username:created.Name,Pw:''})});assert.equal(login.status,200);const signed=await login.json();auth=`MediaBrowser Client="Frame Relay QA", Device="Disposable", DeviceId="relay-permission-test", Version="0.1.0", Token="${signed.AccessToken}"`;
 const open=async()=>fetch(base+'/Frame/Media',{method:'POST',headers:headers(),body:JSON.stringify({ItemId:item.Id})});
 let response=await open();assert.equal(response.status,200);grant=(await response.json()).grantId;cookie=response.headers.get('set-cookie').split(';')[0];checks.push('ordinary non-admin user can open own allowed media');
 await api(`Users/${created.Id}/Policy`,'POST',{...policy,IsAdministrator:false,EnableAllFolders:false,EnabledFolders:[],EnableMediaPlayback:true});
 response=await open();assert.equal(response.status,403);checks.push('hidden library item cannot create grant');
 await api(`Users/${created.Id}/Policy`,'POST',{...policy,IsAdministrator:false,EnableAllFolders:true,EnableMediaPlayback:true});
 await api(`Users/${created.Id}/Policy`,'POST',{...policy,IsAdministrator:false,EnableAllFolders:true,EnableMediaPlayback:false});
 response=await open();assert.equal(response.status,403);checks.push('playback-disabled user cannot create grant');
 response=await fetch(`${base}/Frame/Media/${grant}/lease`,{method:'PUT',headers:headers()});assert.equal(response.status,403);checks.push('permission revocation rejects renewal and closes grant');
 const target=`${base}/Frame/Media/${grant}/stream?resource=${Buffer.from(`Videos/${item.Id}/stream.mp4?static=true`).toString('base64url')}`;
 response=await fetch(target,{method:'HEAD',headers:{Cookie:cookie}});assert.equal(response.status,404);checks.push('revoked grant cannot stream');
 await api(`Users/${created.Id}/Policy`,'POST',{...policy,IsAdministrator:false,EnableAllFolders:true,EnableMediaPlayback:true});
 response=await open();assert.equal(response.status,200);grant=(await response.json()).grantId;cookie=response.headers.get('set-cookie').split(';')[0];
 await fetch(base+'/Sessions/Logout',{method:'POST',headers:headers()});
 const revoked=await fetch(`${base}/Frame/Media/${grant}/stream?resource=${Buffer.from(`Videos/${item.Id}/stream.mp4?static=true`).toString('base64url')}`,{method:'HEAD',headers:{Cookie:cookie}});
 assert.ok([401,403,404].includes(revoked.status),'revoked Jellyfin token must not stream');checks.push('Jellyfin token revocation blocks media even while cookie exists');
 await writeFile('docs/relay-permissions-results.json',JSON.stringify({checks,productionContacted:false},null,2));console.log(JSON.stringify({passed:checks.length,productionContacted:false}));
} finally {if(grant)await fetch(`${base}/Frame/Media/${grant}/lease`,{method:'DELETE',headers:headers()}).catch(()=>{});await api(`Users/${created.Id}`,'DELETE');}
