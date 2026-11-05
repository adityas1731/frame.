import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {stage} from './stage.mjs';
import {publish,repository,validateCatalog} from './publish.mjs';
const directory=process.env.FRAME_RELEASE_INPUT;
const receipt=JSON.parse(await readFile('release/1.0.3.0.json'));
const revision='a'.repeat(40);
const options=(mode='verify')=>({mode,draft:'1',actor:'adityas1731',event:'workflow_dispatch',ref:'refs/heads/main',revision,version:receipt.version,sha256:receipt.binary.sha256,confirmation:`${mode.toUpperCase()} frame. ${receipt.version} ${revision} ${receipt.binary.sha256}`});
async function fixture(){
 let release=null,catalog=null,next=1;const writes=[];const bytes=new Map();
 const server=createServer(async(req,res)=>{try{
  const chunks=[];for await(const c of req)chunks.push(c);const data=Buffer.concat(chunks);let result=null;
  if(req.method!=='GET')writes.push({method:req.method,url:req.url});
  if(req.url==='/repo')result={name:'frame.',full_name:repository,private:false};
  else if(req.url==='/releases'&&req.method==='POST'){release={...JSON.parse(data),id:1,assets:[]};result=release;}
  else if(req.url?.startsWith('/upload/')&&req.method==='PUT'){const name=decodeURIComponent(req.url.slice(8)),id=next++;bytes.set(id,data);release.assets.push({name,id,size:data.length});result={};}
  else if(req.url==='/releases/1'&&req.method==='PATCH'){Object.assign(release,JSON.parse(data));result=release;}
  else if(req.url==='/releases/1')result=release;
  else if(req.url?.startsWith('/releases/assets/')){res.end(bytes.get(Number(req.url.split('/').at(-1))));return;}
  else if(req.url?.startsWith('/anonymous/')){assert.equal(release.draft,false);const name=decodeURIComponent(req.url.slice(11));res.end(bytes.get(release.assets.find(a=>a.name===name).id));return;}
  else if(req.url?.startsWith('/contents/manifest.json')&&req.method==='PUT'){catalog=JSON.parse(data);result={};}
  else if(req.url?.startsWith('/contents/manifest.json'))result=catalog;
  else if(req.url==='/git/refs'&&req.method==='POST')result={};
  else if(req.url?.startsWith('/git/ref/')||req.url?.startsWith('/releases/tags/')){res.writeHead(404).end();return;}
  else throw Error('Unexpected mock route '+req.url);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
 }catch(e){res.writeHead(500).end(e.message);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const api=async(route,method='GET',body,binary=false,allow404=false)=>{const r=await fetch(base+(route||'/repo'),{method,body:body===undefined?undefined:JSON.stringify(body)});if(r.status===404&&(allow404||binary))return null;assert.equal(r.status,200);return binary?Buffer.from(await r.arrayBuffer()):r.json();};
 const files=name=>readFile(path.join(directory,name));
 return {api,files,writes,get release(){return release;},get catalog(){return catalog;},async staged(){await stage({directory,receipt,revision,owner:'adityas1731',confirmation:`STAGE frame. ${receipt.version} ${revision} ${receipt.binary.sha256}`,api,upload:async(draft,name,data)=>{const r=await fetch(base+'/upload/'+encodeURIComponent(name),{method:'PUT',body:data});assert.equal(r.status,200);}});},anonymous:async url=>Buffer.from(await(await fetch(base+'/anonymous/'+encodeURIComponent(url.split('/').at(-1)))).arrayBuffer()),close:()=>new Promise(r=>server.close(r))};
}
test('real HTTP rehearsal: draft staging, read-only verification, explicit publication and catalog ordering',{skip:!directory},async()=>{
 const f=await fixture();try{await f.staged();assert.equal(f.release.draft,true);assert.equal(f.release.assets.length,7);const count=f.writes.length;
 const args={receipt,directory,api:f.api,files:f.files,anonymous:f.anonymous};
 assert.deepEqual(await publish({...args,options:options()}),{mode:'verify',remoteWrites:0,version:'1.0.3.0'});assert.equal(f.writes.length,count);
 await publish({...args,options:options('publish')});assert.equal(f.release.draft,false);assert.equal(f.writes.at(-1).url,'/contents/manifest.json');assert.ok(f.catalog.content);
 }finally{await f.close();}
});
test('publication preconditions fail closed before mutations',{skip:!directory},async()=>{
 const f=await fixture();try{await f.staged();const count=f.writes.length;const args={receipt,directory,api:f.api,files:f.files,anonymous:f.anonymous};
 for(const change of [{actor:'other'},{event:'push'},{ref:'refs/heads/other'},{sha256:'0'.repeat(64)},{revision:'bad'},{confirmation:'yes'}])await assert.rejects(publish({...args,options:{...options('publish'),...change}}));
 for(const repo of [{full_name:repository,private:true},{full_name:'other/frame.',private:false}])await assert.rejects(publish({...args,options:options('publish'),api:r=>r===''?repo:f.api(r)}));
 f.release.assets[0].size++;await assert.rejects(publish({...args,options:options('publish')}));assert.equal(f.writes.length,count);assert.equal(f.release.draft,true);
 }finally{await f.close();}
});
test('anonymous verification failure never activates catalog',{skip:!directory},async()=>{
 const f=await fixture();try{await f.staged();await assert.rejects(publish({options:options('publish'),receipt,directory,api:f.api,files:f.files,anonymous:async()=>Buffer.from('corrupt')}));assert.equal(f.catalog,null);assert.equal(f.writes.at(-1).method,'PATCH');}finally{await f.close();}
});
test('ordinary CI has no publisher or write permission; publication is owner/manual/public/main only',async()=>{
 const ci=await readFile('.github/workflows/ci.yml','utf8'),manual=await readFile('.github/workflows/publish.yml','utf8');assert.ok(!ci.includes('contents: write'));assert.ok(!ci.includes('publish.mjs'));assert.ok(!ci.includes('secrets.'));assert.ok(manual.includes('workflow_dispatch:'));assert.ok(!manual.includes('push:'));assert.ok(!manual.includes('environment:'));assert.ok(manual.includes('!github.event.repository.private'));assert.ok(manual.includes("github.actor == 'adityas1731'"));assert.ok(manual.includes("github.ref == 'refs/heads/main'"));
});

test('catalog rejects wrong ABI, URL, identity, version or checksum',{skip:!directory},async()=>{
 const catalog=JSON.parse(await readFile('catalog/manifest.json'));const binary=await readFile(path.join(directory,receipt.binary.name));assert.equal(validateCatalog(catalog,receipt,binary),true);
 for(const patch of [{targetAbi:'99.0.0.0'},{sourceUrl:'https://example.invalid/wrong.zip'},{version:'1.0.2.0'},{checksum:'0'.repeat(32)}]){const changed=structuredClone(catalog);Object.assign(changed[0].versions[0],patch);assert.throws(()=>validateCatalog(changed,receipt,binary));}
 const changed=structuredClone(catalog);changed[0].guid='wrong';assert.throws(()=>validateCatalog(changed,receipt,binary));
});
