/** Only the existing disposable server/account and original generated test media. */
import {api,base,session} from './test-api.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {cleanMediaUrl} from '../../ui-preview/public/frame-stream-policy.js';
import {deviceProfile} from '../../ui-preview/src/playback/capabilities.ts';
const items=(await api(`Items?userId=${session.userId}&recursive=true&includeItemTypes=Movie,Episode&limit=10`)).Items;
const movie=items.find(i=>i.Type==='Movie'),episode=items.find(i=>i.Type==='Episode');assert.ok(movie&&episode);
const origin=new URL(base).origin,headers={Authorization:`MediaBrowser Client="Frame QA", Device="Isolated", DeviceId="frame-isolated-qa", Version="0.1.0", Token="${session.token}"`,'Content-Type':'application/json','X-Frame-Request':'1',Origin:origin};
const checks=[];const check=(value,label)=>{assert.ok(value,label);checks.push(label);};
async function open(item=movie.Id){const response=await fetch(base+'/Frame/Media',{method:'POST',headers,body:JSON.stringify({ItemId:item})});assert.equal(response.status,200,'open grant');const data=await response.json();const cookie=response.headers.get('set-cookie');check(/HttpOnly/i.test(cookie)&&/SameSite=Strict/i.test(cookie)&&/max-age=120/i.test(cookie),'scoped HttpOnly lease cookie');return{...data,cookie:cookie.split(';')[0]};}
const encoded=raw=>Buffer.from(raw).toString('base64url');
const resource=(grant,raw)=>`${base}/Frame/Media/${grant.grantId}/stream?resource=${encoded(raw)}`;
let direct,second;
try {
 check((await fetch(base+'/Frame/Media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ItemId:movie.Id})})).status===401,'grant creation requires Jellyfin authentication');
 check((await fetch(base+'/Frame/Media',{method:'POST',headers:{...headers,Origin:'http://outside.invalid'},body:JSON.stringify({ItemId:movie.Id})})).status===400,'cross-origin creation rejected');
 for(const origin of [undefined,'null']){const negative={...headers};if(origin===undefined)delete negative.Origin;else negative.Origin=origin;check((await fetch(base+'/Frame/Media',{method:'POST',headers:negative,body:JSON.stringify({ItemId:movie.Id})})).status===400,origin===undefined?'missing Origin rejected':'null Origin rejected');}
 for(const marker of [undefined,'0']){const negative={...headers};if(marker===undefined)delete negative['X-Frame-Request'];else negative['X-Frame-Request']=marker;check((await fetch(base+'/Frame/Media',{method:'POST',headers:negative,body:JSON.stringify({ItemId:movie.Id})})).status===400,marker===undefined?'missing marker rejected':'invalid marker rejected');}
 for(const site of ['cross-site','same-site'])check((await fetch(base+'/Frame/Media',{method:'POST',headers:{...headers,'Sec-Fetch-Site':site},body:JSON.stringify({ItemId:movie.Id})})).status===400,site+' creation rejected');
 check((await fetch(base+'/Frame/Media',{method:'POST',headers:{...headers,Authorization:'MediaBrowser Token="invalid-disposable-fixture"'},body:JSON.stringify({ItemId:movie.Id})})).status===401,'invalid authentication rejected');
 direct=await open();const target=resource(direct,`Videos/${movie.Id}/stream.mp4?static=true`);
 check((await fetch(target,{method:'HEAD'})).status===404,'grant ID without cookie cannot access media');
 const range=await fetch(target,{headers:{Cookie:direct.cookie,Range:'bytes=0-31'}});check(range.status===206&&range.headers.get('content-range')?.startsWith('bytes 0-31/'),'range status and content range preserved');check((await range.arrayBuffer()).byteLength===32,'only requested media bytes streamed');
 check((await fetch(target,{headers:{Cookie:direct.cookie,Origin:'http://outside.invalid'}})).status===404,'cross-origin cookie use rejected');
 check((await fetch(resource(direct,`Videos/${episode.Id}/stream.mp4?static=true`),{method:'HEAD',headers:{Cookie:direct.cookie}})).status===400,'other item denied');
 for(const raw of ['http://outside.invalid/secret','../System/Info','Videos/'+movie.Id+'/%2e%2e/secret'])check((await fetch(resource(direct,raw),{method:'HEAD',headers:{Cookie:direct.cookie}})).status===400,'unsafe resource denied');
 second=await open(episode.Id);check((await fetch(target,{method:'HEAD',headers:{Cookie:second.cookie}})).status===404,'another player cookie cannot access grant');
 check((await fetch(`${base}/Frame/Media/${direct.grantId}/lease`,{method:'PUT',headers:{...headers,Cookie:direct.cookie}})).status===204,'authenticated owner renews lease');
 check((await fetch(`${base}/Frame/Media/${direct.grantId}/lease`,{method:'PUT',headers:{Cookie:direct.cookie}})).status===401,'cookie alone cannot renew authorization');
 // Force H.264/AAC HLS using the same original device profile code as Frame.
 const support={nativeHls:true,mseHls:false,video:['h264'],audio:['aac'],containers:['mp4'],canDirect:async()=>false};
 const profile=deviceProfile(support,4000000,true);const info=await api(`Items/${movie.Id}/PlaybackInfo`,'POST',{UserId:session.userId,DeviceProfile:profile,EnableDirectPlay:false,EnableDirectStream:false,EnableTranscoding:true,AllowVideoStreamCopy:false,AllowAudioStreamCopy:false,MaxAudioChannels:2,MaxStreamingBitrate:4000000,IsPlayback:true});
 try {
  const raw=info.MediaSources.find(s=>s.TranscodingUrl)?.TranscodingUrl;check(!!raw,'server negotiates HLS');
  const relative=cleanMediaUrl(raw,base,movie.Id);const response=await fetch(resource(direct,relative),{headers:{Cookie:direct.cookie}});check(response.status===200,'HLS manifest streamed');const master=await response.text();check(master.startsWith('#EXTM3U')&&!master.includes(session.token),'manifest has no Jellyfin token');
  const paths=master.split(/\r?\n/).filter(l=>l&&!l.startsWith('#'));check(paths.length>0&&paths.every(p=>p.startsWith('/jellyfin/Frame/Media/'+direct.grantId+'/')),'manifest resources stay under grant');
  const child=await fetch(origin+paths[0],{headers:{Cookie:direct.cookie}});check(child.status===200,'HLS child loaded');const type=child.headers.get('content-type')??'';
  if(type.includes('mpegurl')){const playlist=await child.text();const segment=playlist.split(/\r?\n/).find(l=>l&&!l.startsWith('#'));assert.ok(segment);const bytes=await fetch(origin+segment,{headers:{Cookie:direct.cookie}});check(bytes.status===200&&(await bytes.arrayBuffer()).byteLength>0,'transcoded HLS segment streamed');}else check((await child.arrayBuffer()).byteLength>0,'HLS media bytes streamed');
 } finally {await api(`Videos/ActiveEncodings?deviceId=frame-isolated-qa&playSessionId=${info.PlaySessionId}`,'DELETE');}
 const restored=await fetch(target,{headers:{Cookie:direct.cookie,Range:'bytes=0-31'}});check(restored.status===206&&(await restored.arrayBuffer()).byteLength===32,'same lease returns from HLS to Direct Play bytes');
 check((await fetch(`${base}/Frame/Media/${direct.grantId}/lease`,{method:'DELETE',headers:{...headers,Cookie:direct.cookie}})).status===204,'owner closes lease');
 check((await fetch(target,{method:'HEAD',headers:{Cookie:direct.cookie}})).status===404,'closed lease revoked');
 await writeFile('docs/relay-integration-results.json',JSON.stringify({server:'Disposable Jellyfin 12.3 on 18096',checks,productionContacted:false,originalMediaOnly:true},null,2));console.log(JSON.stringify({passed:checks.length,productionContacted:false}));
} finally {for(const grant of [direct,second])if(grant)await fetch(`${base}/Frame/Media/${grant.grantId}/lease`,{method:'DELETE',headers:{...headers,Cookie:grant.cookie}}).catch(()=>{});}

