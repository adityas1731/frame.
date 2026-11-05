import {readFile,writeFile} from 'node:fs/promises';
import {config,root} from './frame-core.mjs';
import path from 'node:path';
const check=process.argv.includes('--check');
for(const name of ['package.json','package-lock.json']){const file=path.join(root,'ui-preview',name),text=await readFile(file,'utf8'),value=JSON.parse(text);const semver=config.version.split('.').slice(0,3).join('.');if(check){if(value.version!==semver||(name==='package-lock.json'&&value.packages[''].version!==semver))throw Error('Version drift: '+name);}else{value.version=semver;if(value.packages)value.packages[''].version=semver;await writeFile(file,JSON.stringify(value,null,2)+'\n');}}
console.log('Version synchronized: '+config.version+' (npm uses the first three fields; build metadata records all four)');
