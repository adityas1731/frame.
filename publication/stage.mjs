import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {repository,verifyFiles} from './publish.mjs';
export async function stage({directory,receipt,revision,owner,confirmation,api,upload}) {
 if(owner!=='adityas1731'||!/^[a-f0-9]{40}$/.test(revision)||confirmation!==`STAGE frame. ${receipt.version} ${revision} ${receipt.binary.sha256}`)throw Error('Exact owner staging confirmation required');
 const repo=await api('');if(repo.full_name!==repository||repo.name!=='frame.')throw Error('Unexpected distribution target');
 await verifyFiles(directory,receipt);
 if(await api(`/releases/tags/${receipt.tag}`,'GET',undefined,true))throw Error('Version already exists; never replace assets');
 const source=receipt.assets.find(a=>a.role==='source'),dependencies=receipt.assets.find(a=>a.role==='dependency-source');
 const url=name=>`https://github.com/${repository}/releases/download/${receipt.tag}/${name}`;
 const body=`Jellyfin 12.3 browser client. Original code GPL-3.0-only.\n\n[Corresponding source](${url(source.name)}) · [Dependency source and notices](${url(dependencies.name)})\n\nBinary SHA-256: ${receipt.binary.sha256}\nOriginal build revision: ${receipt.originalBuildRevision}\nPublic source revision: ${revision}\n\nSee the installation and source-mapping documentation. Browser/Safari limits remain documented.`;
 const draft=await api('/releases','POST',{tag_name:receipt.tag,target_commitish:revision,name:`frame. ${receipt.version}`,draft:true,prerelease:false,body});
 for(const asset of receipt.assets)await upload(draft,asset.name,await readFile(path.join(directory,asset.name)));
 return {draftId:draft.id,publications:0,repository,version:receipt.version};
}
async function main(){
 const [directory,version,revision,confirmation,action='plan']=process.argv.slice(2);
 const receipt=JSON.parse(await readFile('release/'+version+'.json'));await verifyFiles(directory,receipt);
 if(action==='plan'){console.log(JSON.stringify({repository,version,revision,assets:receipt.assets,uploads:0,publications:0},null,2));return;}
 if(action!=='upload')throw Error('Choose plan or upload');
 const gh=(args)=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const owner=gh(['api','user','--jq','.login']).trim();
 async function api(route,method='GET',body,allow404=false){
  try{return JSON.parse(gh(['api','--method',method,'repos/'+repository+route,...(body===undefined?[]:['--input','-'])]));}
  catch(e){if(allow404&&String(e.stderr).includes('HTTP 404'))return null;throw Error('GitHub staging failed');}
 }
 // Body-bearing calls use structured stdin. No shell strings or stored CI token.
 const request=async(route,method='GET',body,allow404=false)=>{
  if(body===undefined)return api(route,method,undefined,allow404);
  return JSON.parse(execFileSync('gh',['api','--method',method,'repos/'+repository+route,'--input','-'],{input:JSON.stringify(body),encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 };
 const result=await stage({directory,receipt,revision,owner,confirmation,api:request,upload:async(draft,name)=>{execFileSync('gh',['release','upload',receipt.tag,path.join(directory,name),'--repo',repository],{stdio:['ignore','pipe','pipe']});}});
 console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
