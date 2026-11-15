import {InstalledFontField} from '../studio/InstalledFontField';
import {SegmentSettings} from './SegmentSettings';
import {skippingPreferences,type SegmentInfo,type SkippingPreferences} from './segments';
import {visibleLanguage,trackLabel as trackName} from './languages';
import {resolutionLabel,bitrateLabel,resolutionOptions} from './resolution';
import {fonts} from '../appearance/fonts';
import {Select} from '../components/Select';
import {useEffect,useRef,useState} from 'react';
import {Check,X,AudioLines,Captions,SlidersHorizontal,FastForward} from 'lucide-react';
import type {PlayerSnapshot} from './runtime';
import {textSubtitle,type MediaStream,type PlaybackSelection} from './protocol';
import {captionAppearance,type CaptionFont,type CaptionPreferences} from './preferences';
import {subtitleLabel} from './languages';
import {CustomSubtitleControls} from './CustomSubtitleControls';
import type {CustomSubtitle} from './customSubtitles';
import {SaveSubtitleControls} from './SaveSubtitleControls';
import type {SubtitleSaveOptions} from '../jellyfin/subtitleUpload';
export type PlayerTab='audio'|'captions'|'quality'|'skipping';
export function PlayerSettings({state,initialTab,caption,changeCaption,change,sync,close,segmentInfo,skipping,changeSkipping,refreshSegments,loadCustom,selectCustom,removeCustom,selectAdditional,saveCustom,subtitleSaveTarget,subtitleSaveUnavailable,subtitleSavePreview}:{saveCustom?:(options:SubtitleSaveOptions)=>Promise<void>;subtitleSaveTarget?:string;subtitleSaveUnavailable?:string;subtitleSavePreview?:boolean;loadCustom?:(value:CustomSubtitle)=>Promise<void>;selectCustom?:()=>void;removeCustom?:()=>void;selectAdditional?:(id:string)=>void;refreshSegments?:()=>void;segmentInfo?:SegmentInfo;skipping?:SkippingPreferences;changeSkipping?:(value:SkippingPreferences)=>void;state:PlayerSnapshot;initialTab:PlayerTab;caption:CaptionPreferences;changeCaption:(p:CaptionPreferences)=>void;change:(p:Partial<PlaybackSelection>)=>void;sync:(seconds:number)=>void;close:()=>void}){
 const [tab,setTab]=useState(initialTab);useEffect(()=>setTab(initialTab),[initialTab]);const closer=useRef<HTMLButtonElement>(null);useEffect(()=>closer.current?.focus(),[]);useEffect(()=>{if(!closer.current?.closest('section')?.contains(document.activeElement))closer.current?.focus();},[tab]);
 const plan=state.plan,tracks=plan?.source.MediaStreams??[];const audioTracks=tracks.filter(t=>t.Type==='Audio');const audio=audioTracks.filter(visibleLanguage);const subtitles=tracks.filter(t=>t.Type==='Subtitle');
 const activeSubtitle=tracks.find(track=>track.Type==='Subtitle'&&track.Index===plan?.subtitleIndex);const localSelected=state.customSubtitleSelected||!!state.additionalSubtitleSelected;const serverRendered=!localSelected&&!!activeSubtitle&&!textSubtitle(activeSubtitle);
 const selectedText=!!plan?.subtitle||!!localSelected;
 const canSelectSubtitle=(track:MediaStream)=>textSubtitle(track)||state.canHls&&plan?.source.SupportsTranscoding===true&&!plan.source.RequiresOpening;
 const activeAudio=tracks.find(track=>track.Type==='Audio'&&track.Index===plan?.audioIndex);
 const [delayDraft,setDelayDraft]=useState(String(state.subtitleDelay??0));useEffect(()=>setDelayDraft(String(state.subtitleDelay??0)),[state.subtitleDelay,plan?.source.Id,plan?.subtitleIndex]);
 const sourceVideo=plan?.source.MediaStreams.find(track=>track.Type==='Video');const decoded=resolutionLabel(state.videoHeight,state.videoWidth);
 const subtitleValue=state.customSubtitleSelected?'custom':state.additionalSubtitleSelected?`extra:${state.additionalSubtitleSelected}`:plan?.subtitleIndex===-1?'off':`jf:${plan?.subtitleIndex}`;
 function chooseSubtitle(value:string){if(!ready)return;if(value==='off')change({subtitleIndex:-1});else if(value==='custom')selectCustom?.();else if(value.startsWith('extra:'))selectAdditional?.(value.slice(6));else{const track=subtitles.find(t=>`jf:${t.Index}`===value);if(track&&canSelectSubtitle(track))change({subtitleIndex:track.Index});}}
 const ready=!!plan&&!['negotiating','failed'].includes(state.phase);
 // Visibility is presentation only. Alternate tracks retain Jellyfin's indices and
 // use the existing HLS renegotiation path, even when playback is currently direct.
 const audioReady=!!plan&&!!activeAudio&&['ready','playing','paused','buffering','seeking','ended'].includes(state.phase)&&state.canHls&&!plan.source.RequiresOpening&&(plan.source.SupportsDirectStream===true||plan.source.SupportsTranscoding===true);
 const canSelectAudio=(track:MediaStream)=>audioReady&&Number.isSafeInteger(track.Index)&&track.Index>=0&&!!track.Codec?.trim()&&track.Index!==plan?.audioIndex;
 function option(label:string,selected:boolean,action:()=>void,disabled=false,note?:string,key:string|number=label){return <button key={key} className="track-option" role="radio" aria-checked={selected} disabled={disabled} onClick={action}><span><strong>{label}</strong>{note&&<small>{note}</small>}</span>{selected&&<Check size={19}/>}</button>;}
 return <section className="player-settings player-track-panel" aria-label="Playback settings" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')close();if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&(e.target as HTMLElement).getAttribute('role')==='radio'){e.preventDefault();const target=e.target as HTMLButtonElement;const options=Array.from(target.closest('[role=radiogroup]')!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const direction=['ArrowUp','ArrowLeft'].includes(e.key)?-1:1;const next=options[(options.indexOf(target)+direction+options.length)%options.length];next?.focus();next?.click();}}}>
 <header><h2>Playback</h2><button ref={closer} className="player-icon" aria-label="Close playback settings" onClick={close}><X size={20}/></button></header>
 <nav aria-label="Playback options">{([{id:'audio',label:'Audio',Icon:AudioLines},{id:'captions',label:'Subtitles',Icon:Captions},{id:'quality',label:'Quality',Icon:SlidersHorizontal},{id:'skipping',label:'Skipping',Icon:FastForward}] as const).map(({id,label,Icon})=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}><Icon size={17}/>{label}</button>)}</nav>
 {tab==='skipping'&&<SegmentSettings info={segmentInfo} preferences={skipping??skippingPreferences(null)} change={changeSkipping??(()=>{})} refresh={refreshSegments}/>}
 {tab==='audio'&&<>{activeAudio&&!visibleLanguage(activeAudio)&&<p>Current audio uses a track outside the visible language list.{audio.some(canSelectAudio)?' Choose another track to change it.':''}</p>}<div role="radiogroup" aria-label="Audio track">{audio.map(t=>option(trackName(t),t.Index===plan?.audioIndex,()=>{if(canSelectAudio(t))change({audioIndex:t.Index});},!canSelectAudio(t),undefined,t.Index))}</div>{!audio.length&&<p>{audioTracks.length?'No audio tracks in the visible language list.':'No audio tracks returned.'}</p>}<p>{audioTracks.length===1?'This version has one audio track.':'Track changes keep your position. Jellyfin may convert the audio.'}</p></>}
 {tab==='captions'&&<><div className="subtitle-selection">
 <label className="playback-field">Subtitle Track<Select aria-label="Subtitle track" value={subtitleValue} disabled={!ready} onValueChange={chooseSubtitle} menuClassName="playback-select-menu">
 <option value="off">Off</option>
 {!activeSubtitle&&plan&&plan.subtitleIndex!==-1&&!localSelected&&<option value={`jf:${plan.subtitleIndex}`} disabled>Server-selected subtitles</option>}
 {subtitles.map(t=><option key={`jf:${t.Index}`} value={`jf:${t.Index}`} disabled={!canSelectSubtitle(t)}>{subtitleLabel(t)}{!canSelectSubtitle(t)?' · Unavailable':!textSubtitle(t)?' · Rendered in video':''}</option>)}
 {(state.additionalSubtitles??[]).map(t=><option key={t.id} value={`extra:${t.id}`} disabled={!selectAdditional}>{[t.label,t.forced?'Forced':undefined].filter(Boolean).join(' · ')}</option>)}
 {state.customSubtitle&&<option value="custom" disabled={!selectCustom}>Custom · {state.customSubtitle.name}</option>}
 </Select></label>
 {!subtitles.length&&!state.additionalSubtitles?.length&&<p className="playback-hint">No subtitle tracks returned. You can load your own file below.</p>}
 {state.customSubtitle&&<button type="button" className="remove-custom-subtitle" onClick={removeCustom}>Remove Custom Subtitle</button>}
 </div><CustomSubtitleControls disabled={!ready||serverRendered&&(!state.canHls||!plan?.source.SupportsTranscoding)} load={loadCustom}/>
 {state.customSubtitle&&<SaveSubtitleControls key={`${state.customSubtitle.name}:${state.customSubtitle.revision??0}`} name={state.customSubtitle.name} language={state.customSubtitle.language} target={subtitleSaveTarget??'Current title'} disabled={!ready} unavailable={subtitleSaveUnavailable} preview={subtitleSavePreview} save={saveCustom}/>}
 <div className="caption-synchronization"><header><h3>Subtitle Synchronization</h3><button type="button" className="subtitle-delay-reset" disabled={!ready||!selectedText||serverRendered} onClick={()=>sync(0)}>Reset</button></header><fieldset disabled={!ready||!selectedText||serverRendered}><div className="subtitle-delay-actions"><button type="button" onClick={()=>sync((state.subtitleDelay??0)-.5)} aria-label="Show subtitles 0.5 seconds earlier">−0.5</button><button type="button" onClick={()=>sync((state.subtitleDelay??0)-.1)} aria-label="Show subtitles 0.1 seconds earlier">−0.1</button><label><span className="sr-only">Delay in seconds</span><input type="number" aria-label="Subtitle delay in seconds" min={-120} max={120} step={.1} value={delayDraft} onBlur={()=>setDelayDraft(String(state.subtitleDelay??0))} onChange={e=>{setDelayDraft(e.target.value);if(e.target.value!==''&&Number.isFinite(e.target.valueAsNumber))sync(e.target.valueAsNumber);}}/><span className="subtitle-delay-unit" aria-hidden="true">s</span></label><button type="button" onClick={()=>sync((state.subtitleDelay??0)+.1)} aria-label="Show subtitles 0.1 seconds later">+0.1</button><button type="button" onClick={()=>sync((state.subtitleDelay??0)+.5)} aria-label="Show subtitles 0.5 seconds later">+0.5</button></div><output className="sr-only" aria-live="polite">Subtitle delay: {(state.subtitleDelay??0).toFixed(1)} seconds</output></fieldset>{(serverRendered||!selectedText)&&<p className="subtitle-delay-unavailable">Select a text subtitle track to adjust timing.</p>}</div>
 <div className="caption-appearance"><h3>Appearance</h3>{serverRendered&&<p className="caption-rendering-note" role="status">This track is rendered into the video by Jellyfin. Choose a text subtitle track to change its font, size or background. The sample below is a preview only.</p>}<fieldset className="caption-style-controls" disabled={serverRendered}>
 <div className="caption-sample" style={{fontFamily:captionAppearance(caption).fontFamily,fontSize:`${caption.size/100*19}px`}}><span style={captionAppearance(caption)}>This is a subtitle preview.</span></div>
 <label>Font<Select aria-label="Subtitle font" value={caption.font} onValueChange={value=>changeCaption({...caption,font:value as CaptionFont})}>{fonts.map(font=><option key={font.id} value={font.id}>{font.label}</option>)}</Select></label>
 <label>Text Size<Select aria-label="Subtitle text size" value={caption.size} onValueChange={value=>changeCaption({...caption,size:Number(value)})}><option value={90}>Small</option><option value={100}>Standard</option><option value={120}>Large</option></Select></label>
 {caption.font==='custom'&&<div className="caption-custom-font"><InstalledFontField value={caption.customFont??''} onChange={customFont=>changeCaption({...caption,customFont})}/><small>Leave blank to use the custom font from Appearance.</small></div>}
 <label className="caption-background-toggle"><span>Background</span><input aria-label="Subtitle background" type="checkbox" checked={caption.background} onChange={e=>changeCaption({...caption,background:e.target.checked})}/></label>
 <label>Background Opacity <output>{caption.opacity}%</output><input aria-label="Subtitle background opacity" type="range" min={0} max={100} step={5} value={caption.opacity} disabled={!caption.background} onChange={e=>changeCaption({...caption,opacity:Number(e.target.value)})}/></label>
 <p>Applies to text subtitles only. Saved on this device.</p></fieldset></div></>}
 {tab==='quality'&&<div className="playback-quality-settings">
 <div className="playback-resolution"><span>Playing At</span><div><strong title={state.videoWidth&&state.videoHeight?`Decoded frame: ${state.videoWidth} × ${state.videoHeight}`:undefined}>{decoded??'Waiting for video…'}</strong></div></div>
 <label className="playback-field">Resolution<Select aria-label="Playback resolution" value={plan?.selection.maxHeight??0} disabled={!ready||!state.canHls||!plan?.source.SupportsTranscoding} onValueChange={value=>change({maxHeight:Number(value)||undefined,forceTranscode:false})}><option value={0}>Auto</option>{resolutionOptions(sourceVideo?.Width,sourceVideo?.Height).map(height=><option key={height} value={height}>{height}p</option>)}</Select></label>
 <label className="playback-field">Bitrate<Select aria-label="Playback quality" value={plan?.selection.maxBitrate??40000000} disabled={!ready||!state.canHls} onValueChange={value=>change({maxBitrate:Number(value),forceTranscode:false})}>{[40000000,20000000,8000000,4000000,2000000].map(rate=><option key={rate} value={rate}>{bitrateLabel(rate)}{rate===40000000?' · Auto':''}</option>)}</Select></label>
 {plan&&plan.info.MediaSources.length>1&&<label className="playback-field">Version<Select aria-label="Media version" value={plan.source.Id} onValueChange={value=>change({sourceId:value,audioIndex:undefined,subtitleIndex:undefined,maxHeight:undefined,forceTranscode:false})}>{plan.info.MediaSources.map(source=><option key={source.Id} value={source.Id}>{source.Name||source.Container||'Media version'}</option>)}</Select></label>}
 <p className="playback-hint">Lower settings may require transcoding on Jellyfin.</p>
 </div>}


 </section>;
}
