import {useRef,useState} from 'react';
import type {SubtitleSaveOptions} from '../jellyfin/subtitleUpload';
import {Select} from '../components/Select';

const languages=[['eng','English'],['fra','French'],['pol','Polish'],['dan','Danish'],['fin','Finnish'],['nor','Norwegian'],['swe','Swedish'],['deu','German'],['spa','Spanish'],['und','Unknown']] as const;
const aliases:Record<string,string>={en:'eng',fr:'fra',fre:'fra',pl:'pol',da:'dan',fi:'fin',no:'nor',sv:'swe',de:'deu',ger:'deu',es:'spa'};

export function SaveSubtitleControls({name,language,target,disabled,unavailable,preview=false,save}:{name:string;language?:string;target:string;disabled:boolean;unavailable?:string;preview?:boolean;save?:(options:SubtitleSaveOptions)=>Promise<void>}){
 const initialCode=aliases[language??'']??language??'';
 const [open,setOpen]=useState(false),[code,setCode]=useState(initialCode),[other,setOther]=useState(!!initialCode&&!languages.some(([code])=>code===initialCode)),[forced,setForced]=useState(false),[sdh,setSdh]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[message,setMessage]=useState('');
 const pending=useRef(false);
 async function submit(){
  if(!save||pending.current||!confirmed||disabled)return;
  pending.current=true;setBusy(true);setMessage('');
  try{await save({language:code,forced,hearingImpaired:sdh,confirmed});setSaved(true);setOpen(false);setMessage(preview?'Preview complete. Nothing was uploaded.':'Saved to Jellyfin. It will appear for other clients after Jellyfin refreshes this title. Your current subtitles keep playing.');}
  catch(error){setMessage(error instanceof Error?error.message:'Could not save subtitles. Check the title in Jellyfin before trying again.');setConfirmed(false);}
  finally{pending.current=false;setBusy(false);}
 }
 return <div className="save-subtitle-controls">
  <button type="button" className="save-subtitle-trigger" disabled={disabled||busy||saved||!save||!!unavailable} aria-expanded={open} onClick={()=>setOpen(!open)}>{saved?preview?'Preview Complete':'Saved to Jellyfin':'Save to Jellyfin'}</button>
  {unavailable&&<small>{unavailable}</small>}
  {open&&<form className="save-subtitle-form" onSubmit={e=>{e.preventDefault();void submit();}}>
   <h3>Save Subtitles</h3><p className="subtitle-save-target">{target}</p><small>{name}</small>
   {preview&&<p role="note">UI preview only. No file will be sent to Jellyfin.</p>}
   <fieldset disabled={busy||disabled}><label>Language<Select aria-label="Subtitle language" value={other?'other':code} disabled={busy||disabled} onValueChange={value=>{setOther(value==='other');setCode(value==='other'?'':value);setConfirmed(false);}}><option value="" disabled>Choose Language</option>{languages.map(([code,label])=><option key={code} value={code}>{label}</option>)}<option value="other">Other Language</option></Select></label>
   {other&&<label>Language Code<input aria-label="Subtitle language code" value={code} maxLength={3} pattern="[A-Za-z]{2,3}" required autoComplete="off" spellCheck={false} onChange={e=>{setCode(e.target.value);setConfirmed(false);}}/><small>Enter the two or three letter code for this language.</small></label>}
   <label className="subtitle-save-toggle"><input type="checkbox" checked={forced} onChange={e=>{setForced(e.target.checked);setConfirmed(false);}}/>Forced Subtitles</label>
   <label className="subtitle-save-toggle"><input type="checkbox" checked={sdh} onChange={e=>{setSdh(e.target.checked);setConfirmed(false);}}/>Hearing Impaired / SDH</label>
   <p>Jellyfin stores this file using its library settings. It becomes available to other clients. Existing subtitles are not replaced.</p>
   <label className="subtitle-save-toggle"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Save this file for the title shown above</label>
   <div className="custom-subtitle-actions"><button type="submit" disabled={!confirmed||!code.trim()||busy}>{busy?'Saving…':preview?'Save (Preview)':'Save Subtitle'}</button><button type="button" onClick={()=>{setOpen(false);setConfirmed(false);}}>Cancel</button></div></fieldset>
  </form>}
  {message&&<p role="status">{message}</p>}
 </div>;
}
