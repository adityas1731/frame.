import { createContext, useContext } from 'react';
import type { FreeMetadataClient } from './free';
export interface OnlineState { client:FreeMetadataClient|null; simulated:boolean }
export const OnlineContext=createContext<OnlineState|null>(null);
export function useOnline(){const value=useContext(OnlineContext);if(!value)throw new Error('OnlineProvider required');return value;}
