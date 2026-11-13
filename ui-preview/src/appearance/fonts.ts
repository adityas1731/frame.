export const fontPresets = [
 {id:'system',label:'System sans',family:'system-ui, sans-serif'},
 {id:'humanist',label:'Humanist sans',family:'"Trebuchet MS", sans-serif'},
 {id:'editorial',label:'Classic serif',family:'Georgia, serif'},
 {id:'rounded',label:'Clear sans',family:'Verdana, sans-serif'},
 {id:'mono',label:'Studio mono',family:'Consolas, monospace'},
] as const;

export const fonts = [...fontPresets, {id:'custom',label:'Custom installed font',family:'var(--custom-font), system-ui, sans-serif'}] as const;
export type FontId = typeof fonts[number]['id'];
export function fontFamily(id:FontId){return fonts.find(font=>font.id===id)?.family??fonts[0].family;}

/** A single installed family name, never a CSS declaration or remote URL. */
export function validFontName(name:string){return /^[\p{L}\p{N} ._'\-]{1,80}$/u.test(name)&&!!name.trim();}
export function customFontFamily(name:string){return validFontName(name)?JSON.stringify(name.trim()):'system-ui';}
export async function installedFontAvailable(name:string):Promise<boolean|null>{
  if(!validFontName(name))return false;
  if(typeof FontFace==='undefined')return null;
  // document.fonts.check can accept unknown families through browser fallback.
  try{await new FontFace('frame-font-check',`local(${JSON.stringify(name.trim())})`).load();return true;}catch{return false;}
}
