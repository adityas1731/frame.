import {PreviewContext as Context} from './preview-context';
import {fonts,fontFamily,type FontId} from '../appearance/fonts';
import { useContext, useEffect, useState, type ReactNode } from 'react';

export const themes = ['graphite', 'midnight', 'forest', 'plum', 'ocean', 'espresso', 'slate', 'obsidian'] as const;
export type Theme = typeof themes[number];
export const sectionNames = { continue: 'Continue exploring', new: 'Recently added', picks: 'Picked for you', top: 'The top ten', shows: 'Your next great series' };
export type Section = keyof typeof sectionNames;
export interface Preferences {
  theme: Theme; episodeSize:'small'|'medium'|'large'; textScale: '90' | '100' | '110' | '125' | '140'; density: 'comfortable' | 'compact'; posterSize: 'small' | 'medium' | 'large';
  font: FontId; customFont: string; navigation: 'expanded' | 'compact'; accent: 'amber' | 'sage' | 'blue' | 'rose' | 'lavender' | 'teal' | 'coral' | 'silver';
  homeSections: Section[]; showTitles: boolean; showRatings: boolean; reducedMotion: boolean; heroAutoAdvance: boolean; onlineMetadata: boolean;
}
export const defaults: Preferences = { theme: 'graphite', episodeSize:'medium', textScale: '100', density: 'comfortable', posterSize: 'medium', font: 'system', customFont: '', navigation: 'compact', accent: 'amber', homeSections: ['continue', 'new', 'picks', 'top', 'shows'], showTitles: true, showRatings: true, reducedMotion: false, heroAutoAdvance: true, onlineMetadata: true };
interface Snapshot { carouselVersion: 1; preferences: Preferences; favorites: string[]; watchlist: string[]; watched: string[] }
const key = 'frame.preview.v1';
function readSnapshot(): Snapshot {
  const fallback = { carouselVersion: 1 as const, preferences: defaults, favorites: ['beyond-the-silence', 'wild-earth'], watchlist: ['north-of-nowhere', 'lunar-tide'], watched: [] };
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object') return fallback;
    const p = value.preferences ?? {};
    const preferences = { ...defaults, textScale: defaults.textScale };
    const options: Record<string, readonly string[]> = { theme: themes, episodeSize:['small','medium','large'], density: ['comfortable', 'compact'], posterSize: ['small', 'medium', 'large'], font: fonts.map(font=>font.id), navigation: ['expanded', 'compact'], accent: ['amber', 'sage', 'blue', 'rose', 'lavender', 'teal', 'coral', 'silver'] };
    options.textScale = ['90', '100', '110', '125', '140'];
    if (typeof p.customFont === 'string' && /^[a-zA-Z0-9 -]{1,80}$/.test(p.customFont)) preferences.customFont = p.customFont;
    for (const k of Object.keys(options)) if (options[k].includes(p[k])) Object.assign(preferences, { [k]: p[k] });
    for (const k of ['showTitles', 'showRatings', 'reducedMotion', 'heroAutoAdvance', 'onlineMetadata'] as const) if (typeof p[k] === 'boolean' && (k !== 'heroAutoAdvance' || value.carouselVersion === 1)) preferences[k] = p[k];
    if (Array.isArray(p.homeSections)) preferences.homeSections = [...new Set(p.homeSections.filter((s: unknown): s is Section => typeof s === 'string' && Object.hasOwn(sectionNames, s)))] as Section[];
    const list = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    return { carouselVersion: 1, preferences, favorites: list(value.favorites), watchlist: list(value.watchlist), watched: list(value.watched) };
  } catch { return fallback; }
}
export interface PreviewState extends Snapshot {
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  toggleFavorite: (id: string) => void; toggleWatchlist: (id: string) => void; toggleWatched: (id: string) => void;
  resetPreferences: () => void; notify: (message: string) => void; toast: string | null;
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState(readSnapshot);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVersion, setToastVersion] = useState(0);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(snapshot)); } catch { /* Preview remains usable when storage is unavailable. */ } }, [snapshot]);
  useEffect(() => {
    const p = snapshot.preferences;
    document.documentElement.style.setProperty('--font-body',fontFamily(p.font));
    document.documentElement.style.fontFamily='var(--font-body)';
    document.documentElement.style.setProperty('--custom-font', /^[a-zA-Z0-9 -]{1,80}$/.test(p.customFont) ? `"${p.customFont}"` : 'system-ui');
    document.documentElement.style.setProperty('--ui-scale', String(Number(p.textScale) / 100));
    Object.assign(document.documentElement.dataset, { layout: 'cinema', theme: p.theme, density: p.density, poster: p.posterSize, episodeSize:p.episodeSize??'medium', font: p.font, navigation: p.navigation, accent: p.accent, motion: p.reducedMotion ? 'reduced' : 'full' });
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#101111');
  }, [snapshot.preferences]);
  useEffect(() => { const timer = window.setTimeout(() => setToast(null), 3200); return () => clearTimeout(timer); }, [toastVersion]);
  const toggle = (field: 'favorites' | 'watchlist' | 'watched', id: string) => setSnapshot(s => ({ ...s, [field]: s[field].includes(id) ? s[field].filter(x => x !== id) : [...s[field], id] }));
  const notify = (message: string) => { setToast(message); setToastVersion(v => v + 1); };
  return <Context value={{ ...snapshot, setPreference: (key, value) => setSnapshot(s => ({ ...s, preferences: { ...s.preferences, [key]: value } })), toggleFavorite: id => toggle('favorites', id), toggleWatchlist: id => toggle('watchlist', id), toggleWatched: id => toggle('watched', id), resetPreferences: () => { setSnapshot(s => ({ ...s, preferences: { ...defaults, onlineMetadata: s.preferences.onlineMetadata } })); notify('Appearance restored to defaults'); }, notify, toast }}>{children}</Context>;
}
export function usePreview() { const context = useContext(Context); if (!context) throw new Error('PreviewProvider is required'); return context; }






