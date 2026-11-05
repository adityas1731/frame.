import Hls, {FetchLoader} from 'hls.js';
import type { HlsConfig } from 'hls.js';
import { PlaybackError } from './protocol.ts';
import {hosting} from '../build/hosting.ts';

// Bundle the engine with Frame. A failed/stale lazy chunk must never masquerade as missing MSE support.
export type HlsFailure = 'playlist' | 'segment' | 'decoding' | 'network' | 'stream' | 'timeout';
export type HlsDiagnostic = (event:{reason:HlsFailure;fatal:boolean;status?:number})=>void;
export async function probeHls(){
 const mediaSourceAvailable=typeof globalThis.MediaSource!=='undefined';
 try{return{supported:Hls.isSupported(),engineLoaded:true,mediaSourceAvailable,engineLoadFailed:false};}
 catch{return{supported:false,engineLoaded:false,mediaSourceAvailable,engineLoadFailed:true};}
}
export async function mseHlsSupport():Promise<boolean>{return (await probeHls()).supported;}

/** Each engine instance belongs to exactly one page-owned, item-scoped gateway. */
export function hlsConfig(stream: string, start: number, origin: string,scope='/',authorizeRelay?:(raw:string)=>string): Partial<HlsConfig> {
  const url = new URL(stream, origin);
  if(authorizeRelay)authorizeRelay(url.href);
  else if (url.origin !== new URL(origin).origin || url.search || url.hash ||
      !url.pathname.startsWith(scope)||!/^__frame_media\/[a-zA-Z0-9-]{16,100}\/[^/]+\/stream\.m3u8$/.test(url.pathname.slice(scope.length))) {
    throw new PlaybackError('HLS requires an authorized Frame media gateway.');
  }
  const prefix = url.pathname.slice(0,url.pathname.indexOf('/',scope.length+'__frame_media/'.length)+1);
  const retry = { maxNumRetry: 1, retryDelayMs: 500, maxRetryDelayMs: 1500 };
  const policy = { default: { maxTimeToFirstByteMs: 10000, maxLoadTimeMs: 20000,
    timeoutRetry: { ...retry }, errorRetry: { ...retry } } };
  return {
    debug: false, enableWorker: true, lowLatencyMode: false,
    renderTextTracksNatively: false,
    startPosition: Math.max(0, Number.isFinite(start) ? start : 0),
    backBufferLength: 30, maxBufferLength: 30, maxMaxBufferLength: 60,
    manifestLoadPolicy: policy, playlistLoadPolicy: policy, fragLoadPolicy: policy,
    // Fail closed even if a future playlist tag causes the engine to request an unrewritten URL.
    fetchSetup(context, init) {
      if(authorizeRelay)return new Request(authorizeRelay(context.url),{...init,credentials:'same-origin',mode:'same-origin',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'});
      const target = new URL(context.url, origin);
      if (target.origin !== url.origin || !target.pathname.startsWith(prefix) || target.search || target.hash) {
        throw new PlaybackError('HLS requested media outside this playback session.');
      }
      return new Request(target, { ...init, credentials: 'omit', redirect: 'error',
        referrerPolicy: 'no-referrer', cache: 'no-store' });
    },
  };
}

/** Exported lifecycle boundary also accepts a test engine without networking or decoders. */
export function attachEngine(Engine: typeof Hls, config: Partial<HlsConfig>, video: HTMLVideoElement,
    stream: string, onError: (reason?: HlsFailure) => void, signal?: AbortSignal, diagnostic?:HlsDiagnostic): () => void {
  if (signal?.aborted) throw new PlaybackError('Player connection closed.');
  const hls = new Engine(config);
  let closed = false;
  let recovered = false;
  let failed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    signal?.removeEventListener('abort', close);
    hls.destroy();
  };
  const fail = (reason: HlsFailure) => {
    if (closed || failed) return;
    failed = true;
    hls.stopLoad();
    onError(reason);
  };
  hls.on(Engine.Events.ERROR, (_event, data) => {
    if (closed) return;
    const reason:HlsFailure=data.type === Engine.ErrorTypes.MEDIA_ERROR ? 'decoding'
      : /manifest|level|playlist/i.test(data.details ?? '') ? 'playlist'
      : /frag|key/i.test(data.details ?? '') ? 'segment'
      : data.type === Engine.ErrorTypes.NETWORK_ERROR ? 'network' : 'stream';
    diagnostic?.({reason,fatal:data.fatal===true,status:data.response?.code});
    if (!data.fatal) return;
    if (data.type === Engine.ErrorTypes.MEDIA_ERROR && !recovered) {
      recovered = true;
      try { hls.recoverMediaError(); } catch { fail('decoding'); }
    } else fail(data.type === Engine.ErrorTypes.MEDIA_ERROR ? 'decoding'
      : /manifest|level|playlist/i.test(data.details ?? '') ? 'playlist'
      : /frag|key/i.test(data.details ?? '') ? 'segment'
      : data.type === Engine.ErrorTypes.NETWORK_ERROR ? 'network' : 'stream');
  });
  signal?.addEventListener('abort', close, { once: true });
  try { hls.attachMedia(video); hls.loadSource(stream); }
  catch { close(); throw new PlaybackError('The HLS media engine could not start.'); }
  return close;
}

export async function attachHls(video: HTMLVideoElement, url: string, start: number,
    onError: (reason?: HlsFailure) => void, signal?: AbortSignal, diagnostic?:HlsDiagnostic,authorizeRelay?:(raw:string)=>string): Promise<() => void> {
  if (!Hls.isSupported()) throw new PlaybackError('HLS streaming is unsupported in this browser.');
  return attachEngine(Hls, { ...hlsConfig(url, start, location.origin,hosting(document.baseURI).scope,authorizeRelay), loader: FetchLoader },
    video, url, onError, signal, diagnostic);
}
