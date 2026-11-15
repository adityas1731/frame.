import {validFontName} from './fonts.ts';
export const savedFontsKey='frame-installed-fonts-v1';
export function fontNames(value:unknown):string[]{
 if(!Array.isArray(value))return [];
 const names:string[]=[];
 for(const name of value){if(typeof name!=='string'||!validFontName(name))continue;const clean=name.trim().replace(/ +/g,' ');if(!names.some(value=>value.toLocaleLowerCase()===clean.toLocaleLowerCase()))names.push(clean);if(names.length===20)break;}
 return names;
}
export function readSavedFonts():string[]{try{return fontNames(JSON.parse(localStorage.getItem(savedFontsKey)??'[]'));}catch{return [];}}
export function saveFontName(name:string,remove=false){
 const previous=readSavedFonts(),key=name.trim().replace(/ +/g,' ').toLocaleLowerCase();
 const next=remove?previous.filter(value=>value.toLocaleLowerCase()!==key):fontNames([name,...previous]);
 try{localStorage.setItem(savedFontsKey,JSON.stringify(next));window.dispatchEvent(new Event('frame:saved-fonts'));return true;}catch{return false;}
}
