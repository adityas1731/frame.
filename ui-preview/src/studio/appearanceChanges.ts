import type {Appearance} from './model';
export const appearancePreferenceKeys=['episodeSize','font','customFont','textScale','theme','accent'] as const;
type AppearancePreferences=Record<typeof appearancePreferenceKeys[number],string>;
export function appearanceSnapshot(value:Appearance){return [value.enabled,value.enabled?(value.atmosphereSeed??value.background):'',!!value.accentCustom,value.accentCustom?value.accent:'',value.radius,value.spacing,value.poster,value.blur,value.transparency,value.effects];}
export function hasAppearanceChanges(draft:Appearance,saved:Appearance,current:AppearancePreferences,start:AppearancePreferences){return JSON.stringify(appearanceSnapshot(draft))!==JSON.stringify(appearanceSnapshot(saved))||appearancePreferenceKeys.some(key=>current[key]!==start[key]);}
