import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const files=(await Promise.all(['src','scripts','dev','config','public'].map(walk))).flat();
const sources=files.filter(p=>/\.(?:tsx?|m?js|css)$/.test(p));const texts=new Map(await Promise.all(sources.map(async p=>[path.resolve(p).replaceAll('\\','/'),await readFile(p,'utf8')])));
for(const file of ['index.html','vite.config.ts'])texts.set(path.resolve(file).replaceAll('\\','/'),await readFile(file,'utf8'));
const imports=new Map();
for(const [file,code]of texts){const refs=/\.css$/.test(file)?[]:[...code.matchAll(/(?:\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?|\bimport\s*\(\s*)['"]([^'"]+)['"]/g)].map(r=>r[1]);imports.set(file,refs.filter(r=>r.startsWith('.')).flatMap(ref=>{const base=path.resolve(path.dirname(file),ref).replaceAll('\\','/');const match=[base,...['.ts','.tsx','.js','.mjs','.css','/index.ts','/index.tsx'].map(ext=>base+ext)].find(p=>texts.has(p));return match?[match]:[];}));}
const main=path.resolve('src/main.tsx').replaceAll('\\','/'),seen=new Set();function visit(file){if(seen.has(file))return;seen.add(file);for(const dep of imports.get(file)??[])visit(dep);}visit(main);
const reverse=file=>[...imports].filter(([,deps])=>deps.includes(file)).map(([p])=>path.relative(root,p).replaceAll('\\','/'));
const unused=[...texts.keys()].filter(p=>p.includes('/src/')&&!seen.has(p)&&!p.endsWith('.d.ts')).map(p=>({file:path.relative(root,p).replaceAll('\\','/'),referencedBy:reverse(p)}));
const assets=files.filter(p=>p.startsWith('public')&&!/\.d\.ts$/.test(p)).map(p=>({file:p.replaceAll('\\','/'),mentionedBy:[...texts].filter(([,s])=>s.includes(path.basename(p))||s.includes(p.replace(/^public/,''))).map(([p])=>path.relative(root,p).replaceAll('\\','/'))}));
const report={format:'frame-source-audit-v1',roots:['src/main.tsx','scripts/*.test.mjs','vite.config.ts','public/frame-stream-sw.js'],sourceFiles:sources.length,frontendReachable:seen.size,unreachableFromFrontend:unused,assets,notes:['Static literal import graph; tests and public worker edges are reported separately. Dynamic class/URL construction requires manual review. Unreachable is evidence for review, not permission to delete.']};
await mkdir('reports',{recursive:true});await writeFile('reports/source-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({sourceFiles:report.sourceFiles,unreachableFromFrontend:unused,assetsWithoutLiteralRefs:assets.filter(v=>!v.mentionedBy.length).map(v=>v.file)},null,2));
