/** Pure playback planning only. No network, media element, timers or native imports. */
export type PlaybackMode = 'direct' | 'remux' | 'hls';
export interface MediaStream { Index: number; Type: 'Video' | 'Audio' | 'Subtitle'; Codec?: string; Language?: string; IsExternal?: boolean; DeliveryMethod?: string }
export interface MediaSource { Id: string; Container?: string; RunTimeTicks?: number; SupportsDirectPlay?: boolean; SupportsDirectStream?: boolean; SupportsTranscoding?: boolean; TranscodingSubProtocol?: string; TranscodingContainer?: string; MediaStreams?: MediaStream[] }
export interface PlaybackInfo { PlaySessionId?: string; MediaSources?: MediaSource[]; ErrorCode?: string }
export interface Capabilities { directContainers: string[]; videoCodecs: string[]; audioCodecs: string[]; nativeHls: boolean; mseHls: boolean; externalTextSubtitles?: boolean }
export interface PlaybackPlan { itemId: string; playSessionId: string; sourceId: string; mode: PlaybackMode; durationTicks?: number; audioIndex?: number; subtitleIndex?: number; startTicks: number }
export type PlanResult = { ok: true; plan: PlaybackPlan } | { ok: false; reason: 'server-error' | 'missing-session' | 'unsupported-source' | 'unsupported-track' };
export function secondsToTicks(seconds: number) { return Number.isFinite(seconds) && seconds > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.round(seconds * 10000000)) : 0; }
export function clampTicks(ticks: number, duration?: number) { const value = Number.isFinite(ticks) ? Math.max(0, Math.floor(ticks)) : 0; return Math.min(value, duration && duration > 0 ? duration : Number.MAX_SAFE_INTEGER); }
export function preparePlaybackPlan(itemId: string, info: PlaybackInfo, capabilities: Capabilities, selection: { sourceId?: string; audioIndex?: number; subtitleIndex?: number; startTicks?: number } = {}): PlanResult {
  if (info.ErrorCode) return { ok: false, reason: 'server-error' };
  if (!info.PlaySessionId) return { ok: false, reason: 'missing-session' };
  for (const source of info.MediaSources ?? []) {
    if (selection.sourceId && source.Id !== selection.sourceId) continue;
    const streams = source.MediaStreams ?? [];
    const chosenAudio = selection.audioIndex === undefined ? streams.find(s => s.Type === 'Audio') : streams.find(s => s.Type === 'Audio' && s.Index === selection.audioIndex);
    if ((selection.audioIndex !== undefined && !chosenAudio) || (selection.subtitleIndex !== undefined && selection.subtitleIndex !== -1 && !streams.some(s => s.Type === 'Subtitle' && s.Index === selection.subtitleIndex))) return { ok: false, reason: 'unsupported-track' };
    const video = streams.find(s => s.Type === 'Video');
    const subtitle = streams.find(s => s.Type === 'Subtitle' && s.Index === selection.subtitleIndex);
    const needsBurnIn = !!subtitle && !(capabilities.externalTextSubtitles && subtitle.IsExternal && ['vtt','webvtt'].includes(subtitle.Codec ?? ''));
    const playable = !!video?.Codec && capabilities.videoCodecs.includes(video.Codec.toLowerCase()) && (!chosenAudio || (!!chosenAudio.Codec && capabilities.audioCodecs.includes(chosenAudio.Codec.toLowerCase())));
    let mode: PlaybackMode | undefined;
    // A server flag alone never proves browser compatibility.
    if (source.SupportsDirectPlay && playable && !needsBurnIn && source.Container && capabilities.directContainers.includes(source.Container.toLowerCase())) mode = 'direct';
    else if (source.TranscodingSubProtocol === 'hls' && (capabilities.nativeHls || capabilities.mseHls)) {
      if (source.SupportsDirectStream && playable && !needsBurnIn) mode = 'remux';
      else if (source.SupportsTranscoding) mode = 'hls';
    }
    if (mode) return { ok: true, plan: { itemId, playSessionId: info.PlaySessionId, sourceId: source.Id, mode, durationTicks: source.RunTimeTicks, audioIndex: chosenAudio?.Index, subtitleIndex: selection.subtitleIndex, startTicks: clampTicks(selection.startTicks ?? 0, source.RunTimeTicks) } };
  }
  return { ok: false, reason: 'unsupported-source' };
}
export type Phase = 'idle' | 'negotiating' | 'ready' | 'playing' | 'paused' | 'buffering' | 'seeking' | 'switching' | 'ended' | 'failed' | 'disposed';
export interface PlaybackState { phase: Phase; generation: number; positionTicks: number; plan?: PlaybackPlan; error?: 'network' | 'codec' | 'subtitle' | 'authentication' | 'negotiation' }
export type Event = { type: 'request' | 'switch' } | { type: 'negotiated'; generation: number; plan: PlaybackPlan } | { type: 'play' | 'pause' | 'buffer' | 'end' | 'dispose' } | { type: 'position' | 'seek'; ticks: number } | { type: 'fail'; reason: PlaybackState['error'] };
export const initialPlayback: PlaybackState = { phase: 'idle', generation: 0, positionTicks: 0 };
export function transition(state: PlaybackState, event: Event): PlaybackState {
  if (state.phase === 'disposed') return state;
  if (event.type === 'dispose') return { phase: 'disposed', generation: state.generation + 1, positionTicks: state.positionTicks };
  if (event.type === 'request' || event.type === 'switch') return { phase: event.type === 'switch' ? 'switching' : 'negotiating', generation: state.generation + 1, positionTicks: state.positionTicks };
  if (event.type === 'negotiated') return event.generation === state.generation && ['negotiating','switching'].includes(state.phase) ? { ...state, phase: 'ready', plan: event.plan, positionTicks: event.plan.startTicks, error: undefined } : state;
  if (event.type === 'fail') return { ...state, phase: 'failed', error: event.reason };
  if (event.type === 'end') return { ...state, phase: 'ended', generation: state.generation + 1 };
  if (!state.plan || ['ended','failed','idle','negotiating','switching'].includes(state.phase)) return state;
  if (event.type === 'position' || event.type === 'seek') return { ...state, phase: event.type === 'seek' ? 'seeking' : state.phase, positionTicks: clampTicks(event.ticks, state.plan.durationTicks) };
  const phase = { play: 'playing', pause: 'paused', buffer: 'buffering' } as const;
  return event.type in phase ? { ...state, phase: phase[event.type as keyof typeof phase] } : state;
}
export interface Report { ItemId: string; MediaSourceId: string; PlaySessionId: string; PositionTicks: number; IsPaused: boolean }
interface CleanupIntent { stoppedReport: Report; stopEncoding: boolean; playSessionId: string }
/** Intent generation is intentionally disconnected from HTTP until live playback approval. */
export class PlaybackController {
  state: PlaybackState = { ...initialPlayback };
  private stopped = new Set<string>();
  private started = new Set<string>();
  private cleanup: CleanupIntent[] = [];
  private reports: { kind: 'started' | 'progress' | 'stopped'; report: Report }[] = [];
  dispatch(event: Event) {
    if (['switch','request','end','fail','dispose'].includes(event.type)) { const cleanup = this.stopIntent(); if (cleanup) this.cleanup.push(cleanup); }
    this.state = transition(this.state, event);
    const report = this.report();
    if (report && event.type === 'play' && this.state.phase === 'playing' && !this.started.has(report.PlaySessionId)) { this.started.add(report.PlaySessionId); this.reports.push({ kind: 'started', report }); }
    if (report && event.type === 'position' && ['playing','paused','buffering'].includes(this.state.phase)) this.reports.push({ kind: 'progress', report });
    return this.state;
  }
  drainReports() { return this.reports.splice(0); }
  drainCleanup() { return this.cleanup.splice(0); }
  report(): Report | null {
    const { plan, positionTicks, phase } = this.state;
    return plan && !['idle','negotiating','switching','disposed'].includes(phase) ? { ItemId: plan.itemId, MediaSourceId: plan.sourceId, PlaySessionId: plan.playSessionId, PositionTicks: positionTicks, IsPaused: phase === 'paused' } : null;
  }
  private stopIntent(): CleanupIntent | null {
    const report = this.report(); const plan = this.state.plan;
    if (!plan || !report || this.stopped.has(plan.playSessionId)) return null;
    this.stopped.add(plan.playSessionId);
    const cleanup = { stoppedReport: report, stopEncoding: plan.mode !== 'direct', playSessionId: plan.playSessionId };
    this.reports.push({ kind: 'stopped', report }); return cleanup;
  }
  release() {
    const cleanup = this.stopIntent();
    this.state = transition(this.state, { type: 'dispose' });
    return cleanup;
  }
}
