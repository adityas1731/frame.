import {readTree,inspectFiles} from './build-inspection.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const profiles=process.argv[2]?[process.argv[2]]:['diagnostics','release'];
const results=[];for(const profile of profiles){if(!['release','diagnostics'].includes(profile))throw Error('Unknown profile');const report=inspectFiles(await readTree(`dist/${profile}`),profile);results.push(report);console.log(`${profile}: ${report.files} files, ${report.bytes} bytes, Diagnostics ${report.diagnostics?'included':'absent'}`);}
await mkdir('reports',{recursive:true});await writeFile(`reports/build-verification-${profiles.join('-')}.json`,JSON.stringify(results,null,2));
