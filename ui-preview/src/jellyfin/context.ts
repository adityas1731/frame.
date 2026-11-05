import { createContext } from 'react';
import type { JellyfinClient } from './client';
import type { Fetcher, Session } from './types';
export interface ConnectionState {
  client: JellyfinClient | null; session: Session | null; saved: Session | null; message: string;
  createClient: (url: string, transport?: Fetcher, deviceId?: string) => JellyfinClient;
  activate: (client: JellyfinClient, session: Session, remember: boolean) => void;
  disconnect: () => Promise<void>; forget: () => void;
  restoring:boolean; remembered:boolean; rememberCurrent:(remember:boolean)=>void; resumeSaved:()=>Promise<void>;
}
// A separate stable module prevents context identity changes when provider UI hot-reloads.
export const ConnectionContext = createContext<ConnectionState | null>(null);
