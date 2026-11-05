import {formatMinutes} from '../platform/duration.ts';
import type { ItemDto } from './types.ts';
import { assessMetadata, metadataFields, type MetadataSnapshot, type MetadataField } from '../metadata/completeness.ts';
export function imageSource(item: ItemDto, backdrop = false, artwork?: 'Logo' | 'Thumb' | 'Banner'): { id: string; type: 'Primary' | 'Backdrop' | 'Logo' | 'Thumb' | 'Banner'; tag: string; inherited: boolean } | null {
  if (artwork) {
    if (item.ImageTags?.[artwork]) return { id: item.Id, type: artwork, tag: item.ImageTags[artwork], inherited: false };
    if (artwork === 'Logo' && item.ParentLogoItemId && item.ParentLogoImageTag) return { id: item.ParentLogoItemId, type: 'Logo', tag: item.ParentLogoImageTag, inherited: true };
    return null;
  }
  if (backdrop && item.BackdropImageTags?.[0]) return { id: item.Id, type: 'Backdrop', tag: item.BackdropImageTags[0], inherited: false };
  if (backdrop && item.ParentBackdropItemId && item.ParentBackdropImageTags?.[0]) return { id: item.ParentBackdropItemId, type: 'Backdrop', tag: item.ParentBackdropImageTags[0], inherited: true };
  if (!backdrop && item.ImageTags?.Primary) return { id: item.Id, type: 'Primary', tag: item.ImageTags.Primary, inherited: false };
  if (!backdrop && item.SeriesId && item.SeriesPrimaryImageTag) return { id: item.SeriesId, type: 'Primary', tag: item.SeriesPrimaryImageTag, inherited: true };
  return null;
}
export function itemTitle(item: ItemDto) { return item.Name?.trim() || (item.Type === 'Episode' ? 'Untitled episode' : item.Type === 'Series' ? 'Untitled series' : 'Untitled movie'); }
export function runtime(item: ItemDto) { return item.RunTimeTicks && item.RunTimeTicks > 0 ? formatMinutes(item.RunTimeTicks / 600000000) : null; }
export function itemCoverage(item: ItemDto, detail = false) {
  // Projection coverage is explicit; detail DTO fields are resolved except disabled image types.
  const resolved: MetadataField[] = detail ? metadataFields : ['title', 'year', 'overview', 'rating', 'runtime', 'genres', 'poster', 'backdrop', 'season', 'episode'];
  const snapshot: MetadataSnapshot = {
    kind: item.Type === 'Episode' ? 'episode' : item.Type === 'Season' ? 'season' : item.Type === 'Series' ? 'series' : 'movie', resolved, identity: 'unverified',
    values: { title: item.Name, overview: item.Overview, year: item.ProductionYear, rating: item.CommunityRating, runtime: item.RunTimeTicks, genres: item.Genres, cast: item.People?.filter(p => p.Type === 'Actor').map(p => p.Name), providerIds: item.ProviderIds, poster: imageSource(item)?.tag, backdrop: imageSource(item, true)?.tag, season: item.Type === 'Season' ? item.IndexNumber : item.ParentIndexNumber, episode: item.IndexNumber },
  };
  return assessMetadata(snapshot);
}

