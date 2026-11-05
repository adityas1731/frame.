/** Memory-only, bounded diagnostic events. Never accept raw payloads, URLs or errors. */
export type DiagnosticStage = 'attempt'|'capabilities'|'negotiation-request'|'negotiation-response'|'source'|'plan'|'fallback'|'gateway'|'hls-error'|'media-error'|'playing'|'waiting'|'metadata'|'failed'|'cleanup'|'report-failed'|'captions';
export interface DiagnosticEvent {elapsedMs:number;stage:DiagnosticStage;facts:Record<string,boolean|number|string>}
const numeric=/* @__PURE__ */ new Set(['attempt','status','sources','sourceNumber','videoTracks','audioTracks','subtitleTracks','maxBitrate','startSeconds','duration','readyState','networkState','mediaCode','activeCues','firstCueStart','lastCueStart','lastCueEnd','bitDepth','channels','width','height']);
const boolean=/* @__PURE__ */ new Set(['mseHls','nativeHls','secureContext','serviceWorker','forceTranscode','directPlay','directStream','transcoding','playlist','requiresOpening','fatal','authorized','h264','aac','engineLoaded','engineLoadFailed','mediaSourceAvailable','progressiveWebm']);
const choices:Record<string,readonly string[]>={videoCodec:['h264','hevc','h265','vp8','vp9','av1','mpeg2video','unknown'],audioCodec:['aac','mp3','ac3','eac3','dts','truehd','flac','opus','vorbis','unknown'],mode:['direct','remux','transcode'],protocol:['http','hls','unknown'],container:['mp4','m4v','webm','mkv','ts','unknown'],reason:['playlist','segment','decoding','network','stream','timeout','unknown'],category:['api','compatibility','transport','unknown']};
const listeners=/* @__PURE__ */ new Set<()=>void>();
let latest:readonly DiagnosticEvent[]=[];
let owner:PlaybackDiagnostics|undefined;
export function subscribeDiagnostics(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function latestDiagnostics(){return latest;}
export function clearDiagnostics(){owner?.clear();}
const stages=/* @__PURE__ */ new Set(['attempt','capabilities','negotiation-request','negotiation-response','source','plan','fallback','gateway','hls-error','media-error','playing','waiting','metadata','failed','cleanup','report-failed','captions']);
function safeFacts(input:Record<string,unknown>){const facts:DiagnosticEvent['facts']={};for(const [key,value] of Object.entries(input)){if(numeric.has(key)&&typeof value==='number'&&Number.isFinite(value))facts[key]=Math.max(-1,Math.min(1e12,value));else if(boolean.has(key)&&typeof value==='boolean')facts[key]=value;else if(choices[key]&&typeof value==='string')facts[key]=choices[key].includes(value)?value:'unknown';}return facts;}
export class PlaybackDiagnostics {
 constructor(){owner=this;this.share();}
 private share(){if(owner!==this)return;latest=Object.freeze(this.snapshot().map(event=>Object.freeze({...event,facts:Object.freeze(event.facts)})));listeners.forEach(listener=>listener());}
 clear(){this.start=Date.now();this.events=[];this.share();}
 private start=Date.now();private events:DiagnosticEvent[]=[];
 add(stage:DiagnosticStage,input:Record<string,unknown>={}){
  if(!stages.has(stage))return;const facts=safeFacts(input);
  this.events=[...this.events,{elapsedMs:Date.now()-this.start,stage,facts}].slice(-160);this.share();
 }
 snapshot(){return this.events.map(event=>({...event,facts:{...event.facts}}));}
}
export function diagnosticReport(events:readonly DiagnosticEvent[]){return JSON.stringify({format:'frame-playback-diagnostics-v1',generatedAt:new Date().toISOString(),privacy:'No credentials, URLs, titles, item IDs, user IDs or server paths collected. Memory only.',events:events.filter(event=>stages.has(event.stage)).map(event=>({elapsedMs:Number.isFinite(event.elapsedMs)?Math.max(0,Math.min(1e12,event.elapsedMs)):0,stage:event.stage,facts:safeFacts(event.facts)}))},null,2);}
