import {config} from '../../scripts/frame-core.mjs';

export function packageManifest(profile){
 if(!['release','diagnostics'].includes(profile))throw Error('Choose release or diagnostics');
 return {category:'General',changelog:config.releaseNotes+' ('+profile+')',description:'Frame Cinema client with item-scoped media relay',guid:'1c38ef02-2393-4f54-a18b-fcfcbf394d65',name:profile==='release'?'Frame':'Frame Internal',overview:'Open Frame/Web/ on this server',owner:'Frame project',targetAbi:config.jellyfinAbi,version:config.version,status:'Active',autoUpdate:profile==='release',assemblies:['Frame.Jellyfin.dll']};
}
