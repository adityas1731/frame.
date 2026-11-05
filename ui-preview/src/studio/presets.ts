import {atmosphereFromSeed,readableAccent} from '../appearance/palette.ts';
import type {Appearance} from './model';
export const atmospherePresets = [
 {id:'graphite',label:'Graphite',canvas:'#101111',surface:'#191c1d'},
 {id:'midnight',label:'Midnight',canvas:'#0d1420',surface:'#172333'},
 {id:'forest',label:'Forest',canvas:'#101c17',surface:'#1b2c23'},
 {id:'plum',label:'Plum',canvas:'#1c1420',surface:'#2b2031'},
 {id:'ocean',label:'Ocean',canvas:'#0b1c24',surface:'#163642'},
 {id:'espresso',label:'Espresso',canvas:'#211914',surface:'#382a21'},
 {id:'slate',label:'Slate',canvas:'#1b2029',surface:'#2d3543'},
 {id:'obsidian',label:'Obsidian',canvas:'#09090c',surface:'#19191f'},
] as const;
export const accentPresets = {amber:'#e6a039',sage:'#c6e5a2',blue:'#a8c9f0',rose:'#e5b2be',lavender:'#c9b7f5',teal:'#7ddbd0',coral:'#ffad94',silver:'#d6dce5'} as const;

/** Resolve independent atmosphere and accent choices without changing the saved palette. */
export function resolvePalette(a:Appearance,theme:string,accent:string):Appearance{
 const preset=atmospherePresets.find(p=>p.id===theme)??atmospherePresets[0];
 const colors=a.enabled?atmosphereFromSeed(a.atmosphereSeed??a.background):{background:preset.canvas,surface:preset.surface,text:'#f5f4f0',secondary:'#b6bab8'};
 const selected=a.accentCustom?a.accent:accentPresets[accent as keyof typeof accentPresets]??accentPresets.amber;
 return {...a,...colors,accent:readableAccent(selected,colors.background,colors.surface)};
}
