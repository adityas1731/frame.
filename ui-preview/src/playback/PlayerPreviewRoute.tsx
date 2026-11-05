import type {PlayerTab} from './PlayerSettings';
import type {SegmentInfo} from './segments';
import {Player} from './Player';
import {previewItem,previewSnapshot,previewControls} from './uiPreview';
import {useSearchParams} from 'react-router';
import type {ItemDto} from '../jellyfin/types';
const preview={item:previewItem,snapshot:previewSnapshot,controls:previewControls};
const resumePreview={item:{...previewItem,RunTimeTicks:88880000000,UserData:{PlaybackPositionTicks:1200000000}},snapshot:()=>({...previewSnapshot(),position:120}),controls:previewControls};
const episodePreview={...resumePreview,item:{...resumePreview.item,Type:'Episode',Name:'First Light',SeriesName:'The Last Horizon',ParentIndexNumber:1,IndexNumber:2} as ItemDto};
const skippingPreview={...preview,initialTab:'skipping' as PlayerTab,segmentInfo:{status:'ready',segments:[{type:'Outro',start:8800,end:8888,key:'synthetic-credits'}]} as SegmentInfo};
const introButtonPreview={...preview,segmentInfo:{status:'ready',segments:[{type:'Intro',start:0,end:90,key:'synthetic-intro'}]} as SegmentInfo};
const creditsButtonPreview={...preview,snapshot:()=>({...previewSnapshot(),position:8810}),segmentInfo:skippingPreview.segmentInfo};
const endedPreview={...preview,item:{...episodePreview.item,SeriesId:'preview-series',UserData:undefined},snapshot:()=>({...previewSnapshot(),phase:'ended' as const,position:8888,paused:true,captions:[]})};
export default function PlayerPreviewRoute(){const [params]=useSearchParams();const mode=params.get('resume'),skip=params.get('skip');return <Player key={skip??mode??'player'} itemId={`ui-preview-${skip??mode??'player'}`} preview={params.has('ended')?endedPreview:skip==='intro'?introButtonPreview:skip==='credits'?creditsButtonPreview:params.get('panel')==='skipping'?skippingPreview:mode==='episode'?episodePreview:mode?resumePreview:preview}/>;}
