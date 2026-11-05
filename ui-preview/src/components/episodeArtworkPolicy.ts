import type {ItemDto} from '../jellyfin/types.ts';
/** Series posters are never evidence of an individual episode still. */
export function episodeArtworkCandidates(item:ItemDto){
 const candidates:('Thumb'|'Primary')[]=[];
 if(item.ImageTags?.Thumb)candidates.push('Thumb');
 if(item.ImageTags?.Primary&&(item.PrimaryImageAspectRatio===undefined||item.PrimaryImageAspectRatio>=1.3))candidates.push('Primary');
 return candidates;
}
export function episodeArtworkSource(item:ItemDto){return episodeArtworkCandidates(item)[0]??null;}
/** Assess decoded pixels, not requested width. Upscaling cannot add detail. */
export function preferEpisodeStill(localWidth:number|undefined,onlineAvailable:boolean){
 return onlineAvailable&&localWidth!==undefined&&localWidth>0&&localWidth<960;
}
export function serverArtworkWidth(item:ItemDto,backdrop:boolean,artwork:string|undefined,displayWidth=1920,pixelRatio=1){
 return backdrop||artwork==='Thumb'||item.Type==='Episode'?Math.min(3840,Math.max(1920,Math.ceil(displayWidth*Math.min(pixelRatio||1,2)))):480;
}
