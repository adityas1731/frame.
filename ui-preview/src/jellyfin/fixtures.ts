import { fixtureArtwork } from './fixtureArtwork.ts';
import {playbackFixture} from '../playback/fixture.ts';
/** Synthetic Jellyfin contract fixtures. No HTTP, original assets or server credentials. */
import { media } from '../data/media.ts';
import type { Fetcher, ItemDto, Page } from './types.ts';
export const fixtureServer = { Id: 'frame-fixture', ServerName: 'Frame simulated collection', Version: '12.0.0' };
export const fixtureUser = { Id: 'fixture-user', Name: 'Alex (simulation)', Policy: { IsAdministrator: false } };
export const fixtureItems: ItemDto[] = Array.from({ length: 80 }, (_, i): ItemDto => {
  const m = media[i % media.length];
  return { Id: `fixture-${i}`, Name: `${m.title}${i >= media.length ? ` · Study ${Math.floor(i / media.length) + 1}` : ''}`, Type: m.kind === 'show' ? 'Series' : 'Movie', OriginalTitle: m.title, DateCreated: new Date(Date.UTC(2026,9,23)-i*86400000).toISOString(), PremiereDate: `${m.year}-05-20T00:00:00Z`, UserData: { IsFavorite: i % 5 === 0, Played: i % 4 === 0, PlaybackPositionTicks: i % 4 === 1 ? 9000000000 : 0, LastPlayedDate: new Date(Date.UTC(2026,9,23)-i*3600000).toISOString() }, Overview: i === 1 ? undefined : m.overview, ProductionYear: m.year, CommunityRating: i === 1 ? undefined : m.score, OfficialRating: m.rating, RunTimeTicks: m.runtime * 600000000, Genres: m.genres, People: [{ Name: m.director, Type: 'Director' }, ...m.cast.map(Name => ({ Name, Type: 'Actor', Role: 'Fictional performer' }))], ProviderIds: { Demo: m.id, Tmdb: String(990000000 + i), ...(m.kind === 'show' ? { Tvmaze: String(990000000 + i) } : {}) }, ImageTags: i === 1 ? {} : { Primary: 'original-fixture-art', Logo: 'original-logo' }, BackdropImageTags: i === 1 || i === 2 ? [] : ['original-fixture-art'] };
});
export const fixtureResumeEpisodes:ItemDto[]=Array.from({length:4},(_,i)=>({Id:`resume-episode-${i}`,Type:'Episode',Name:['The quiet signal','Another night','An open road','Returning home'][i],SeriesId:i<2?'fixture-2':i===2?'fixture-6':'fixture-10',SeriesName:i<2?'After Hours':i===2?'Small Wonders':'The Long Way Home',ParentIndexNumber:1,IndexNumber:i+1,RunTimeTicks:27000000000,ImageTags:{Primary:'original-fixture-art'},UserData:{Played:false,PlaybackPositionTicks:9000000000,LastPlayedDate:new Date(Date.UTC(2026,9,23,12-i)).toISOString()}}));
function page(items: ItemDto[], params: URLSearchParams): Page<ItemDto> { const start = Number(params.get('startIndex') || 0); const limit = Number(params.get('limit') || 40); return { Items: items.slice(start, start + limit), TotalRecordCount: items.length, StartIndex: start }; }
export function createFixtureFetch(version = '12.0.0'): Fetcher {
  const playback=playbackFixture();
  return async (input, init) => {
    const url = new URL(input); const path = url.pathname; const params = url.searchParams;
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const result=playback.handle(path,init);if(result)return result;
    if(path.startsWith('/UserPlayedItems/')&&['POST','DELETE'].includes(init?.method??'')){
      if(params.get('userId')!==fixtureUser.Id)return json({},403);
      const id=decodeURIComponent(path.split('/').at(-1)!);const item=[...fixtureItems,...fixtureResumeEpisodes,...playback.episodes].find(item=>item.Id===id);if(!item)return json({},404);
      const played=init?.method==='POST';if(item.Type==='Series')for(const episode of [...fixtureResumeEpisodes,...playback.episodes].filter(episode=>episode.SeriesId===id))playback.setWatched(episode,played);
      return json(playback.setWatched(item,played));
    }
    if(path.startsWith('/UserFavoriteItems/')&&['POST','DELETE'].includes(init?.method??'')){
      if(params.get('userId')!==fixtureUser.Id)return json({},403);
      const id=decodeURIComponent(path.split('/').at(-1)!);const item=[...fixtureItems,...fixtureResumeEpisodes,...playback.episodes].find(item=>item.Id===id);
      return item?json(playback.setFavorite(item,init?.method==='POST')):json({},404);
    }
    if (path === '/System/Info/Public') return json({ ...fixtureServer, Version: version });
    if (path === '/Users/AuthenticateByName') return json({ AccessToken: 'fictional-session-token', User: fixtureUser, ServerId: fixtureServer.Id });
    if (path === '/Sessions/Logout') return new Response(null, { status: 204 });
    if (path === `/Users/${fixtureUser.Id}`) return json(fixtureUser);
    if (path === '/UserViews' || path.endsWith('/Views')) return json({ Items: [{ Id: 'fixture-movies', Name: 'Movie nights', CollectionType: 'movies' }, { Id: 'fixture-shows', Name: 'One more episode', CollectionType: 'tvshows' }], TotalRecordCount: 2 });
    if (path.endsWith('/RemoteImages')) return json({ Images: [{ ProviderName: 'TheMovieDb', Type: 'Backdrop', Width: 3840, Height: 2160, Url: 'https://image.tmdb.org/t/p/original/frame-demo.jpg' }] });
    if (path.includes('/Images/')) return new Response(fixtureArtwork(path), { headers: { 'Content-Type': 'image/svg+xml' } });
    if (path.endsWith('/Seasons')) return json({ Items: [{ Id: 'fixture-season-0', Name: 'Specials', Type: 'Season', IndexNumber: 0 }, { Id: 'fixture-season-1', Name: 'Season 1', Type: 'Season', IndexNumber: 1 }], TotalRecordCount: 2 });
    if (path.endsWith('/Episodes')) {let rows=playback.episodes.map(e=>playback.updated({...e,ParentIndexNumber:params.get('seasonId')?.endsWith('-0')?0:1}));if(params.has('adjacentTo')){const index=rows.findIndex(e=>e.Id===params.get('adjacentTo'));rows=index<0?[]:rows.slice(Math.max(0,index-1),index+2);}if(params.has('startItemId')){const start=rows.findIndex(e=>e.Id===params.get('startItemId'));rows=start<0?[]:rows.slice(start);}return json(page(rows,params));}
    if (path === '/Shows/NextUp') {
      const recent=playback.episodes.map(playback.updated).filter(e=>e.UserData?.LastPlayedDate).sort((a,b)=>Date.parse(b.UserData!.LastPlayedDate!)-Date.parse(a.UserData!.LastPlayedDate!))[0];
      const next=recent?.UserData?.Played?playback.episodes.map(playback.updated).find(e=>(e.IndexNumber??0)>(recent.IndexNumber??0)&&!e.UserData?.Played):recent;
      const rows=[...(next?[next]:[]),...fixtureResumeEpisodes.map(playback.updated).filter(e=>!recent||e.SeriesId!==recent.SeriesId)];
      return json(page(rows.filter(e=>(!params.get('seriesId')||e.SeriesId===params.get('seriesId'))&&!e.UserData?.Played),params));
    }
    if (path === '/Items') {
      const term = (params.get('searchTerm') ?? '').toLowerCase();
      if (term === 'error') return json({}, 503);
      let items: ItemDto[] = [...fixtureItems, ...(params.get('filters') === 'IsResumable' ? [...fixtureResumeEpisodes,...playback.episodes.map(playback.updated).filter(e=>e.UserData?.LastPlayedDate)] : []), { Id: 'health-episode', Name: 'An incomplete episode', Type: 'Episode', ParentIndexNumber: 0, UserData: { Played: false } }, { Id: 'health-season', Name: 'Specials', Type: 'Season', IndexNumber: 0 }].map(playback.updated).filter(item => (!params.get('includeItemTypes') || params.get('includeItemTypes')!.split(',').includes(item.Type!)) && (!term || item.Name!.toLowerCase().includes(term)) && (params.get('filters') !== 'IsResumable' || !!item.UserData?.PlaybackPositionTicks && !item.UserData?.Played) && (params.get('isFavorite') !== 'true' || item.UserData?.IsFavorite === true) && (!params.get('parentId') || item.Type === (params.get('parentId') === 'fixture-movies' ? 'Movie' : 'Series')));
      items = items.filter(item => (!params.get('genres') || item.Genres?.includes(params.get('genres')!)) && (!params.get('years') || item.ProductionYear === Number(params.get('years'))) && (!params.has('minCommunityRating') || (item.CommunityRating ?? -1) >= Number(params.get('minCommunityRating'))) && (!params.has('isPlayed') || (item.UserData?.Played ?? false) === (params.get('isPlayed') === 'true')));
      if (params.get('maxPremiereDate')) items = items.filter(item => !!item.PremiereDate && Date.parse(item.PremiereDate) <= Date.parse(params.get('maxPremiereDate')!));
      if (params.get('sortBy') === 'DatePlayed') items.sort((a,b) => (Date.parse(b.UserData?.LastPlayedDate ?? '')||0)-(Date.parse(a.UserData?.LastPlayedDate ?? '')||0));
      if (params.get('sortBy') === 'DateCreated') items.sort((a,b)=>(Date.parse(b.DateCreated??'')||0)-(Date.parse(a.DateCreated??'')||0));
      if (params.get('sortBy') === 'PremiereDate') items.sort((a,b)=>(Date.parse(b.PremiereDate??'')||0)-(Date.parse(a.PremiereDate??'')||0));
      if (params.get('sortBy') === 'SortName') items = [...items].sort((a,b) => a.Name!.localeCompare(b.Name!));
      if (params.get('sortBy') === 'CommunityRating') items = [...items].sort((a,b) => (b.CommunityRating ?? -1) - (a.CommunityRating ?? -1));
      return json(page(items, params));
    }
    if (/\/Items\/[^/]+$/.test(path)) { const item = [...fixtureItems,...fixtureResumeEpisodes,...playback.episodes].map(playback.updated).find(item => item.Id === path.split('/').at(-1)); return json(item ? {...item,RunTimeTicks:300000000,UserData:{...item.UserData,PlaybackPositionTicks:(item.UserData?.PlaybackPositionTicks??0)>300000000?80000000:item.UserData?.PlaybackPositionTicks??0}} : {}, item ? 200 : 404); }
    return json({}, 404);
  };
}








