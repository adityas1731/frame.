export const resolutionLimits=[480,720,1080,1440,2160] as const;
/** Both dimensions cap the frame, preserving aspect ratio on the server. Zero means Auto. */
export function resolutionCap(value?:number){if(!value||!resolutionLimits.includes(value as typeof resolutionLimits[number]))return undefined;return {height:value,width:({480:854,720:1280,1080:1920,1440:2560,2160:3840} as Record<number,number>)[value]};}
export function resolutionOptions(width?:number,height?:number){return resolutionLimits.filter(value=>{const cap=resolutionCap(value)!;return !width||!height||width>=cap.width||height>=cap.height;});}
export function frameDimensions(width?:number,height?:number){return width&&height&&width>0&&height>0?`${width} × ${height}`:undefined;}

/** Use decoded dimensions, including cropped cinema frames; never infer from the source or selected cap. */
export function resolutionLabel(height?:number,width?:number){
 if(!height||!Number.isFinite(height)||height<=0)return undefined;
 if(width&&Number.isFinite(width)&&width>0){
  const ratio=width/height;
  if(ratio>=1.3&&ratio<=2.6){
   const tier=[...resolutionLimits].reverse().find(value=>{const cap=resolutionCap(value)!;return width>=cap.width*.97&&width<=cap.width*1.08&&height<=cap.height*1.08&&height>=cap.height*.65;});
   if(tier)return `${tier}p`;
  }
 }
 return `${Math.round(height)}p`;
}
export function bitrateLabel(bits?:number){return bits&&Number.isFinite(bits)&&bits>0?`${Number((bits/1_000_000).toFixed(1))} Mbps`:undefined;}
