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
function localAlias(name:string){return 'frame-local-'+Array.from(name.trim()).map(char=>char.codePointAt(0)!.toString(16)).join('-');}
/** An explicit local face also handles installed fonts whose family lookup fails. */
export function installedFontFamily(name:string){return validFontName(name)?`${JSON.stringify(localAlias(name))}, ${customFontFamily(name)}, system-ui, sans-serif`:'system-ui, sans-serif';}
const localLoads=new Map<string,Promise<boolean>>();
export async function installedFontAvailable(name:string):Promise<boolean|null>{
  if(!validFontName(name))return false;
  if(typeof FontFace==='undefined')return null;
  // Checking a detached FontFace alone does not make that face usable by CSS.
  const family=localAlias(name),existing=localLoads.get(family);if(existing)return existing;
  const loading=(async()=>{try{
    // local() resolves face names (full/PostScript), which need not match the
    // family shown by Windows. Static families often expose only "... Regular".
    const label=name.trim().replace(/ +/g,' ');
    const faceName=/^(.*?)\s+(Regular|Thin|ExtraLight|Light|Medium|SemiBold|Bold|ExtraBold|Black)(\s*Italic)?$/i.exec(label);
    const base=faceName?.[1]??label;
    const weights=['Regular','Thin','ExtraLight','Light','Medium','SemiBold','Bold','ExtraBold','Black'];
    const style=faceName?(weights.find(weight=>weight.toLowerCase()===faceName[2].toLowerCase())!+(faceName[3]?'Italic':'')):'Regular';
    const names=[...new Set([label,`${base} ${style}`,`${base.replace(/ /g,'')}-${style}`,...(!faceName?[`${base} Normal`]:[])])];
    const face=await new FontFace(family,names.map(value=>`local(${JSON.stringify(value)})`).join(', ')).load();
    if(typeof document!=='undefined')document.fonts.add(face);
    return true;
  }catch{localLoads.delete(family);return false;}})();
  if(localLoads.size>=64)localLoads.delete(localLoads.keys().next().value!);
  localLoads.set(family,loading);return loading;
}
