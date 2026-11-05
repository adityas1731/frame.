import {createContext} from 'react';
import type {PreviewState} from './PreviewContext';
// Stable identity across Vite updates to the provider and appearance schema.
export const PreviewContext=createContext<PreviewState|null>(null);
