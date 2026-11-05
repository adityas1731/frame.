import {parseDeviceSessions,type DeviceSession} from './devices.ts';
import {parseSegments,type SegmentInfo} from '../playback/segments.ts';
import {FRAME_VERSION} from '../version.ts';
import {requestSignal} from '../platform/browser.ts';
import type { BrowseQuery, Fetcher, ItemDto, Page, ServerInfo, Session, User } from './types.ts';
import {parsePlaybackInfo,type PlayingReport} from '../playback/protocol.ts';

export class JellyfinError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.name = 'JellyfinError'; this.status = status; }
}
export function normalizeServerUrl(input: string, allowHttp = false, pageProtocol = ''): string {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new JellyfinError(0, 'Enter a complete server URL, including https://.'); }
  const framePage=/\/Frame\/Web\/?$/i.test(url.pathname);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || (url.hash&&!(framePage&&url.hash==='#/'))) throw new JellyfinError(0, 'Use an HTTP(S) server URL without credentials, query parameters or fragments.');
  if(framePage){url.pathname=url.pathname.replace(/\/Frame\/Web\/?$/i,'');url.hash='';}
  if (url.protocol === 'http:' && (pageProtocol === 'https:' || !allowHttp)) throw new JellyfinError(0, 'Use HTTPS. Plain HTTP requires explicit consent and cannot be used from an HTTPS page.');
  return url.href.replace(/\/+$/, '');
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function parseServer(value: unknown): ServerInfo {
  if (!record(value) || typeof value.Id !== 'string' || !value.Id || typeof value.Version !== 'string' || !/^\d+\./.test(value.Version)) throw new JellyfinError(0, 'This response is not recognized as Jellyfin server information.');
  return { Id: value.Id, Version: value.Version, ServerName: typeof value.ServerName === 'string' ? value.ServerName : 'Jellyfin' };
}
export function parseUser(value: unknown): User {
  if (!record(value) || typeof value.Id !== 'string' || !value.Id) throw new JellyfinError(0, 'The server returned an invalid account.');
  return { Id: value.Id, Name: typeof value.Name === 'string' ? value.Name : 'Jellyfin user', Policy: record(value.Policy) ? { IsAdministrator: value.Policy.IsAdministrator === true, IsDisabled: value.Policy.IsDisabled === true } : undefined };
}
export function parseItem(value: unknown): ItemDto {
  if (!record(value) || typeof value.Id !== 'string' || !value.Id) throw new JellyfinError(0, 'The server returned an invalid media item.');
  // Runtime validation at the boundary: never assume optional collections/numbers are well formed.
  const item: ItemDto = { Id: value.Id };
  for (const key of ['Name','OriginalTitle','Type','CollectionType','Overview','PremiereDate','OfficialRating','ParentBackdropItemId','SeriesPrimaryImageTag','SeriesId','ParentLogoItemId','ParentLogoImageTag','SeriesName','DisplayOrder','DateCreated'] as const) if (typeof value[key] === 'string') item[key] = value[key];
  for (const key of ['ProductionYear','CommunityRating','CriticRating','RunTimeTicks','PrimaryImageAspectRatio','IndexNumber','IndexNumberEnd','ParentIndexNumber','ChildCount'] as const) if (typeof value[key] === 'number' && Number.isFinite(value[key])) item[key] = value[key];
  if(item.PrimaryImageAspectRatio!==undefined&&item.PrimaryImageAspectRatio<=0)delete item.PrimaryImageAspectRatio;
  if (item.ProductionYear !== undefined && (!Number.isInteger(item.ProductionYear) || item.ProductionYear <= 0)) delete item.ProductionYear;
  if (item.RunTimeTicks !== undefined && item.RunTimeTicks <= 0) delete item.RunTimeTicks;
  if (item.CommunityRating !== undefined && (item.CommunityRating < 0 || item.CommunityRating > 10)) delete item.CommunityRating;
  if (item.CriticRating !== undefined && (item.CriticRating < 0 || item.CriticRating > 100)) delete item.CriticRating;
  for (const key of ['IndexNumber','IndexNumberEnd','ParentIndexNumber','ChildCount'] as const) if (item[key] !== undefined && (!Number.isInteger(item[key]) || item[key]! < 0)) delete item[key];
  for (const key of ['Genres','Taglines','BackdropImageTags','ParentBackdropImageTags'] as const) if (Array.isArray(value[key])) item[key] = value[key].filter((v: unknown): v is string => typeof v === 'string' && !!v.trim());
  for (const key of ['ImageTags','ProviderIds'] as const) if (record(value[key])) item[key] = Object.fromEntries(Object.entries(value[key]).filter(([,v]) => typeof v === 'string')) as Record<string,string>;
  if (Array.isArray(value.People)) item.People = value.People.filter(record).map(p => ({ Id: typeof p.Id === 'string' ? p.Id : undefined, Name: typeof p.Name === 'string' ? p.Name : undefined, Type: typeof p.Type === 'string' ? p.Type : undefined, Role: typeof p.Role === 'string' ? p.Role : undefined, ...(typeof p.PrimaryImageTag === 'string' ? { PrimaryImageTag: p.PrimaryImageTag } : {}) }));
  if (record(value.UserData)) {
    item.UserData = {};
    if (typeof value.UserData.LastPlayedDate === 'string' && Number.isFinite(Date.parse(value.UserData.LastPlayedDate))) item.UserData.LastPlayedDate = value.UserData.LastPlayedDate;
    for (const key of ['IsFavorite','Played'] as const) if (typeof value.UserData[key] === 'boolean') item.UserData[key] = value.UserData[key];
    for (const key of ['PlaybackPositionTicks','PlayedPercentage','PlayCount'] as const) if (typeof value.UserData[key] === 'number' && Number.isFinite(value.UserData[key]) && value.UserData[key] >= 0) item.UserData[key] = value.UserData[key];
  }
  return item;
}
function parsePage(value: unknown): Page<ItemDto> {
  if (!record(value) || !Array.isArray(value.Items) || typeof value.TotalRecordCount !== 'number' || !Number.isInteger(value.TotalRecordCount) || value.TotalRecordCount < 0) throw new JellyfinError(0, 'The server returned an invalid collection.');
  return { Items: value.Items.map(parseItem), TotalRecordCount: value.TotalRecordCount };
}
export class JellyfinClient {
  private identificationChoices = new Map<string, Set<import('./identification.ts').IdentificationResult>>();
  async searchIdentification(itemId:string,kind:'Movie'|'Series',query:import('./identification.ts').IdentificationQuery){
    const user=parseUser(await this.request('Users/Me'));
    if(!user.Policy?.IsAdministrator)throw new JellyfinError(403,'Only a Jellyfin administrator can correct identification.');
    const {identificationResults}=await import('./identification.ts');
    const results=identificationResults(await this.request(`Items/RemoteSearch/${kind}`,'POST',{ItemId:itemId,SearchInfo:query,IncludeDisabledProviders:false}));
    this.identificationChoices.set(itemId,new Set(results));return results;
  }
  async applyIdentification(itemId:string,result:import('./identification.ts').IdentificationResult,replaceImages:boolean){
    if(!this.identificationChoices.get(itemId)?.has(result))throw new JellyfinError(0,'Search again and select a result before applying.');
    const user=parseUser(await this.request('Users/Me'));
    if(!user.Policy?.IsAdministrator)throw new JellyfinError(403,'Only a Jellyfin administrator can correct identification.');
    // Consume before dispatch: a timeout has an uncertain outcome and must never auto-retry a write.
    this.identificationChoices.delete(itemId);
    await this.request(`Items/RemoteSearch/Apply/${encodeURIComponent(itemId)}?replaceAllImages=${replaceImages}`,'POST',result);
    this.invalidate();
  }
  readonly baseUrl: string;
  readonly deviceId: string;
  private token = '';
  private controller = new AbortController();
  private cache = new Map<string, { value: unknown; expires: number }>();
  private pending = new Map<string, Promise<unknown>>();
  private images = new Map<string, { promise: Promise<Blob>; expires: number }>();
  private active = 0;
  private queue: (() => void)[] = [];
  private version = 12;
  private watchedPending = new Map<string,Promise<boolean>>();
  private favoritePending = new Map<string,Promise<boolean>>();
  private favoriteRevision = 0;
  private playbackCleanup = new Set<()=>Promise<void>>();
  private unauthorized: () => void;
  private transport: Fetcher;
  private now: () => number;
  constructor(baseUrl: string, deviceId: string, transport: Fetcher = (input, init) => fetch(input, init), unauthorized = () => {}, now = Date.now) {
    this.baseUrl = normalizeServerUrl(baseUrl, true); this.deviceId = deviceId; this.transport = transport; this.unauthorized = unauthorized; this.now = now;
  }
  private header(anonymous = false): string {
    return `MediaBrowser Client="frame.", Device="frame.", DeviceId="${encodeURIComponent(this.deviceId)}", Version="${FRAME_VERSION}"${this.token && !anonymous ? `, Token="${encodeURIComponent(this.token)}"` : ''}`;
  }
  private async slot<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= 4) await new Promise<void>(resolve => this.queue.push(resolve));
    this.active++;
    try { if (this.controller.signal.aborted) throw new JellyfinError(0, 'Connection closed.'); return await task(); }
    finally { this.active--; this.queue.shift()?.(); }
  }
  private async request(path: string, method = 'GET', body?: unknown, image = false, anonymous = false, signal?:AbortSignal, keepalive=false, optional=false): Promise<unknown> {
    const execute = async () => {
      if (this.controller.signal.aborted) throw new JellyfinError(0, 'Connection closed.');
      for (let attempt = 0; attempt < 2; attempt++) {
        const cancellation=requestSignal([this.controller.signal,...(signal?[signal]:[])],12000);
        try {
          const response = await this.transport(`${this.baseUrl}/${path}`, {
            method, headers: { Authorization: this.header(anonymous), Accept: image ? 'image/*' : 'application/json; profile=PascalCase', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}), credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
            signal: cancellation.signal, cache: image ? 'default' : 'no-store', keepalive,
          });
          if (!response.ok) {
            // Preserve a missing image's negative-cache entry while invalidating metadata reads.
            if (!optional && (response.status === 403 || response.status === 404)) this.cache.clear();
            if (!optional && response.status === 403) this.images.clear();
            if (!optional && response.status === 401 && this.token) this.unauthorized();
            const delay = response.headers.get('Retry-After');
            const retryMs = delay ? (/^\d+$/.test(delay) ? Number(delay) * 1000 : Math.max(0, Date.parse(delay) - this.now())) : 350;
            if (method === 'GET' && attempt === 0 && (response.status === 429 || response.status >= 500) && retryMs <= 2000) {
              await this.pause(Math.max(350, retryMs)); continue;
            }
            throw new JellyfinError(response.status, response.status === 401 ? 'Your session has expired, or the sign-in details were rejected.' : response.status === 403 ? 'This account does not have permission to access this resource.' : response.status === 404 ? 'This resource is unavailable on this server.' : response.status === 429 ? 'The server is busy. Wait before trying again.' : 'The Jellyfin request failed. Try again later.');
          }
          if (response.status === 204) return undefined;
          try { return image ? await response.blob() : await response.json(); } catch { throw new JellyfinError(0, 'The server returned an unreadable response.'); }
        } catch (error) {
          if (error instanceof JellyfinError) throw error;
          if(signal?.aborted)throw new JellyfinError(0,'Playback request cancelled.');
          if (this.controller.signal.aborted) throw new JellyfinError(0, 'Connection closed.');
          if (method === 'GET' && attempt === 0) { await this.pause(350); continue; }
          throw new JellyfinError(0, 'Could not reach Jellyfin. Check the URL, network, TLS certificate and CORS configuration.');
        } finally {cancellation.dispose();}
      }
    };
    // Page-exit cleanup must start its keepalive fetch before the document dies,
    // even when ordinary library/image requests occupy the concurrency slots.
    return keepalive ? execute() : this.slot(execute);
  }
  private pause(ms: number) { return new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); this.controller.signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms); this.controller.signal.addEventListener('abort', finish, { once: true });
    if (this.controller.signal.aborted) finish();
  }); }
  private read<T>(key: string, parser: (value: unknown) => T, ttl = 300000): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expires > this.now()) { this.cache.delete(key); this.cache.set(key, cached); return Promise.resolve(cached.value as T); }
    if (this.pending.has(key)) return this.pending.get(key) as Promise<T>;
    const revision = this.favoriteRevision;
    const promise:Promise<T> = this.request(key).then(value => {
      // A read already in flight when a favorite changes must not restore stale user data.
      if(revision !== this.favoriteRevision)return this.read(key,parser,ttl);
      const result = parser(value);
      if (!this.controller.signal.aborted) { this.cache.set(key, { value: result, expires: this.now() + ttl }); if (this.cache.size > 100) this.cache.delete(this.cache.keys().next().value!); }
      return result;
    }).finally(() => {if(this.pending.get(key)===promise)this.pending.delete(key);});
    this.pending.set(key, promise); return promise;
  }
  invalidate() { this.cache.clear(); this.images.clear(); }
  invalidateRemoteImages() { for (const key of this.cache.keys()) if (key.includes('/RemoteImages?')) this.cache.delete(key); }
  /** Exact person identity only; never search names or save images onto Jellyfin. */
  remotePortrait(person: ItemDto) {
    const tmdb=Object.entries(person.ProviderIds??{}).find(([key])=>key.toLowerCase()==='tmdb')?.[1];
    if(person.Type!=='Person'||!tmdb||!/^[1-9]\d*$/.test(tmdb)||!Number.isSafeInteger(Number(tmdb)))return Promise.resolve(null);
    const query=new URLSearchParams({type:'Primary',providerName:'TheMovieDb',startIndex:'0',limit:'10',includeAllLanguages:'true'});
    return this.read(`Items/${encodeURIComponent(person.Id)}/RemoteImages?${query}`,value=>{
      if(!record(value)||!Array.isArray(value.Images))return null;
      for(const image of value.Images){
        if(!record(image)||image.ProviderName!=='TheMovieDb'||image.Type!=='Primary'||typeof image.Url!=='string')continue;
        try{const url=new URL(image.Url);if(url.origin==='https://image.tmdb.org'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/t\/p\/(original|w\d+)\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(url.pathname))return {url:url.href};}catch{/* Ignore malformed provider artwork. */}
      }
      return null;
    },21600000);
  }
  /** Read provider candidates only. Never download an image into Jellyfin or refresh metadata. */
  remoteBackdrop(item: ItemDto) {
    return this.remoteBackdrops(item).then(images=>images[0]??null);
  }
  remoteBackdrops(item: ItemDto) {
    return this.remoteArtwork(item,'Backdrop');
  }
  remotePosters(item: ItemDto) {
    return this.remoteArtwork(item,'Primary');
  }
  private remoteArtwork(item:ItemDto,type:'Backdrop'|'Primary') {
    const tmdb = Object.entries(item.ProviderIds ?? {}).find(([key]) => key.toLowerCase() === 'tmdb')?.[1];
    if (!['Movie', 'Series'].includes(item.Type ?? '') || !tmdb || !/^[1-9]\d*$/.test(tmdb) || !Number.isSafeInteger(Number(tmdb))) return Promise.resolve([]);
    const query = new URLSearchParams({ type, providerName: 'TheMovieDb', startIndex: '0', limit: '40', includeAllLanguages: 'true' });
    return this.read(`Items/${encodeURIComponent(item.Id)}/RemoteImages?${query}`, value => {
      if (!record(value) || !Array.isArray(value.Images)) return [];
      const images = value.Images.filter(record).flatMap(image => {
        if (image.ProviderName !== 'TheMovieDb' || image.Type !== type || typeof image.Url !== 'string' || typeof image.Width !== 'number' || typeof image.Height !== 'number') return [];
        const width=image.Width, height=image.Height;
        if (!Number.isFinite(width) || !Number.isFinite(height) || (type==='Backdrop'?(width<1920||height<1080||width/height<1.6||width/height>2):(width<500||height<750||width/height<.5||width/height>.8))) return [];
        try {
          const url=new URL(image.Url);
          if (url.origin!=='https://image.tmdb.org' || url.username || url.password || url.search || url.hash || !/^\/t\/p\/(original|w\d+)\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(url.pathname)) return [];
          url.pathname=url.pathname.replace(/^\/t\/p\/w\d+\//,'/t/p/original/');
          return [{url:url.href,width,height,language:typeof image.Language==='string'?image.Language:''}];
        } catch { return []; }
      });
      return [...new Map(images.sort((a,b)=>Number(!!a.language)-Number(!!b.language)||Math.abs(a.width-3840)-Math.abs(b.width-3840)).map(image=>[image.url,image])).values()];
    }, 21600000);
  }
  dispose() { this.controller.abort(); this.token = ''; this.cache.clear(); this.pending.clear(); this.images.clear(); }
  async probe(): Promise<ServerInfo> { const info = parseServer(await this.request('System/Info/Public','GET',undefined,false,true)); this.version = Number(info.Version.split('.')[0]); return info; }
  async authenticate(server: ServerInfo, username: string, password: string): Promise<Session> {
    const result = await this.request('Users/AuthenticateByName', 'POST', { Username: username, Pw: password });
    if (this.controller.signal.aborted) throw new JellyfinError(0, 'Connection closed.');
    if (!record(result) || typeof result.AccessToken !== 'string' || !result.AccessToken) throw new JellyfinError(0, 'No session token was returned.');
    if (typeof result.ServerId === 'string' && result.ServerId !== server.Id) throw new JellyfinError(0, 'The server identity changed. Test the connection again.');
    const user = parseUser(result.User);
    if (user.Policy?.IsDisabled) throw new JellyfinError(403, 'This account is disabled.');
    this.token = result.AccessToken; this.version = Number(server.Version.split('.')[0]); this.invalidate();
    return { server, baseUrl: this.baseUrl, user, token: result.AccessToken, deviceId: this.deviceId, created: this.now() };
  }
  restore(session: Session) { this.token = session.token; this.version = Number(session.server.Version.split('.')[0]); }
  async validateSession(session: Session) {
    const server = await this.probe();
    if (server.Id !== session.server.Id) throw new JellyfinError(409, 'The server identity changed. Sign in again.');
    const user = parseUser(await this.request(`Users/${encodeURIComponent(session.user.Id)}`));
    if (user.Id !== session.user.Id || user.Policy?.IsDisabled) throw new JellyfinError(403, 'This saved account is unavailable. Sign in again.');
    return user;
  }
  libraries(userId: string) { return this.read(this.version >= 12 ? `UserViews?userId=${encodeURIComponent(userId)}` : `Users/${encodeURIComponent(userId)}/Views`, parsePage); }
  async counts(userId: string) {
    const [movies, series] = await Promise.all([this.items(userId, { kind: 'Movie', limit: 1 }), this.items(userId, { kind: 'Series', limit: 1 })]);
    return { movies: movies.TotalRecordCount, series: series.TotalRecordCount };
  }
  items(userId: string, query: BrowseQuery = {}) {
    const params = new URLSearchParams({ userId, recursive: 'true', includeItemTypes: query.kind ?? 'Movie,Series', startIndex: String(Math.max(0, query.start ?? 0)), limit: String(Math.min(40, Math.max(1, query.limit ?? 40))), fields: 'Genres,Overview,PrimaryImageAspectRatio,ProviderIds', enableImages: 'true', imageTypeLimit: '1', enableImageTypes: 'Primary,Backdrop', enableTotalRecordCount: 'true', sortBy: query.sort ?? 'SortName', sortOrder: query.sort === 'DateCreated' || query.sort === 'CommunityRating' || query.sort === 'DatePlayed' || query.sort === 'PremiereDate' ? 'Descending' : 'Ascending' });
    if (query.ids) {
      const ids=[...new Set(query.ids.filter(id=>/^[a-zA-Z0-9-]{1,100}$/.test(id)))].slice(0,40);
      if(!ids.length)return Promise.resolve({Items:[] as ItemDto[],TotalRecordCount:0});
      params.set('ids',ids.join(','));
    }
    if (query.parentId) params.set('parentId', query.parentId);
    if (query.search?.trim()) params.set('searchTerm', query.search.trim());
    if (query.genre) params.set('genres', query.genre);
    if (query.year && /^\d{4}$/.test(query.year)) params.set('years', query.year);
    if (query.minRating !== undefined && Number.isFinite(query.minRating)) params.set('minCommunityRating', String(Math.max(0, Math.min(10, query.minRating))));
    if (query.maxPremiereDate && Number.isFinite(Date.parse(query.maxPremiereDate))) params.set('maxPremiereDate', query.maxPremiereDate);
    if (query.sort === 'DateCreated') params.set('fields', 'Genres,Overview,PrimaryImageAspectRatio,ProviderIds,DateCreated');
    if (query.played !== undefined) params.set('isPlayed', String(query.played));
    params.set('enableUserData', 'true');
    if (query.resume) { params.set('filters', 'IsResumable'); params.set('includeItemTypes', query.kind === 'Episode' ? 'Episode' : 'Movie,Episode'); }
    if (query.favorite !== undefined) params.set('isFavorite', String(query.favorite));
    return this.read(`Items?${params}`, parsePage, query.resume ? 0 : 300000);
  }
  async genres(userId:string,parentId='',kind?:'Movie'|'Series'){
    const names=new Set<string>();let start=0;
    for(;;){
      const params=new URLSearchParams({userId,includeItemTypes:kind??'Movie,Series',startIndex:String(start),limit:'200',enableTotalRecordCount:'true',sortBy:'SortName',sortOrder:'Ascending'});
      if(parentId)params.set('parentId',parentId);
      const page=await this.read(`Genres?${params}`,parsePage);
      for(const item of page.Items)if(item.Name?.trim())names.add(item.Name.trim());
      start+=page.Items.length;
      if(!page.Items.length||start>=page.TotalRecordCount)break;
      if(start>=10000)throw new JellyfinError(400,'Choose a library to narrow the genre list.');
    }
    return [...names].sort((a,b)=>a.localeCompare(b));
  }
  selectionItems(userId:string,search:string,start=0){
    const params=new URLSearchParams({userId,recursive:'true',includeItemTypes:'Movie,Series,Episode,Audio,MusicAlbum,MusicVideo',searchTerm:search.trim(),startIndex:String(Math.max(0,start)),limit:'20',fields:'PrimaryImageAspectRatio',enableImages:'true',imageTypeLimit:'1',enableTotalRecordCount:'true',sortBy:'SortName',sortOrder:'Ascending'});
    return this.read(`Items?${params}`,parsePage);
  }
  itemsById(userId:string,ids:string[],parentId?:string,types='Movie,Episode'){
    const safe=[...new Set(ids.filter(id=>/^[a-zA-Z0-9-]{1,100}$/.test(id)))].slice(0,40);
    if(!safe.length)return Promise.resolve({Items:[] as ItemDto[],TotalRecordCount:0});
    const params=new URLSearchParams({userId,ids:safe.join(','),recursive:'true',includeItemTypes:types,limit:'40',enableUserData:'true',fields:'Overview,Genres,ProviderIds,PrimaryImageAspectRatio',enableImages:'true',imageTypeLimit:'1'});
    if(parentId)params.set('parentId',parentId);
    return this.read(`Items?${params}`,parsePage,0);
  }
  item(userId: string, id: string) { return this.read(this.version >= 12 ? `Items/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}` : `Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(id)}`, parseItem, 900000); }
  nextUp(userId:string, limit=12, parentId?:string,seriesId?:string) {
    const params=new URLSearchParams({userId,limit:String(Math.max(1,Math.min(40,limit))),fields:'Overview,Genres',enableImages:'true',enableUserData:'true',enableTotalRecordCount:'true',enableResumable:'true',enableRewatching:'false'});
    if(parentId)params.set('parentId',parentId);
    if(seriesId)params.set('seriesId',seriesId);
    return this.read(`Shows/NextUp?${params}`,parsePage,0);
  }
  seasons(userId: string, seriesId: string) { return this.read(`Shows/${encodeURIComponent(seriesId)}/Seasons?userId=${encodeURIComponent(userId)}`, parsePage); }
  async adjacentEpisodes(userId:string,seriesId:string,itemId:string) {
    const page=await this.read(`Shows/${encodeURIComponent(seriesId)}/Episodes?${new URLSearchParams({userId,adjacentTo:itemId,isMissing:'false',fields:'Overview',enableUserData:'true',enableImages:'false'})}`,parsePage);
    const index=page.Items.findIndex(item=>item.Id===itemId);
    return index<0?{}:{previous:page.Items[index-1],next:page.Items[index+1]};
  }
  async nextEpisode(userId:string,seriesId:string,itemId:string) {
    const page=await this.read(`Shows/${encodeURIComponent(seriesId)}/Episodes?${new URLSearchParams({userId,startItemId:itemId,isMissing:'false',limit:'2',fields:'Overview',enableUserData:'true',enableTotalRecordCount:'true'})}`,parsePage);
    return page.Items[0]?.Id===itemId?page.Items[1]:undefined;
  }
  episodes(userId: string, seriesId: string, seasonId: string, start = 0) { return this.read(`Shows/${encodeURIComponent(seriesId)}/Episodes?${new URLSearchParams({ userId, seasonId, startIndex: String(start), limit: '40', fields: 'Overview,Genres,People,ProviderIds,PrimaryImageAspectRatio', enableImages:'true',enableImageTypes:'Primary,Thumb',imageTypeLimit:'1',enableUserData:'true',enableTotalRecordCount: 'true' })}`, parsePage); }
  async image(id: string, type: 'Primary' | 'Backdrop' | 'Logo' | 'Thumb' | 'Banner', tag: string, width: number): Promise<Blob> {
    const key = `Items/${encodeURIComponent(id)}/Images/${type}${type === 'Backdrop' ? '/0' : ''}?${new URLSearchParams({ tag, maxWidth: String(Math.min(width, 3840)), quality: type === 'Backdrop' || type === 'Thumb' ? '92' : '85' })}`;
    const cached = this.images.get(key);
    if (cached && cached.expires > this.now()) return cached.promise;
    const entry = { promise: this.request(key, 'GET', undefined, true).then(value => {
      const blob = value as Blob;
      if (!blob.type.startsWith('image/')) throw new JellyfinError(0, 'Artwork unavailable.');
      return blob;
    }), expires: this.now() + 300000 };
    // Rejected promises remain briefly cached; no image-error retry loops on rerender.
    entry.promise = entry.promise.catch(error => { entry.expires = this.now() + 120000; throw error; });
    this.images.set(key, entry); if (this.images.size > 40) this.images.delete(this.images.keys().next().value!);
    return entry.promise;
  }
  /** Explicit user action only; watched history, never library metadata. */
  setWatched(userId:string,itemId:string,played:boolean):Promise<boolean>{
    const key=`${userId}:${itemId}`;const pending=this.watchedPending.get(key);if(pending)return pending;
    const operation=this.changeWatched(userId,itemId,played).finally(()=>this.watchedPending.delete(key));this.watchedPending.set(key,operation);return operation;
  }
  private async changeWatched(userId:string,itemId:string,played:boolean):Promise<boolean>{
    const result=await this.request(`UserPlayedItems/${encodeURIComponent(itemId)}?${new URLSearchParams({userId})}`,played?'POST':'DELETE');
    // User-data changes do not invalidate cached artwork.
    this.cache.clear();
    if(record(result)&&typeof result.Played==='boolean')return result.Played;
    const item=await this.item(userId,itemId);
    if(typeof item.UserData?.Played!=='boolean')throw new JellyfinError(0,'Jellyfin did not confirm the watched status. Reload this page to check.');
    return item.UserData.Played;
  }
  /** Personal favorites only. Jellyfin enforces item access and user permissions. */
  setFavorite(userId:string,itemId:string,favorite:boolean):Promise<boolean>{
    const key=JSON.stringify([userId,itemId]);const pending=this.favoritePending.get(key);if(pending)return pending;
    const operation=this.changeFavorite(userId,itemId,favorite).finally(()=>this.favoritePending.delete(key));
    this.favoritePending.set(key,operation);return operation;
  }
  private async changeFavorite(userId:string,itemId:string,favorite:boolean):Promise<boolean>{
    const result=await this.request(`UserFavoriteItems/${encodeURIComponent(itemId)}?${new URLSearchParams({userId})}`,favorite?'POST':'DELETE');
    // Invalidate metadata reads, keeping image blobs intact. Mounted cards update locally.
    this.favoriteRevision++;this.cache.clear();this.pending.clear();
    if(record(result)&&typeof result.IsFavorite==='boolean')return result.IsFavorite;
    const item=await this.item(userId,itemId);
    if(typeof item.UserData?.IsFavorite!=='boolean')throw new JellyfinError(0,'Jellyfin did not confirm the favorite status. Reload this page to check.');
    return item.UserData.IsFavorite;
  }
  clearDeviceSessions(){this.cache.delete('frame-device-sessions');}
  async revokeDevice(deviceId:string){
    if(!deviceId.trim()||deviceId.length>100||deviceId===this.deviceId)throw new JellyfinError(400,'Use Sign Out to end this device’s session.');
    const user=parseUser(await this.request('Users/Me','GET',undefined,false,false,undefined,false,true));
    if(!user.Policy?.IsAdministrator)throw new JellyfinError(403,'Only a Jellyfin administrator can revoke device access.');
    await this.request(`Devices?${new URLSearchParams({id:deviceId})}`,'DELETE',undefined,false,false,undefined,false,true);
    this.clearDeviceSessions();
  }
  deviceSessions():Promise<{available:true;rows:DeviceSession[]}|{available:false;reason:string}>{
    const key='frame-device-sessions';const cached=this.cache.get(key);
    if(cached&&cached.expires>this.now())return Promise.resolve(cached.value as Awaited<ReturnType<JellyfinClient['deviceSessions']>>);
    const existing=this.pending.get(key);if(existing)return existing as ReturnType<JellyfinClient['deviceSessions']>;
    const promise=this.request('Sessions?activeWithinSeconds=86400','GET',undefined,false,false,undefined,false,true).then(value=>Array.isArray(value)?{available:true as const,rows:parseDeviceSessions(value)}:{available:false as const,reason:'This server did not return a supported session list.'}).catch(error=>({available:false as const,reason:error instanceof JellyfinError&&[401,403].includes(error.status)?'Jellyfin does not permit this account to view sessions.':'Devices are unavailable right now. Browsing and playback are unchanged.'})).then(result=>{
      if(!this.controller.signal.aborted)this.cache.set(key,{value:result,expires:this.now()+30000});return result;
    }).finally(()=>{if(this.pending.get(key)===promise)this.pending.delete(key);});
    this.pending.set(key,promise);return promise;
  }
  /** Optional capability: failure must never expire a working playback session. */
  mediaSegments(itemId:string){return this.mediaSegmentInfo(itemId).then(info=>info.segments);}
  refreshMediaSegments(itemId:string){this.cache.delete(`MediaSegments/${encodeURIComponent(itemId)}`);return this.mediaSegmentInfo(itemId);}
  mediaSegmentInfo(itemId:string):Promise<SegmentInfo>{
    const key=`MediaSegments/${encodeURIComponent(itemId)}`;
    const cached=this.cache.get(key);if(cached&&cached.expires>this.now())return Promise.resolve(cached.value as SegmentInfo);
    const pending=this.pending.get(key);if(pending)return pending as Promise<SegmentInfo>;
    const promise=this.request(key,'GET',undefined,false,false,undefined,false,true).then((raw):SegmentInfo=>({status:record(raw)&&Array.isArray(raw.Items)?'ready':'unavailable',segments:parseSegments(raw,itemId)})).catch((error):SegmentInfo=>({status:error instanceof JellyfinError&&[401,403].includes(error.status)?'restricted':error instanceof JellyfinError&&error.status===404?'unsupported':'unavailable',segments:[]})).then(value=>{
      if(!this.controller.signal.aborted){this.cache.set(key,{value,expires:this.now()+60000});if(this.cache.size>100)this.cache.delete(this.cache.keys().next().value!);}
      return value;
    }).finally(()=>{if(this.pending.get(key)===promise)this.pending.delete(key);});
    this.pending.set(key,promise);return promise;
  }
  playbackInfo(userId:string,itemId:string,body:Record<string,unknown>,signal?:AbortSignal){return this.request(`Items/${encodeURIComponent(itemId)}/PlaybackInfo`,'POST',{...body,UserId:userId},false,false,signal).then(parsePlaybackInfo);}
  reportPlayback(kind:'started'|'progress'|'stopped',report:PlayingReport,keepalive=false){const path=kind==='started'?'Sessions/Playing':kind==='progress'?'Sessions/Playing/Progress':'Sessions/Playing/Stopped';return this.request(path,'POST',report,false,false,undefined,keepalive).then(()=>{});}
  stopEncoding(playSessionId:string){if(!playSessionId)return Promise.resolve();return this.request(`Videos/ActiveEncodings?${new URLSearchParams({deviceId:this.deviceId,playSessionId})}`,'DELETE',undefined,false,false,undefined,true).then(()=>{});}
  beforeLogout(task:()=>Promise<void>){this.playbackCleanup.add(task);return()=>{this.playbackCleanup.delete(task);};}
  async logout() { try { await Promise.allSettled([...this.playbackCleanup].map(task=>task()));await this.request('Sessions/Logout', 'POST'); } finally { this.playbackCleanup.clear();this.dispose(); } }
}







