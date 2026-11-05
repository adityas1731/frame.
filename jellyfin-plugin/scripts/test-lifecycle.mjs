import {api,base} from './test-api.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const action=process.argv[2];const list=await api('Plugins');const plugin=list.find(p=>p.Id?.replaceAll('-','')==='1c38ef0223934f54a18bfcfcbf394d65');if(!plugin)throw Error('Frame test plugin not found');
if(action==='disable'||action==='enable')await api(`Plugins/${plugin.Id}/${plugin.Version}/${action==='disable'?'Disable':'Enable'}`,'POST');else if(action==='uninstall')await api(`Plugins/${plugin.Id}/${plugin.Version}`,'DELETE');else if(action!=='status')throw Error('Invalid lifecycle action');
const report={action,version:plugin.Version,status:action==='status'?plugin.Status:'requested',originalWebStatus:(await fetch(base+'/web/index.html')).status};let events=[];try{events=JSON.parse(await readFile('docs/lifecycle-verification.json','utf8'));}catch{}events.push(report);await writeFile('docs/lifecycle-verification.json',JSON.stringify(events,null,2));console.log(JSON.stringify(report));
