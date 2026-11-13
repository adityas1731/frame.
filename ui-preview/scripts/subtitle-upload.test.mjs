import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JellyfinClient,parseUser} from '../src/jellyfin/client.ts';
import {subtitleUploadBody} from '../src/jellyfin/subtitleUpload.ts';
import {parseCustomSubtitle} from '../src/playback/customSubtitles.ts';
const id='12345678901234567890123456789012';
const subtitle=parseCustomSubtitle(new TextEncoder().encode('1\n00:00:01,000 --> 00:00:03,000\nBonjour café.'),'one.fr.srt');
const options={language:'fra',forced:false,hearingImpaired:false,confirmed:true};
const source={Id:'source',MediaStreams:[{Type:'Video',Index:0,Codec:'h264'}]};
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
function harness({policy={EnableSubtitleManagement:true},sources=[source],type='Movie',post=()=>new Response(null,{status:204})}={}){
 const calls=[];const client=new JellyfinClient('https://synthetic.invalid/base','synthetic-device',async(url,init)=>{
  calls.push({url,init});const path=new URL(url).pathname;
  if(path.endsWith('/Users/Me'))return json({Id:'synthetic-user',Policy:policy});
  if(init.method==='GET'&&path.endsWith(`/Items/${id}`))return json({Id:id,Type:type,MediaSources:sources});
  if(init.method==='POST'&&path.endsWith(`/Videos/${id}/Subtitles`))return post();
  throw Error('Unexpected test request');
 });
 client.restore({server:{Id:'synthetic',Version:'12.3'},user:{Id:'synthetic-user'},token:'synthetic-token',deviceId:'synthetic-device',baseUrl:client.baseUrl,created:Date.now()});
 return {client,calls,uploads:()=>calls.filter(c=>c.init.method==='POST')};
}
test('subtitle upload validates content and confirmation, uses fixed VTT format and UTF-8 base64',()=>{
 const body=subtitleUploadBody(subtitle,options);assert.equal(body.Format,'vtt');assert.equal(body.Language,'fra');assert.match(Buffer.from(body.Data,'base64').toString('utf8'),/Bonjour café\./);assert.equal(body.IsForced,false);
 for(const language of ['../../eng','en/sub','eng.vtt','English','e','<x>'])assert.throws(()=>subtitleUploadBody(subtitle,{...options,language}));
 assert.throws(()=>subtitleUploadBody(subtitle,{...options,confirmed:false}));
 assert.throws(()=>subtitleUploadBody({...subtitle,vtt:'not subtitles'},options));
 assert.equal(Object.hasOwn(body,'Path'),false);assert.equal(Object.hasOwn(body,'FileName'),false);
});
test('subtitle management permission is preserved and not inferred for ordinary users',()=>{
 assert.equal(parseUser({Id:'u',Policy:{EnableSubtitleManagement:true}}).Policy.EnableSubtitleManagement,true);
 assert.equal(parseUser({Id:'u',Policy:{EnableSubtitleManagement:'true'}}).Policy.EnableSubtitleManagement,false);
});
for(const policy of [{EnableSubtitleManagement:true},{IsAdministrator:true}])test(`authorized upload rechecks permission and exact media source (${Object.keys(policy)[0]})`,async()=>{
 const h=harness({policy});try{await h.client.saveSubtitle(id,'source',subtitle,options);assert.equal(h.uploads().length,1);const request=h.uploads()[0];assert.equal(request.url,`https://synthetic.invalid/base/Videos/${id}/Subtitles`);assert.equal(request.init.credentials,'omit');assert.equal(request.init.redirect,'error');assert.match(request.init.headers.Authorization,/synthetic-token/);assert.equal(JSON.parse(request.init.body).Format,'vtt');assert.ok(h.calls[1].url.includes('fields=MediaSources,MediaStreams'));}finally{h.client.dispose();}
});
for(const policy of [{},{EnableSubtitleManagement:false},{IsAdministrator:true,IsDisabled:true}])test(`denied or disabled accounts cannot upload (${JSON.stringify(policy)})`,async()=>{
 const h=harness({policy});try{await assert.rejects(h.client.saveSubtitle(id,'source',subtitle,options),/permission/);assert.equal(h.uploads().length,0);assert.equal(h.calls.length,1);}finally{h.client.dispose();}
});
for(const configuration of [{sources:[source,{...source,Id:'second'}]},{sources:[{...source,Id:'changed'}]},{sources:[]},{sources:[{Id:'source'}]},{type:'Series'}])test(`ambiguous or incomplete target fails closed (${JSON.stringify(configuration)})`,async()=>{
 const h=harness(configuration);try{await assert.rejects(h.client.saveSubtitle(id,'source',subtitle,options));assert.equal(h.uploads().length,0);}finally{h.client.dispose();}
});
test('an existing matching external VTT blocks a duplicate upload',async()=>{
 const h=harness({sources:[{...source,MediaStreams:[{Type:'Subtitle',Index:7,IsExternal:true,Codec:'vtt',Language:'fre'}]}]});try{await assert.rejects(h.client.saveSubtitle(id,'source',subtitle,options),/already exists/);assert.equal(h.uploads().length,0);}finally{h.client.dispose();}
});
test('existing embedded subtitles are kept and new forced/SDH flags are explicit',async()=>{
 const h=harness({sources:[{...source,MediaStreams:[{Type:'Subtitle',Index:9,IsExternal:false,Codec:'subrip',Language:'fra'}]}]});try{await h.client.saveSubtitle(id,'source',subtitle,{...options,forced:true,hearingImpaired:true});const body=JSON.parse(h.uploads()[0].init.body);assert.equal(body.IsForced,true);assert.equal(body.IsHearingImpaired,true);assert.equal(h.calls.some(c=>c.init.method==='DELETE'),false);}finally{h.client.dispose();}
});
for(const status of [403,500,'network'])test(`failed upload never auto-retries or exposes response contents (${status})`,async()=>{
 const h=harness({post:()=>{if(status==='network')throw Error('private upstream details');return new Response('private upstream details',{status});}});try{await assert.rejects(h.client.saveSubtitle(id,'source',subtitle,options),error=>{assert.doesNotMatch(error.message,/private upstream/);assert.match(error.message,status===403?/permission/:/may have saved/);return true;});assert.equal(h.uploads().length,1);}finally{h.client.dispose();}
});
test('double submit is blocked while an upload is in flight',async()=>{
 let finish;const h=harness({post:()=>new Promise(resolve=>{finish=()=>resolve(new Response(null,{status:204}));})});try{const first=h.client.saveSubtitle(id,'source',subtitle,options);await new Promise(resolve=>setTimeout(resolve,0));await assert.rejects(h.client.saveSubtitle(id,'source',subtitle,options),/in progress/);finish();await first;assert.equal(h.uploads().length,1);}finally{h.client.dispose();}
});
