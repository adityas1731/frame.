import {BrowserCapabilityError} from '../platform/browser.ts';
import {JellyfinError} from './client.ts';
export function errorMessage(error: unknown): string {
  if (error instanceof JellyfinError || error instanceof BrowserCapabilityError) return error.message;
  // Never expose arbitrary browser/network exceptions: they can contain URLs or secrets.
  return 'frame. could not initialize this connection (CONNECTION_INIT). Reload frame. or update your browser. No sign-in details are included in this error.';
}
