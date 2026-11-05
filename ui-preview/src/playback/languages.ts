import type {MediaStream} from './protocol.ts';
export const visibleLanguages=['English','French','Polish'] as const;
const approved=new Set(['en','eng','english','fr','fra','fre','french','pl','pol','polish','und','unknown']);
/** Server status labels can be localized independently of a track's real language. */
export function trackLabel(track:MediaStream){
 const label=track.DisplayTitle||[track.Language,track.Title,track.Codec,track.Channels&&`${track.Channels} ch`].filter(Boolean).join(' · ')||`Track ${track.Index}`;
 const translated=label.replace(/प्राथमिक|डिफ़ॉल्ट|डिफॉल्ट/gu,'Default').replace(/जबरन|बाध्य/gu,'Forced');
 // Presentation only. Unrecognized localized annotations do not override
 // Language, Index, defaults, or the source subtitle's actual contents.
 const clean=translated.replace(/[\u0900-\u097f]+/gu,'').replace(/\s*[-·|]\s*(?=[-·|]|$)/g,'').replace(/\s{2,}/g,' ').replace(/^[\s\-·|]+|[\s\-·|]+$/g,'').trim();
 return clean||[track.Language,track.Codec].filter(Boolean).join(' · ')||`Track ${track.Index}`;
}
/** Presentation only: indexes and server defaults remain intact for hidden tracks. */
export function visibleLanguage(track:MediaStream){
 const language=track.Language?.trim().toLowerCase().split(/[-_]/)[0];
 const title=`${track.DisplayTitle??''} ${track.Title??''}`;
 if(/\bhindi\b|हिन्दी|हिंदी/iu.test(title))return false;
 if(language)return approved.has(language);
 if(/\b(?:German|Spanish|Italian|Portuguese|Dutch|Swedish|Danish|Japanese|Korean|Arabic|Ukrainian)\b/i.test(title))return false;
 return true; // Undeclared tracks remain usable without inventing their language.
}
