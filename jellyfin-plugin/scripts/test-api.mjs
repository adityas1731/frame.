import {readFile,writeFile} from 'node:fs/promises';
export const base='http://127.0.0.1:18096'+(process.env.FRAME_TEST_BASE==='/jellyfin'?'/jellyfin':'');
export const session=JSON.parse(await readFile(new URL('../.test-instance/session.json',import.meta.url),'utf8'));
export async function api(route,method='GET',body){const r=await fetch(base+'/'+route,{method,headers:{Authorization:`MediaBrowser Client="Frame QA", Device="Isolated", DeviceId="frame-isolated-qa", Version="0.1.0", Token="${session.token}"`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error(`Disposable API ${route.split('?')[0]} status ${r.status}`);const text=await r.text();return text?JSON.parse(text):null;}
const info=await api('System/Info/Public');if(info.Id!==session.serverId||info.ServerName!=='Frame isolated QA'||info.Version!=='12.3.0')throw Error('Refusing unrecognized server');
