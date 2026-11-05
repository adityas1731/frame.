/** Feature detection rather than user-agent matching: iPhone may expose only
 * native video fullscreen, while desktop browsers can fullscreen Frame's UI. */
export type SafariVideo=HTMLVideoElement&{webkitEnterFullscreen?:()=>void;webkitExitFullscreen?:()=>void;webkitDisplayingFullscreen?:boolean};
export function fullscreenAvailable(doc:Pick<Document,'fullscreenEnabled'>,host:Pick<HTMLElement,'requestFullscreen'>|null,video:SafariVideo|null){
 return !!(doc.fullscreenEnabled&&typeof host?.requestFullscreen==='function'||typeof video?.webkitEnterFullscreen==='function');
}
export async function toggleVideoFullscreen(doc:Document,host:HTMLElement|null,video:SafariVideo|null,landscape=false){
 if(video?.webkitDisplayingFullscreen&&video.webkitExitFullscreen){video.webkitExitFullscreen();return 'inline';}
 if(doc.fullscreenElement){await doc.exitFullscreen();return 'inline';}
 if(doc.fullscreenEnabled&&typeof host?.requestFullscreen==='function'){
  try{
   await host.requestFullscreen();
   // Optional enhancement. Unsupported/denied rotation must not undo fullscreen.
   const orientation=globalThis.screen?.orientation as (ScreenOrientation&{lock?:(value:string)=>Promise<void>})|undefined;
   if(landscape&&orientation?.lock)try{await orientation.lock('landscape');}catch{/* Rotate the device when the browser cannot lock orientation. */}
   return 'frame';
  }catch(error){if(typeof video?.webkitEnterFullscreen!=='function')throw error;}
 }
 if(video&&typeof video.webkitEnterFullscreen==='function'){
  if(video.readyState<1)throw Error('Wait for the video to load, then tap fullscreen again.');
  // Called directly from a user gesture, with no asynchronous work on this path.
  video.webkitEnterFullscreen();return 'native';
 }
 throw Error('Fullscreen is unavailable in this browser.');
}
