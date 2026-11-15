import type {Phase} from './foundation.ts';
export interface PresentationMedia {phase:Phase;paused:boolean;hasPlan:boolean;error:boolean;choosing:boolean;sessionId?:string}
export interface PlayerPresentation {
 media:PresentationMedia;surface:'controls'|'hidden'|'pause';
 panel:'none'|'settings'|'episodes';input:'pointer'|'keyboard';
 activity:number;entry:'resume'|'restart'|null;
 resumeSession?:string;leaving:boolean;
}
export type PresentationEvent=
 | {type:'media';media:PresentationMedia}
 | {type:'activity';input?:'pointer'|'keyboard'}
 | {type:'idle';activity:number;keyboardFocus:boolean}
 | {type:'pause-idle';activity:number;keyboardFocus?:boolean}
 | {type:'settings'} | {type:'close-settings'} | {type:'episodes'} | {type:'close-episodes'}
 | {type:'entry';entry:'resume'|'restart'} | {type:'leave'};
export function initialPresentation(settings=false):PlayerPresentation{return {media:{phase:'idle',paused:true,hasPlan:false,error:false,choosing:false},surface:'controls',panel:settings?'settings':'none',input:'pointer',activity:0,entry:null,leaving:false};}
export function canPauseIdle(state:PlayerPresentation){const m=state.media;return !state.leaving&&state.panel==='none'&&!m.choosing&&!m.error&&m.hasPlan&&m.paused&&['paused','ready'].includes(m.phase);}
export function canHideControls(state:PlayerPresentation){const m=state.media;return !state.leaving&&state.panel==='none'&&!m.choosing&&!m.error&&m.hasPlan&&!m.paused&&m.phase==='playing';}
export function shouldResumeEpisodeBrowser(state:PlayerPresentation,media:PresentationMedia){return state.panel==='episodes'&&!!state.resumeSession&&state.resumeSession===media.sessionId&&media.paused&&!media.error&&['paused','ready'].includes(media.phase);}
export function presentationTransition(state:PlayerPresentation,event:PresentationEvent):PlayerPresentation {
 if(state.leaving)return state;
 const wake=(patch:Partial<PlayerPresentation>={}):PlayerPresentation=>({...state,...patch,surface:'controls',activity:state.activity+1});
 switch(event.type){
  case 'media':{
   if(Object.keys(event.media).every(key=>event.media[key as keyof PresentationMedia]===state.media[key as keyof PresentationMedia]))return state;
   const resumeSession=event.media.sessionId===state.resumeSession&&!['ended','failed','disposed'].includes(event.media.phase)?state.resumeSession:undefined;
   return wake({media:event.media,resumeSession});
  }
  case 'activity':return wake({input:event.input??state.input});
  case 'idle':return event.activity===state.activity&&canHideControls(state)&&!(state.input==='keyboard'&&event.keyboardFocus)?{...state,surface:'hidden'}:state;
  case 'pause-idle':return event.activity===state.activity&&canPauseIdle(state)&&!(state.input==='keyboard'&&event.keyboardFocus)?{...state,surface:'pause'}:state;
  case 'settings':return wake({panel:'settings',resumeSession:undefined});
  case 'close-settings':return state.panel==='settings'?wake({panel:'none'}):state;
  case 'episodes':return wake({panel:'episodes',resumeSession:state.media.phase==='playing'&&!state.media.paused?state.media.sessionId:undefined});
  case 'close-episodes':return state.panel==='episodes'?wake({panel:'none',resumeSession:undefined}):state;
  case 'entry':return wake({entry:event.entry});
  case 'leave':return wake({leaving:true,panel:'none',resumeSession:undefined});
 }
}
