export interface ServerInfo { Id: string; ServerName?: string; Version: string }
export interface User { Id: string; Name?: string; Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean } }
export interface Session { server: ServerInfo; baseUrl: string; user: User; token: string; deviceId: string; created: number }
export interface ItemDto {
  Id: string; Name?: string; OriginalTitle?: string; Type?: string; CollectionType?: string; Overview?: string | null; Taglines?: string[];
  DisplayOrder?: string; SeriesName?: string; DateCreated?: string; ProductionYear?: number; PremiereDate?: string; CommunityRating?: number; CriticRating?: number; OfficialRating?: string;
  RunTimeTicks?: number; PrimaryImageAspectRatio?:number; Genres?: string[]; People?: { Id?: string; Name?: string; Type?: string; Role?: string; PrimaryImageTag?: string; OnlineImage?: string }[];
  ProviderIds?: Record<string, string>; ImageTags?: Record<string, string>; BackdropImageTags?: string[];
  ParentBackdropItemId?: string; ParentBackdropImageTags?: string[]; SeriesPrimaryImageTag?: string; SeriesId?: string;
  IndexNumber?: number; IndexNumberEnd?: number; ParentIndexNumber?: number; ChildCount?: number;
  UserData?: { LastPlayedDate?: string; IsFavorite?: boolean; Played?: boolean; PlaybackPositionTicks?: number; PlayedPercentage?: number; PlayCount?: number };
  ParentLogoItemId?: string; ParentLogoImageTag?: string;
}
export interface Page<T> { Items: T[]; TotalRecordCount: number; StartIndex?: number }
export interface BrowseQuery { ids?: string[]; kind?: 'Movie' | 'Series' | 'Season' | 'Episode'; parentId?: string; search?: string; start?: number; limit?: number; sort?: 'Random' | 'SortName' | 'DateCreated' | 'CommunityRating' | 'DatePlayed' | 'PremiereDate'; year?: string; maxPremiereDate?: string; minRating?: number; played?: boolean; genre?: string; resume?: boolean; favorite?: boolean }
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;




