import {api} from './test-api.mjs';
import {readdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Jellyfin performs deletion asynchronously after StopEncoding; do not stop the
// test server before its cleanup task has had a bounded opportunity to finish.
let active=[],media=[];
for(let attempt=0;attempt<30;attempt++){
 const sessions=await api('Sessions');active=sessions.filter(s=>/^Frame/.test(s.Client??'')&&s.NowPlayingItem);
 const files=await readdir(new URL('../.test-instance/cache/transcodes/',import.meta.url));media=files.filter(name=>/\.(m3u8|ts|mp4|webm|m4s)$/i.test(name));
 if(!active.length&&!media.length)break;
 await new Promise(resolve=>setTimeout(resolve,1000));
}
assert.equal(active.length,0,'Disposable Frame playback sessions must be stopped');
assert.equal(media.length,0,'Disposable transcode playlists and media must be cleaned up');
const report={activeFramePlaybackSessions:active.length,remainingTranscodeMediaFiles:media.length,productionContacted:false};
await writeFile('docs/relay-0160-cleanup.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
