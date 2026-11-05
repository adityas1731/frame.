import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const config=JSON.parse(await readFile(new URL('../frame.json',import.meta.url)));
export function version(value){if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)||value.split('.').some(n=>Number(n)>65534))throw Error('Expected four-part assembly version');return value;}
version(config.version);
export function sourceIdentity(){let commit=null,dirty=true;try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();dirty=!!execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8'}).trim();}catch{}if(commit&&!/^[a-f0-9]{40}$/.test(commit))throw Error('Invalid source commit');if(process.env.CI&&(!commit||dirty))throw Error('CI requires an exact clean commit');return{commit,dirty};}
export function validateRelease(manifest,expected){
 if(manifest.format!=='frame-release-v1'||manifest.status!=='verified'||manifest.profile!=='release'||manifest.internal!==false)throw Error('Not a verified release');
 version(manifest.version);
 for(const field of ['version','sha256','sourceCommit'])if(expected[field]!==manifest[field])throw Error('Release approval mismatch: '+field);
 if(!/^[a-f0-9]{64}$/.test(manifest.sha256)||!manifest.sourceCommit||manifest.sourceDirty||manifest.targetAbi!==config.jellyfinAbi||manifest.superseded)throw Error('Uncommitted, superseded or incompatible release');
 if(manifest.fileName!==`frame-jellyfin-${manifest.version}-release-${manifest.sha256.slice(0,12)}.zip`||path.basename(manifest.fileName)!==manifest.fileName)throw Error('Unexpected artifact name');
 if(!manifest.tests?.passed||manifest.tests.failed!==0)throw Error('Tests not passed');
 return true;
}
