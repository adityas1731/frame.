import {TitleTagsProvider} from '../state/TitleTags';
import {TagsPage} from '../pages/Tags';
import {WatchlistProvider} from '../state/WatchlistContext';
import {WatchlistPage} from '../pages/Watchlist';
import '../build/flags';
import {lazy,Suspense} from 'react';
import { StudioProvider } from '../studio/StudioContext';
import { OnlineProvider } from '../providers/OnlineProvider';
import { HashRouter, Link, Route, Routes } from 'react-router';
import { PreviewProvider } from '../state/PreviewContext';
import { Home } from '../pages/Home';
import { LibraryPage } from '../pages/Library';
import { Detail, Person } from '../pages/Detail';
import { Settings } from '../pages/Settings';
import { EmptyState } from '../components/Primitives';
import { Shell } from './Shell';
import { ConnectionProvider } from '../jellyfin/ConnectionContext';
import { useConnection } from '../jellyfin/useConnection';
import { Connect } from '../pages/Connect';
import { LiveHome, LiveBrowse, LiveDetail } from '../pages/Live';
import type { CollectionMode } from '../pages/Library';
import { PlayerRoute } from '../playback/Player';

const PlayerPreviewRoute=import.meta.env.DEV?lazy(()=>import('../playback/PlayerPreviewRoute')):undefined;
const DiagnosticsPage=__FRAME_DIAGNOSTICS__?lazy(()=>import('../diagnostics/DiagnosticsPage')):undefined;

function HomeRoute() { return useConnection().session ? <LiveHome/> : <Home/>; }
function LibraryRoute({ mode }: { mode: CollectionMode }) { return useConnection().session ? <LiveBrowse mode={mode}/> : <LibraryPage mode={mode}/>; }
function DetailRoute() { return useConnection().session ? <LiveDetail/> : <Detail/>; }
function PersonRoute() { return useConnection().session ? <div className="content-page"><EmptyState title="A Story For Another Chapter." description="Jellyfin person browsing is not enabled in this milestone."/></div> : <Person/>; }

export function App() {
  return <PreviewProvider>
<ConnectionProvider><WatchlistProvider><StudioProvider><TitleTagsProvider><OnlineProvider><HashRouter>
<Routes>
{import.meta.env.DEV&&PlayerPreviewRoute&&<Route path="player-preview" element={<Suspense fallback={<p>Loading preview…</p>}><PlayerPreviewRoute/></Suspense>}/>}
<Route path="play/:itemId" element={<PlayerRoute/>}/>
<Route element={<Shell/>}>
<Route index element={<HomeRoute/>}/>
<Route path="movies" element={<LibraryRoute key="movies" mode="movies"/>}/>
<Route path="shows" element={<LibraryRoute key="shows" mode="shows"/>}/>
<Route path="library" element={<LibraryRoute key="library" mode="library"/>}/>
<Route path="watchlist" element={<WatchlistPage/>}/>
<Route path="favorites" element={<LibraryRoute key="favorites" mode="favorites"/>}/>
<Route path="tags" element={<TagsPage/>}/>
<Route path="search" element={<LibraryRoute key="search" mode="search"/>}/>
<Route path="item/:itemId" element={<DetailRoute key="detail"/>}/>
<Route path="person/:name" element={<PersonRoute/>}/>
<Route path="connect" element={<Connect/>}/>
<Route path="settings" element={<Settings/>}/>
{__FRAME_DIAGNOSTICS__&&DiagnosticsPage&&<Route path="settings/advanced/diagnostics" element={<Suspense fallback={<div className="content-page" role="status">Loading advanced tools…</div>}><DiagnosticsPage/></Suspense>}/>}
<Route path="*" element={<div className="content-page">
<EmptyState title="A Little Off The Beaten Path." description="That page isn’t in this collection.">
<Link className="button primary" to="/">Find your way home</Link>
</EmptyState>
</div>}/>
</Route>
</Routes>
</HashRouter></OnlineProvider></TitleTagsProvider></StudioProvider></WatchlistProvider></ConnectionProvider>
</PreviewProvider>;
}



