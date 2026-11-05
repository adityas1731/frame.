export const resolutionLimits=[480,720,1080,1440,2160] as const;
/** Both dimensions cap the frame, preserving aspect ratio on the server. Zero means Auto. */
export function resolutionCap(value?:number){if(!value||!resolutionLimits.includes(value as typeof resolutionLimits[number]))return undefined;return {height:value,width:({480:854,720:1280,1080:1920,1440:2560,2160:3840} as Record<number,number>)[value]};}
export function resolutionOptions(width?:number,height?:number){return resolutionLimits.filter(value=>{const cap=resolutionCap(value)!;return !width||!height||width>=cap.width||height>=cap.height;});}
export function frameDimensions(width?:number,height?:number){return width&&height&&width>0&&height>0?`${width} × ${height}`:undefined;}
