import type { ItemDto } from '../jellyfin/types.ts';
import {displayGenres} from './genres.ts';
export interface ProviderCast { name: string; role?: string; image?: string }
export interface OnlineMetadata { id: number; kind: 'movie'|'tv'|'episode'; name?: string; originalTitle?:string; genres?:string[]; directors?:string[]; overview?: string; rating?: number; votes?: number; runtime?: number; date?: string; cast: ProviderCast[]; backdrop?: string; backdropWidth?: number; still?: string; stillFallback?: string; source: string; label?: string; artworkSource?: string; artworkLabel?: string }
export class ProviderError extends Error {}
const text = (v: unknown): string | undefined => typeof v === 'string' && v.trim() ? v.trim() : undefined;
export function providerId(item: ItemDto, key: string): string | undefined { return Object.entries(item.ProviderIds ?? {}).find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1]?.trim(); }
export function filenameTitle(name?: string) { return !!name && (/\bs\d{1,3}e\d{1,4}\b/i.test(name) || /s\d{1,3}e\d{1,4}(?:\b|\.)/i.test(name) || /\.(mkv|mp4|avi|m4v|ts)$/i.test(name)); }
export function genericEpisodeTitle(name?:string){return !text(name)||filenameTitle(name)||/^(?:(?:season\s*\d+\s*[·:—-]?\s*)?episode\s*\d+|s\d+\s*e\d+)$/i.test(name!.trim());}
export function episodeTitle(item: ItemDto) { return genericEpisodeTitle(item.Name) ? undefined : text(item.Name); }
export function episodeLabel(item: ItemDto) { return [item.ParentIndexNumber !== undefined ? `Season ${item.ParentIndexNumber}` : '', item.IndexNumber !== undefined ? `Episode ${item.IndexNumber}${item.IndexNumberEnd !== undefined && item.IndexNumberEnd !== item.IndexNumber ? `–${item.IndexNumberEnd}` : ''}` : ''].filter(Boolean).join(' · '); }
export function mergeMetadata(item: ItemDto, online?: OnlineMetadata | null) {
  const fields:string[]=[];const merged={...item,Genres:displayGenres(item.Genres,online?.genres)};
  if(!online)return {item:merged,fields};
  if((!text(item.Name)||filenameTitle(item.Name)||item.Type==='Episode'&&genericEpisodeTitle(item.Name))&&online.name){merged.Name=online.name;fields.push('title');}
  if(!text(item.OriginalTitle)&&online.originalTitle){merged.OriginalTitle=online.originalTitle;fields.push('original title');}
  if(!item.Genres?.length&&online.genres?.length){merged.Genres=online.genres;fields.push('genres');}
  if(!item.ProductionYear&&online.date){merged.ProductionYear=Number(online.date.slice(0,4));fields.push('year');}
  if(!item.People?.some(p=>p.Type==='Director'&&p.Name)&&online.directors?.length){merged.People=[...(merged.People??[]),...online.directors.map(Name=>({Name,Type:'Director'}))];fields.push('director');}
  if(!text(item.Overview)&&online.overview){merged.Overview=online.overview;fields.push('description');}
  if(item.CommunityRating===undefined&&online.rating!==undefined){merged.CommunityRating=online.rating;fields.push('rating');}
  if(!item.RunTimeTicks&&online.runtime){merged.RunTimeTicks=online.runtime*600000000;fields.push('runtime');}
  if(!item.PremiereDate&&online.date){merged.PremiereDate=online.date;fields.push('premiere');}
  if(!item.People?.some(p=>p.Type==='Actor'&&p.Name)&&online.cast.length){merged.People=[...(merged.People??[]),...online.cast.map(p=>({Name:p.name,Role:p.role,Type:'Actor',OnlineImage:p.image}))];fields.push('cast');}
  return {item:merged,fields};
}









