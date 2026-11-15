/** Shared by discovery and local processing: never offer a known oversized decode. */
export function supportedArtworkDimensions(width:number,height:number){
  return Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width<=16384&&height<=16384&&width*height<=40000000;
}
