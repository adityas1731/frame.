import {useEffect,useState,type ReactNode} from 'react';
import {useConnection} from '../jellyfin/useConnection';
import {contrast,defaultStudio,migrateLegacyHome,normalizeStudio,type Appearance,type StudioConfig} from './model';
import {resolvePalette} from './presets';
import {usePreview} from '../state/PreviewContext';
// Keep context identity outside this refreshable component module.
import {StudioContext,type Preset} from './context';
function read(scope:string):{config:StudioConfig;presets:Preset[]}{try{const saved=JSON.parse(localStorage.getItem(scope)??'null');const legacy=!saved&&scope.endsWith(':demo')?JSON.parse(localStorage.getItem('frame.preview.v1')??'null')?.preferences?.homeSections:undefined;return{config:saved?normalizeStudio(saved.config):migrateLegacyHome(legacy),presets:Array.isArray(saved?.presets)?saved.presets.slice(0,8).filter((p:any)=>typeof p?.name==='string').map((p:any)=>({name:p.name.slice(0,60),config:normalizeStudio(p.config)})):[] as Preset[]};}catch{return{config:defaultStudio(),presets:[] as Preset[]};}}
export function StudioProvider({children}:{children:ReactNode}){const {session}=useConnection();const scope=session?`frame.studio.v1:${encodeURIComponent(session.baseUrl)}:${encodeURIComponent(session.server.Id)}:${encodeURIComponent(session.user.Id)}`:'frame.studio.v1:demo';return <ScopedStudio key={scope} scope={scope}>{children}</ScopedStudio>;}
function ScopedStudio({scope,children}:{scope:string;children:ReactNode}){
 const [saved,setSaved]=useState(()=>read(scope));const [history,setHistory]=useState<StudioConfig[]>([]);const [draft,setDraft]=useState<Appearance|null>(null);const [storageError,setStorageError]=useState('');const {preferences}=usePreview();
 useEffect(()=>{try{localStorage.setItem(scope,JSON.stringify(saved));setStorageError('');}catch{setStorageError('Browser storage is unavailable or full. Changes work for this session but may not survive reload.');}},[scope,saved]);
 const a=draft??saved.config.appearance;
 useEffect(()=>{
  const style=document.documentElement.style;
  const palette=resolvePalette(a,preferences.theme,preferences.accent);
  const safeAccent=palette.accent;
  if(a.enabled){for(const [key,value] of Object.entries({'--canvas':palette.background,'--surface':palette.surface,'--surface-hover':`color-mix(in srgb,${palette.surface} 85%,${palette.text})`,'--surface-strong':`color-mix(in srgb,${palette.surface} 75%,${palette.text})`,'--text':palette.text,'--muted':palette.secondary,'--subtle':palette.secondary}))style.setProperty(key,value);}
  for(const [key,value] of Object.entries({'--accent':safeAccent,'--accent-ink':contrast(safeAccent,'#101111')>=contrast(safeAccent,'#ffffff')?'#101111':'#ffffff','--accent-tint':safeAccent+'20'}))style.setProperty(key,value);
  for(const [key,value] of Object.entries({'--radius':`${a.radius}px`,'--grid-gap':`${a.spacing}px`,'--poster-width':`${a.poster}px`,'--grid-min':`${a.poster}px`}))style.setProperty(key,value);
  Object.assign(document.documentElement.dataset,{studioColors:a.enabled?'custom':'theme',blur:a.blur?'on':'off',transparency:a.transparency?'on':'off',effects:a.effects?'on':'off'});
  return()=>{for(const key of ['--accent','--accent-ink','--accent-tint','--canvas','--surface','--surface-hover','--surface-strong','--text','--muted','--subtle','--radius','--grid-gap','--poster-width','--grid-min'])style.removeProperty(key);for(const key of ['studioColors','blur','transparency','effects'])delete document.documentElement.dataset[key];};
 },[a,preferences.theme,preferences.accent,preferences.density,preferences.posterSize]);
 function update(next:StudioConfig){setHistory(h=>[...h.slice(-19),saved.config]);setSaved(s=>({...s,config:normalizeStudio(next)}));}
 return <StudioContext value={{config:saved.config,scope,storageError,update,undo:()=>{const last=history.at(-1);if(last){setSaved(s=>({...s,config:last}));setHistory(h=>h.slice(0,-1));}},canUndo:!!history.length,reset:()=>update(defaultStudio()),presets:saved.presets,savePreset:name=>setSaved(s=>({...s,presets:[...s.presets.slice(-7),{name:name.trim().slice(0,60)||'My home',config:structuredClone(s.config)}]})),loadPreset:index=>{const preset=saved.presets[index];if(preset)update(preset.config);},removePreset:index=>setSaved(s=>({...s,presets:s.presets.filter((_,i)=>i!==index)})),previewAppearance:setDraft}}>{children}</StudioContext>;
}

