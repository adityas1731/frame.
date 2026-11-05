/** Only controlled, non-sensitive capability messages may reach the connection UI. */
export class BrowserCapabilityError extends Error {}

/** UUID identifiers and streaming nonces must always use a cryptographic source. */
export function randomId(source: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> = globalThis.crypto): string {
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  if (typeof source?.getRandomValues !== 'function') throw new BrowserCapabilityError('Secure random generation is unavailable. Update your browser or open frame. over HTTPS.');
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64; bytes[8] = (bytes[8]! & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

/** Safari-compatible cancellation; no AbortSignal.any/timeout dependency. Dispose after reading the body. */
export function requestSignal(parents: readonly AbortSignal[], timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const parent of parents) { parent.addEventListener('abort', abort, {once:true}); if (parent.aborted) abort(); }
  const timer = setTimeout(abort, timeoutMs);
  return {signal:controller.signal, dispose() {clearTimeout(timer); for (const parent of parents) parent.removeEventListener('abort',abort);}};
}

export function streamingRequirement(secure: boolean, worker: boolean): string | undefined {
  if (!secure) return 'Playback on this device requires frame. and Jellyfin to use trusted HTTPS. HTTP allows connection, sign-in and browsing with your consent, but cannot enable frame.’s authenticated streaming. Open the HTTPS server address; localhost works only on the server’s own device.';
  if (!worker) return 'Authenticated playback requires service-worker support. Use a current Safari, Chrome, Edge or Firefox browser and allow site storage.';
}
