import {readdir,readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const diagnosticMarkers=['frame-playback-diagnostics-v1','Copy diagnostic report','Playback diagnostics','settings/advanced/diagnostics','diagnostics-panel','diagnostics-summary'];
export async function readTree(root){const files=new Map();async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if((await lstat(full)).isSymbolicLink())throw Error('Artifact symlinks are not supported.');if(entry.isDirectory())await visit(full);else files.set(path.relative(root,full).replaceAll('\\','/'),await readFile(full));}}await visit(root);return files;}
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function inspectFiles(files,profile){
 if(!['release','diagnostics'].includes(profile))throw Error('Unknown build profile.');
 const info=JSON.parse(files.get('build-info.json')?.toString()??'null');
 if(info?.format!=='frame-build-v1'||info.profile!==profile||info.diagnostics!==(profile==='diagnostics'))throw Error('Build profile mismatch.');
 for(const file of ['index.html','favicon.svg','frame-stream-policy.js','frame-stream-sw.js','THIRD-PARTY-NOTICES.md','licenses/hls-js-LICENSE'])if(!files.has(file))throw Error(`Missing runtime asset: ${file}`);
 const text=[...files].filter(([name])=>/\.(?:js|css|html|json)$/.test(name)).map(([,bytes])=>bytes.toString()).join('\n');
 const js=[...files].filter(([name])=>name.endsWith('.js')).map(([,bytes])=>bytes.toString()).join('\n');
 if(!js.includes('Unable To Play This Title')||!js.includes('Playback could not start.'))throw Error('Normal playback UI/error handling is missing.');
 if(profile==='release'){
  for(const marker of diagnosticMarkers)if(text.includes(marker))throw Error(`Diagnostic marker in release: ${marker}`);
  for(const name of files.keys())if(/diagnostics|test-media|fixtures|uiPreview|\.map$/i.test(name))throw Error(`Internal-only asset in release: ${name}`);
 }else for(const marker of diagnosticMarkers)if(!text.includes(marker))throw Error(`Missing internal diagnostic marker: ${marker}`);
 const manifest=JSON.parse(files.get('.vite/manifest.json')?.toString()??'null');if(!manifest?.['index.html']?.isEntry)throw Error('Missing Vite entry manifest.');
 for(const entry of Object.values(manifest))for(const file of [entry.file,...(entry.css??[])])if(!files.has(file))throw Error('Dangling bundle reference.');
 return {profile,diagnostics:info.diagnostics,files:files.size,bytes:[...files.values()].reduce((n,b)=>n+b.length,0),integrity:Object.fromEntries([...files].sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>[name,sha256(bytes)]))};
}
