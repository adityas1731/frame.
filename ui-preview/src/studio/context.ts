import {createContext,useContext} from 'react';
import type {Appearance,StudioConfig} from './model';
export interface Preset {name:string;config:StudioConfig}
export interface StudioState {config:StudioConfig;update:(next:StudioConfig)=>void;undo:()=>void;canUndo:boolean;reset:()=>void;scope:string;presets:Preset[];savePreset:(name:string)=>void;loadPreset:(index:number)=>void;removePreset:(index:number)=>void;previewAppearance:(value:Appearance|null)=>void;storageError:string}
export const StudioContext=createContext<StudioState|null>(null);
export function useStudio(){const value=useContext(StudioContext);if(!value)throw Error('StudioProvider required');return value;}
