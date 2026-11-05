import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {readTree,sha256} from './build-inspection.mjs';
import {createArchive,verifyArchive} from './artifact-core.mjs';
const profile=process.argv[2];if(!['release','diagnostics'].includes(profile))throw Error('Choose release or diagnostics.');
const {version}=JSON.parse(await readFile('package.json','utf8'));const sources=new Map();for(const dir of ['src','config','dev','scripts','public','licenses'])for(const [name,data] of await readTree(dir))sources.set(`${dir}/${name}`,data);for(const file of ['package.json','package-lock.json','vite.config.ts','tsconfig.json','index.html'])sources.set(file,await readFile(file));
const sourceFingerprint=sha256(Buffer.concat([...sources].sort(([a],[b])=>a.localeCompare(b)).flatMap(([name,data])=>[Buffer.from(name+'\0'),Buffer.from(sha256(data)+'\n')])));
let sourceCommit=/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA??'')?process.env.GITHUB_SHA:null;try{sourceCommit??=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}if(sourceCommit&&!/^[a-f0-9]{40}$/.test(sourceCommit))sourceCommit=null;if(process.env.CI&&!sourceCommit)throw Error('CI artifacts require a source commit.');
const archive=createArchive(await readTree(`dist/${profile}`),{profile,version,sourceCommit,sourceFingerprint});const report=verifyArchive(archive,profile);const name=`frame-${version}-${sourceCommit?.slice(0,12)??sourceFingerprint.slice(0,12)}-${profile}-${report.sha256.slice(0,12)}.tar.gz`;
await mkdir('artifacts',{recursive:true});try{await writeFile(`artifacts/${name}`,archive,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||sha256(await readFile(`artifacts/${name}`))!==report.sha256)throw error;}
await writeFile(`artifacts/${name}.sha256`,report.sha256+'  '+name+'\n');console.log(JSON.stringify({...report,path:`artifacts/${name}`},null,2));
