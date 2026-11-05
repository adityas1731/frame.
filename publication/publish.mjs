/** Manual distribution only. Normal CI never imports or calls this module. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
export const repository='adityas1731/frame.';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function selection({mode='verify',actor,event,ref,revision,version,sha256,confirmation},receipt,repo) {
 if(!['verify','publish'].includes(mode)||actor!=='adityas1731'||event!=='workflow_dispatch')throw Error('Manual owner action required');
 if(!/^[a-f0-9]{40}$/.test(revision)||!/^\d+\.\d+\.\d+\.\d+$/.test(version)||! /^[a-f0-9]{64}$/.test(sha256))throw Error('Exact version/revision/checksum required');
 if(repo.full_name!==repository)throw Error('Wrong distribution repository');
 if(mode==='publish'&&(repo.private!==false||ref!=='refs/heads/main'))throw Error('Publication requires approved public repository and main');
 if(receipt.version!==version||receipt.binary.sha256!==sha256||receipt.compatibility.targetAbi!=='12.3.0.0')throw Error('Release selection mismatch');
 if(confirmation!==`${mode.toUpperCase()} frame. ${version} ${revision} ${sha256}`)throw Error('Exact confirmation required');
}
export async function verifyFiles(directory,receipt) {
 for(const asset of receipt.assets){
  if(path.basename(asset.name)!==asset.name||!/^[a-f0-9]{64}$/.test(asset.sha256))throw Error('Unsafe release asset');
  const bytes=await readFile(path.join(directory,asset.name));if(hash(bytes)!==asset.sha256)throw Error('Asset checksum mismatch');
 }
 execFileSync('pwsh',['-NoProfile','-File','jellyfin-plugin/scripts/verify-package.ps1','-Archive',path.join(directory,receipt.binary.name),'-Profile','release','-ExpectedVersion',receipt.version,'-ExpectedSha256',receipt.binary.sha256,'-ExpectedCommit',receipt.originalBuildRevision],{stdio:'pipe'});
 const sourceIndex=JSON.parse(await readFile(new URL('../release/source-files.json',import.meta.url)));
 for(const entry of sourceIndex.implementationInputs){
  if(path.isAbsolute(entry.path)||entry.path.split(/[\\/]/).includes('..'))throw Error('Unsafe source mapping');
  if(hash(await readFile(path.resolve(entry.path)))!==entry.sha256)throw Error('Public implementation source differs from reviewed binary source');
 }
 if(!sourceIndex.implementationInputs.length||receipt.source.implementationInputs!==sourceIndex.implementationInputs.length)throw Error('Missing implementation source mapping');
 return true;
}
export function validateCatalog(catalog,receipt,binary) {
 const entry=catalog[0]?.versions?.[0];
 if(catalog.length!==1||catalog[0].name!=='Frame'||catalog[0].guid!=='1c38ef02-2393-4f54-a18b-fcfcbf394d65'||!entry||catalog[0].versions.length!==1||entry.version!==receipt.version||entry.targetAbi!=='12.3.0.0'||entry.sourceUrl!==`https://github.com/${repository}/releases/download/${receipt.tag}/${receipt.binary.name}`)throw Error('Catalog identity mismatch');
 if(entry.checksum!==createHash('md5').update(binary).digest('hex'))throw Error('Catalog checksum mismatch');
 return true;
}
export async function publish({options,receipt,api,files,directory,anonymous}) {
 selection(options,receipt,await api(''));
 await verifyFiles(directory,receipt);
 const release=await api(`/releases/${options.draft}`);
 if(!release.draft||release.tag_name!==receipt.tag||release.target_commitish!==options.revision)throw Error('Expected matching unpublished draft');
 if(release.assets.length!==receipt.assets.length||new Set(release.assets.map(a=>a.name)).size!==release.assets.length)throw Error('Unexpected draft assets');
 for(const expected of receipt.assets){
  const asset=release.assets.find(a=>a.name===expected.name);if(!asset||asset.size!==(await files(expected.name)).length)throw Error('Draft asset mismatch');
  if(hash(await api(`/releases/assets/${asset.id}`,'GET',undefined,true))!==expected.sha256)throw Error('Uploaded asset checksum mismatch');
 }
 const catalog=JSON.parse(await readFile(new URL('../catalog/manifest.json',import.meta.url)));
 validateCatalog(catalog,receipt,await files(receipt.binary.name));
 const existing=await api('/contents/manifest.json?ref=plugin-catalog','GET',undefined,false,true);
 if(existing){
  const previous=JSON.parse(Buffer.from(existing.content,'base64'));if(previous.length!==1||previous[0].guid!==catalog[0].guid||previous[0].versions.some(v=>v.version===receipt.version))throw Error('Existing catalog conflict');
  catalog[0].versions.push(...previous[0].versions);
 }
 if(options.mode!=='publish')return {mode:'verify',remoteWrites:0,version:receipt.version};
 // All local/catalog checks precede the first remote mutation.
 await api(`/releases/${options.draft}`,'PATCH',{draft:false});
 for(const asset of receipt.assets){
  const url=`https://github.com/${repository}/releases/download/${receipt.tag}/${asset.name}`;
  if(hash(await anonymous(url))!==asset.sha256)throw Error('Anonymous release verification failed; catalog unchanged');
 }
 if(!existing&&!await api('/git/ref/heads/plugin-catalog','GET',undefined,false,true))await api('/git/refs','POST',{ref:'refs/heads/plugin-catalog',sha:options.revision});
 await api('/contents/manifest.json','PUT',{message:`catalog: add frame. ${receipt.version}`,branch:'plugin-catalog',content:Buffer.from(JSON.stringify(catalog,null,2)+'\n').toString('base64'),...(existing?{sha:existing.sha}:{})});
 return {mode:'publish',version:receipt.version};
}
async function main(){
 const [mode='verify',directory,draft,version,revision,sha256,confirmation]=process.argv.slice(2);
 if(!/^\d+$/.test(draft??'')||!process.env.GH_TOKEN||process.env.GITHUB_REPOSITORY!==repository)throw Error('Expected distribution repository and job token');
 if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==revision)throw Error('Public workflow revision mismatch');
 const receipt=JSON.parse(await readFile('release/'+version+'.json'));
 async function api(route,method='GET',body,binary=false,allow404=false){
  const response=await fetch('https://api.github.com/repos/'+repository+route,{method,headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:binary?'application/octet-stream':'application/vnd.github+json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(allow404&&response.status===404)return null;if(!response.ok)throw Error(`GitHub request failed (${response.status})`);if(response.status===204)return null;return binary?Buffer.from(await response.arrayBuffer()):response.json();
 }
 const result=await publish({options:{mode,draft,version,revision,sha256,confirmation,actor:process.env.GITHUB_ACTOR,event:process.env.GITHUB_EVENT_NAME,ref:process.env.GITHUB_REF},receipt,api,directory,files:name=>readFile(path.join(directory,name)),anonymous:async url=>{const r=await fetch(url);if(!r.ok)throw Error('Public download unavailable');return Buffer.from(await r.arrayBuffer());}});
 console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
