/** Session-only subtitle input. No Jellyfin client, credentials or persistent storage. */
export const MAX_SUBTITLE_BYTES=2*1024*1024;
export interface CustomSubtitle {name:string;language?:string;vtt:string}
export class SubtitleInputError extends Error {}
const stamp=(value:string)=>{
 const match=/^(?:(\d{1,3}):)?(\d{2}):(\d{2})[.,](\d{3})$/.exec(value);
 if(!match||Number(match[2])>59||Number(match[3])>59)return NaN;
 return Number(match[1]??0)*3600+Number(match[2])*60+Number(match[3])+Number(match[4])/1000;
};
const clock=(seconds:number)=>{
 const ms=Math.round(seconds*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
};
export function parseCustomSubtitle(bytes:Uint8Array,name:string):CustomSubtitle {
 if(!bytes.length)throw new SubtitleInputError('This subtitle file is empty.');
 if(bytes.length>MAX_SUBTITLE_BYTES)throw new SubtitleInputError('Choose a subtitle file smaller than 2 MB.');
 const extension=/\.(srt|vtt)$/i.exec(name)?.[1]?.toLowerCase();
 if(!extension)throw new SubtitleInputError('Choose an SRT or VTT subtitle file.');
 let text:string;try{text=new TextDecoder(bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();}catch{throw new SubtitleInputError('Save this subtitle file as UTF-8 and try again.');}
 if(text.includes('\0'))throw new SubtitleInputError('This file does not contain readable subtitles.');
 if(extension==='vtt'){
  if(!/^WEBVTT(?:[ \t][^\n]*)?(?:\n|$)/.test(text))throw new SubtitleInputError('This VTT file is missing its WEBVTT header.');
  text=text.replace(/^WEBVTT[^\n]*(?:\n[^\n]+)*\n\n|^WEBVTT[^\n]*\n?/,'');
 }
 const cues:{start:number;end:number;text:string}[]=[];
 for(const block of text.split(/\n[ \t]*\n/)){
  if(!block.trim()||/^(NOTE|STYLE|REGION)(?:\s|$)/.test(block))continue;
  const lines=block.trim().split('\n');const timing=lines.findIndex(line=>line.includes('-->'));
  if(timing<0||timing>1)throw new SubtitleInputError('Some subtitle cues have missing or invalid timestamps.');
  const match=/^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/.exec(lines[timing]);
  const start=match?stamp(match[1]):NaN,end=match?stamp(match[2]):NaN;
  const body=lines.slice(timing+1).join('\n').trim();
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end>604800||!body||body.length>10000)throw new SubtitleInputError('Some subtitle cues have invalid times or text.');
  cues.push({start,end,text:body});
  if(cues.length>20000)throw new SubtitleInputError('This subtitle file contains too many cues.');
 }
 if(!cues.length)throw new SubtitleInputError('No valid subtitle cues were found.');
 cues.sort((a,b)=>a.start-b.start);
 const language=/(?:^|[._ -])(en|eng|fr|fra|fre|pl|pol|da|dan|fi|fin|no|nor|sv|swe)(?=\.[^.]+$)/i.exec(name)?.[1]?.toLowerCase();
 return {name:name.slice(0,240),language,vtt:'WEBVTT\n\n'+cues.map(c=>`${clock(c.start)} --> ${clock(c.end)}\n${c.text}\n`).join('\n')};
}
export async function subtitleFromFile(file:File){
 if(file.size>MAX_SUBTITLE_BYTES)throw new SubtitleInputError('Choose a subtitle file smaller than 2 MB.');
 return parseCustomSubtitle(new Uint8Array(await file.arrayBuffer()),file.name);
}
export async function subtitleFromUrl(value:string,signal?:AbortSignal,request:typeof fetch=fetch):Promise<CustomSubtitle>{
 let url:URL;try{url=new URL(value.trim());}catch{throw new SubtitleInputError('Enter a direct HTTPS link to an SRT or VTT file.');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||! /\.(srt|vtt)$/i.test(url.pathname))throw new SubtitleInputError('Use a direct HTTPS SRT or VTT link without login details or a fragment.');
 try{
  const response=await request(url.href,{credentials:'omit',mode:'cors',redirect:'error',referrerPolicy:'no-referrer',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
  if(!response.ok)throw new SubtitleInputError(`The subtitle download failed (${response.status}).`);
  const length=response.headers.get('Content-Length');if(length&&Number(length)>MAX_SUBTITLE_BYTES)throw new SubtitleInputError('Choose a subtitle file smaller than 2 MB.');
  if(/html|json/i.test(response.headers.get('Content-Type')??''))throw new SubtitleInputError('This link returned a webpage instead of a subtitle file.');
  if(!response.body)throw new SubtitleInputError('The subtitle download was empty.');
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value:chunk}=await reader.read();if(done)break;size+=chunk.length;if(size>MAX_SUBTITLE_BYTES)throw new SubtitleInputError('Choose a subtitle file smaller than 2 MB.');chunks.push(chunk);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return parseCustomSubtitle(bytes,decodeURIComponent(url.pathname.split('/').at(-1)!));
 }catch(error){if(error instanceof SubtitleInputError)throw error;if(signal?.aborted)throw error;throw new SubtitleInputError('Could not fetch subtitles. The host must allow browser access through CORS. Try downloading the file and loading it here.');}
}
