import {parseCustomSubtitle,type CustomSubtitle} from '../playback/customSubtitles.ts';

export interface SubtitleSaveOptions {language:string;forced:boolean;hearingImpaired:boolean;confirmed:boolean}
/** Fixed format and language validation keep filenames/paths out of the upload contract. */
export function subtitleUploadBody(subtitle:CustomSubtitle,options:SubtitleSaveOptions){
 if(options.confirmed!==true)throw new Error('Review the title and confirm before saving.');
 const language=options.language.trim().toLowerCase();
 if(!/^[a-z]{2,3}$/.test(language))throw new Error('Enter a two or three letter subtitle language code.');
 if(typeof options.forced!=='boolean'||typeof options.hearingImpaired!=='boolean')throw new Error('Choose valid subtitle options.');
 const normalized=parseCustomSubtitle(new TextEncoder().encode(subtitle.vtt),'upload.vtt');
 const bytes=new TextEncoder().encode(normalized.vtt);let binary='';
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {Language:language,Format:'vtt' as const,IsForced:options.forced,IsHearingImpaired:options.hearingImpaired,Data:btoa(binary)};
}
