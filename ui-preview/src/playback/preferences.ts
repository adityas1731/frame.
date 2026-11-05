import {fonts,fontFamily,type FontId} from '../appearance/fonts.ts';
export type CaptionFont=FontId;
export interface CaptionPreferences {version:2;font:CaptionFont;size:number;background:boolean;opacity:number}
export function captionAppearance(value:CaptionPreferences){return{fontFamily:fontFamily(value.font),backgroundColor:`rgba(0, 0, 0, ${value.background?value.opacity/100:0})`};}
export function captionPreferences(value:unknown):CaptionPreferences{
 const raw=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const legacy=raw.version!==2?({sans:'system',serif:'editorial',rounded:'humanist'} as Record<string,string>)[String(raw.font)]:undefined;
 const font=legacy??String(raw.font);
 return{version:2,font:fonts.some(option=>option.id===font)?font as CaptionFont:'system',size:[90,100,120].includes(Number(raw.size))?Number(raw.size):100,background:typeof raw.background==='boolean'?raw.background:raw.style!=='netflix',opacity:typeof raw.opacity==='number'&&Number.isFinite(raw.opacity)?Math.max(0,Math.min(100,raw.opacity)):50};
}
export function loadCaptionPreferences():CaptionPreferences{try{return captionPreferences(JSON.parse(localStorage.getItem('frame-caption-preferences')??'{}'));}catch{return captionPreferences({});}}
export function saveCaptionPreferences(value:CaptionPreferences){try{localStorage.setItem('frame-caption-preferences',JSON.stringify(captionPreferences(value)));}catch{/* Nonessential device preference. */}}
