/** Original Frame streaming URL policy, shared with the service worker and contract tests. */
// API item IDs use compact GUIDs; StreamInfo.ToUrl uses Guid.ToString() (dashed).
// Normalize only valid GUID formats. Never remove punctuation from arbitrary IDs.
export function sameMediaItem(left,right){
 const canonical=value=>{
  if(typeof value!=='string')return null;
  if(/^[a-f0-9]{32}$/i.test(value)||/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value))return value.replaceAll('-','').toLowerCase();
  return null;
 };
 if(typeof left!=='string'||typeof right!=='string')return false;
 return left.toLowerCase()===right.toLowerCase()||canonical(left)!==null&&canonical(left)===canonical(right);
}
export function mediaPathAllowed(path,itemId){
 const parts=path.split('/').filter(Boolean);if(parts[0]?.toLowerCase()!=='videos'||!sameMediaItem(parts[1],itemId))return false;
 const tail=parts.slice(2).join('/');
 return /^(stream\.(mp4|webm|m4v)|master\.m3u8|main\.m3u8)$/i.test(tail)||/^hls1\/[a-z0-9_-]+\/-?\d+\.(ts|mp4|m4s)$/i.test(tail)||/^hls\/[a-z0-9_-]+\/(stream\.m3u8|\d+\.(ts|mp4|m4s))$/i.test(tail)||/^[a-z0-9_-]+\/subtitles\/\d+\/(?:\d+\/)?stream\.vtt$/i.test(tail);
}
export function cleanMediaUrl(raw,base,itemId){
 const root=new URL(base.replace(/\/+$/,'')+'/');
 // Jellyfin's negotiated API paths can begin /videos/ without its configured BaseUrl.
 // Resolve only an already item-validated API path under that base; absolute URLs stay strict.
 const serverRelative=typeof raw==='string'&&raw.startsWith('/')&&!raw.startsWith('//')&&!raw.startsWith(root.pathname)&&mediaPathAllowed(raw.slice(1).split('?')[0],itemId);
 const url=new URL(serverRelative?raw.slice(1):raw,root);
 if(!['http:','https:'].includes(url.protocol)||url.origin!==root.origin||url.username||url.password||url.hash||!url.pathname.startsWith(root.pathname))throw Error('Untrusted media URL');
 const relative=url.pathname.slice(root.pathname.length);
 if(!mediaPathAllowed(relative,itemId))throw Error('Media path outside active item');
 for(const key of [...url.searchParams.keys()])if(/^(api_?key|x-emby-token|access_token|token|authorization)$/i.test(key))url.searchParams.delete(key);
 if(/\.(m3u8|ts|m4s)$/i.test(relative)||relative.includes('/hls1/'))for(const key of [...url.searchParams.keys()])if(/^startTimeTicks$/i.test(key))url.searchParams.delete(key);
 return relative+(url.searchParams.size?'?'+url.searchParams.toString():'');
}
export function gatewayPath(nonce,relative,scope="/"){if(!scope.startsWith("/")||scope.includes("//")||!scope.endsWith("/")||/[?#\\]/.test(scope)||scope.split("/").some(p=>p==="."||p===".."))throw Error("Invalid gateway scope");const extension=relative.split('?')[0].split('.').at(-1);if(!/^(mp4|webm|m4v|m3u8|ts|m4s|vtt)$/.test(extension))throw Error('Invalid media type');return scope+'__frame_media/'+encodeURIComponent(nonce)+'/'+encodeURIComponent(relative)+'/stream.'+extension;}
export function rewritePlaylist(text,upstream,base,itemId,nonce,scope="/"){
 if(!text.trimStart().startsWith('#EXTM3U'))throw Error('Invalid HLS playlist');
 const rewrite=raw=>gatewayPath(nonce,cleanMediaUrl(raw.startsWith('/')&&!raw.startsWith('//')?raw:new URL(raw,upstream).href,base,itemId),scope);
 return text.split(/\r?\n/).map(line=>{
  if(!line.trim())return line;
  if(line.startsWith('#'))return line.replace(/URI="([^"]+)"/g,(_match,uri)=>`URI="${rewrite(uri)}"`);
  return rewrite(line.trim());
 }).join('\n');
}

