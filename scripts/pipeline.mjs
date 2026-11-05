import {spawnSync} from 'node:child_process';
import {config,root} from './frame-core.mjs';
import path from 'node:path';
const requested=process.argv[2]??'both';if(!['release','diagnostics','both'].includes(requested))throw Error('Choose release, diagnostics or both');
if(process.version!=='v'+config.node)throw Error('Use pinned Node '+config.node);
const dotnet=process.env.FRAME_DOTNET??'dotnet';
function run(cmd,args,cwd=root){const p=spawnSync(cmd,args,{cwd,stdio:'inherit'});if(p.error||p.status!==0)throw Error('Build/check failed');}
run(process.execPath,['scripts/sync-version.mjs','--check']);
run(process.execPath,['--test','scripts/catalog.test.mjs','scripts/package-policy.test.mjs','scripts/source-fingerprint.test.mjs']);
run(process.execPath,['--test','publication/publish.test.mjs']);
run(dotnet,['run','--project','jellyfin-plugin/tests/Frame.HostTests.csproj','-c','Release','-p:RestoreLockedMode=true']);
for(const profile of requested==='both'?['release','diagnostics']:[requested]){
 if(process.platform==='win32')run(process.env.ComSpec??'cmd.exe',['/d','/s','/c','npm run validate:'+profile],path.join(root,'ui-preview'));
 else run('npm',['run','validate:'+profile],path.join(root,'ui-preview'));
 run(process.execPath,['jellyfin-plugin/scripts/build-package.mjs',profile]);
}
