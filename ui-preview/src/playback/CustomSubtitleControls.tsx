import {useEffect,useRef,useState} from 'react';
import {subtitleFromFile,subtitleFromUrl,SubtitleInputError,type CustomSubtitle} from './customSubtitles';

export function CustomSubtitleControls({disabled,load}:{disabled:boolean;load?:(value:CustomSubtitle)=>Promise<void>}){
 const file=useRef<HTMLInputElement>(null),request=useRef<AbortController|null>(null);
 const [urlOpen,setUrlOpen]=useState(false),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>()=>request.current?.abort(),[]);
 async function read(source:File|string){
  request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError('');
  try{const subtitle=typeof source==='string'?await subtitleFromUrl(source,controller.signal):await subtitleFromFile(source);if(controller.signal.aborted)return;await load?.(subtitle);if(controller.signal.aborted)return;setUrl('');setUrlOpen(false);}
  catch(error){if(!controller.signal.aborted)setError(error instanceof SubtitleInputError?error.message:'Could not load this subtitle. Try another file.');}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 return <div className="custom-subtitle-controls">
  <input ref={file} hidden type="file" accept=".srt,.vtt" aria-label="Choose subtitle file" onChange={e=>{const selected=e.target.files?.[0];e.target.value='';if(selected)void read(selected);}}/>
  <div className="custom-subtitle-actions"><button type="button" disabled={disabled||busy||!load} onClick={()=>file.current?.click()}>Load Subtitle File</button><button type="button" disabled={disabled||busy||!load} aria-expanded={urlOpen} onClick={()=>{setUrlOpen(!urlOpen);setError('');}}>Load From URL</button></div>
  {urlOpen&&<form className="subtitle-url-form" onSubmit={e=>{e.preventDefault();if(url.trim()&&!busy)void read(url);}}><label>Subtitle URL<input type="url" required value={url} onChange={e=>setUrl(e.target.value)} autoComplete="off" spellCheck={false} disabled={busy}/></label><button type="submit" disabled={busy||!url.trim()}>Load</button><p>A direct HTTPS SRT or VTT link. The host must allow browser access.</p></form>}
  {busy&&<p role="status">Loading Subtitles…</p>}{error&&<p role="alert">{error}</p>}
  <small>SRT or VTT, up to 2 MB. Loaded temporarily.</small>
 </div>;
}
