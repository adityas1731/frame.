import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {readTree,inspectFiles,sha256} from '../../ui-preview/scripts/build-inspection.mjs';
import {zip,digest} from './zip.mjs';
import {config,sourceIdentity} from '../../scripts/frame-core.mjs';
import {sourceFingerprint} from '../../scripts/source-fingerprint.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),ui=path.resolve(root,'../ui-preview');
const profile=process.argv[2];if(!['release','diagnostics'].includes(profile))throw Error('Choose release or diagnostics');
const identity=sourceIdentity();
const dotnet=process.env.FRAME_DOTNET??'dotnet';
function run(command,args,cwd=root){const result=spawnSync(command,args,{cwd,stdio:'inherit',env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_GENERATE_ASPNET_CERTIFICATE:'false',DOTNET_CLI_HOME:path.join(root,'.toolchain/cli-home'),NUGET_PACKAGES:path.join(root,'.toolchain/nuget')}});if(result.error)throw result.error;if(result.status!==0)throw Error('Build command failed');}
const sdk=spawnSync(dotnet,['--version'],{encoding:'utf8'});if(!/^10\./.test(sdk.stdout??''))throw Error('A .NET 10 SDK is required. Set FRAME_DOTNET to an approved workspace-local SDK executable.');
// The frontend must already have passed its own validation; this build does not install npm packages.
const files=await readTree(path.join(ui,'dist',profile));const inspection=inspectFiles(files,profile);
if(JSON.parse(files.get('build-info.json')).version!==config.version)throw Error('Frontend version differs from canonical release version; rebuild first.');
const staged=path.join(root,'web',profile);if(!staged.startsWith(path.join(root,'web')+path.sep))throw Error('Unsafe stage path');await rm(staged,{recursive:true,force:true});await mkdir(staged,{recursive:true});
for(const [name,data]of files){if(name.startsWith('.vite/'))continue;const target=path.join(staged,name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data);}
const version=config.version;
run(dotnet,['build','src/Frame.Jellyfin.csproj','-c','Release','--nologo','-p:FrameWebRoot='+staged.replaceAll('\\','/')+'/', '-p:FrameVersion='+version,'-p:AssemblyVersion='+version,'-p:Version='+version,'-p:ContinuousIntegrationBuild=true','-p:PathMap='+path.resolve(root,'..').replaceAll('\\','/')+'=/_/frame','-p:RestorePackagesWithLockFile=true','-p:RestoreLockedMode=true']);
// Inspect the actual DLL resources, not only the files that were meant to be embedded.
run(dotnet,['run','--project','inspect/Frame.PackageCheck.csproj','-c','Release','--',path.join(root,'src/bin/Release/net10.0/Frame.Jellyfin.dll'),staged,profile,version]);
const dll=await readFile(path.join(root,'src/bin/Release/net10.0/Frame.Jellyfin.dll'));
// No Jellyfin, framework or dependency DLLs are redistributed. The host supplies its API assemblies.
const meta={category:'General',changelog:config.releaseNotes+' ('+profile+')',description:'Frame Cinema client with item-scoped media relay',guid:'1c38ef02-2393-4f54-a18b-fcfcbf394d65',name:profile==='release'?'Frame':'Frame Internal',overview:'Open Frame/Web/ on this server',owner:'Frame project',targetAbi:config.jellyfinAbi,version,status:'Active',autoUpdate:false,assemblies:['Frame.Jellyfin.dll']};
const packageFiles=new Map([['Frame.Jellyfin.dll',dll],['meta.json',Buffer.from(JSON.stringify(meta,null,2))],['THIRD-PARTY-NOTICES.md',Buffer.concat([await readFile(path.join(ui,'THIRD-PARTY-NOTICES.md')),Buffer.from('\n\n'),await readFile(path.join(root,'THIRD-PARTY-NOTICES.md'))])],['licenses/Jellyfin.Common-GPL-3.0.html',await readFile(path.join(root,'licenses/Jellyfin.Common-GPL-3.0.html'))]]);
packageFiles.set('LICENSE',await readFile(path.resolve(root,'../LICENSE')));
packageFiles.set('SOURCE.md',Buffer.from(`# frame. Corresponding Source\n\nOriginal code: GPL-3.0-only. Copyright (C) 2026 frame. contributors.\n\nExact source commit: ${identity.commit}\n\nSource: https://github.com/adityas1731/frame./tree/${identity.commit}\n\nFor a public release, obtain the matching source ZIP listed in the release receipt alongside this plugin. It includes build scripts, pinned-toolchain configuration, lockfiles and notices. Run node scripts/pipeline.mjs both after restoring locked dependencies. See docs/LICENSING.md and docs/BUILDING.md. Third-party components retain their own licenses.\n`));
// Hash only reviewed Git-eligible source, never ignored local SDKs, evidence or
// historical deployment helpers. Clean committed builds can be traced to Git.
const source=await sourceFingerprint(path.resolve(root,'..'),identity);
const provenance={format:'frame-plugin-v1',profile,version,targetAbi:meta.targetAbi,sourceCommit:identity.commit,sourceDirty:identity.dirty,sourceFingerprint:source.value,sourceFingerprintScheme:source.scheme,sourceFileCount:source.fileCount,sdk:sdk.stdout.trim(),node:process.version,frontend:inspection.integrity,assemblySha256:sha256(dll),files:Object.fromEntries([...packageFiles].map(([name,data])=>[name,sha256(data)]))};packageFiles.set('FRAME-PACKAGE.json',Buffer.from(JSON.stringify(provenance,null,2)));
const bytes=zip(packageFiles),sum=sha256(bytes),name=`frame-jellyfin-${version}-${profile}-${sum.slice(0,12)}.zip`;const output=path.join(root,'artifacts');await mkdir(output,{recursive:true});const archive=path.join(output,name);try{await writeFile(archive,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||sha256(await readFile(archive))!==sum)throw e;}await writeFile(archive+'.sha256',sum+'  '+name+'\n');
const example=[{guid:meta.guid,name:meta.name,overview:meta.overview,description:meta.description,owner:meta.owner,category:'General',versions:[{version,targetAbi:meta.targetAbi,sourceUrl:'https://example.invalid/frame/'+name,checksum:digest(bytes,'md5'),timestamp:'2026-10-26T00:00:00Z',changelog:meta.changelog}]}];await writeFile(path.join(output,'repository-'+profile+'.example.json'),JSON.stringify(example,null,2));console.log(JSON.stringify({archive,sha256:sum,version,profile,hostValidationRecord:'docs/RELEASE-SOURCE.md (validate this exact digest before installation)'},null,2));

