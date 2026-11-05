import {AccessPanel} from '../access/AccessPanel';
import {MetadataCredit} from '../components/MetadataCredit';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { CircleAlert, RefreshCw, QrCode, ArrowLeft, ArrowUpRight, Bookmark, Check, Clapperboard, Film, Heart, House, Library, Menu, Search, Settings2, Tv, X, type LucideIcon } from 'lucide-react';
import { media } from '../data/media';
import { usePreview } from '../state/PreviewContext';
import { IconButton } from '../components/Primitives';
import { useConnection } from '../jellyfin/useConnection';
import { useRemote } from '../jellyfin/hooks';

const mainNavigation: { to: string; title: string; icon: LucideIcon; count?: number }[] = [
  { to: '/', title: 'Home', icon: House }, { to: '/movies', title: 'Movies', icon: Film, count: media.filter(m => m.kind === 'movie').length }, { to: '/shows', title: 'TV Shows', icon: Tv, count: media.filter(m => m.kind === 'show').length }, { to: '/library', title: 'All libraries', icon: Library },
];
export function Shell() {
  const { watchlist, favorites, toast } = usePreview();
  const { client, session, message } = useConnection();
  const counts = useRemote('navigation-counts', () => client && session ? client.counts(session.user.Id) : Promise.resolve(undefined));
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [scrolled,setScrolled]=useState(false);
  useEffect(()=>{const update=()=>setScrolled(window.scrollY>32);update();window.addEventListener('scroll',update,{passive:true});return()=>window.removeEventListener('scroll',update);},[]);
  const immersiveHeader=['/','/movies','/shows'].includes(location.pathname)||location.pathname.startsWith('/item/');
  useEffect(() => { if (mobileOpen) document.getElementById('close-drawer')?.focus(); }, [mobileOpen]);
  const [search, setSearch] = useState('');
  useEffect(() => { setMobileOpen(false); window.scrollTo({ top: 0 }); }, [location.pathname]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === 'k') { event.preventDefault(); searchRef.current?.focus(); } if (event.key === 'Escape') setMobileOpen(false); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
  const submitSearch = (event: FormEvent) => { event.preventDefault(); navigate(`/search?q=${encodeURIComponent(search.trim())}`); searchRef.current?.blur(); };
  const section = location.pathname.startsWith('/item/') ? 'Details' : location.pathname === '/' ? 'Discover' : location.pathname === '/shows' ? 'TV Shows' : location.pathname.split('/')[1].replace(/^./, c => c.toUpperCase());
  return <div className={`app-shell ${mobileOpen ? 'nav-open' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    {mobileOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}
    <aside className="sidebar" aria-label="Main navigation" inert={!mobileOpen}>
      <button id="close-drawer" className="drawer-close icon-button" aria-label="Close navigation panel" onClick={() => setMobileOpen(false)}>
<X size={20}/>
</button>
      <Link className="brand" to="/" aria-label="frame. home">
<span className="brand-mark">
<Clapperboard size={21}/>
</span>
<span className="brand-word">frame<span>.</span>
</span>
</Link>
      <div className="sidebar-body">
<span className="nav-label">YOUR LIBRARY</span>
<nav>{mainNavigation.map(({ to, title, icon: Icon, count }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} aria-label={title} title={title}>
<Icon size={19}/>
<span className="nav-text">{title}</span>{count !== undefined && <span className="nav-count">{session ? (to === '/movies' ? counts.data?.movies : counts.data?.series) ?? '—' : count}</span>}</NavLink>)}</nav>
        <span className="nav-label personal-label">JUST FOR YOU</span>
<nav>
<NavLink to="/watchlist" className="nav-item" title="Watchlist" aria-label="Watchlist">
<Bookmark size={19}/>
<span className="nav-text">Watchlist</span>
{!session && <span className="nav-count">{watchlist.length}</span>}
</NavLink>
<NavLink to="/favorites" className="nav-item" title="Favorites" aria-label="Favorites">
<Heart size={19}/>
<span className="nav-text">Favorites</span>
{!session && <span className="nav-count">{favorites.length}</span>}
</NavLink>
</nav>
        <div className="sidebar-collection">
<span className="collection-orbit"/>
<span>Make room<br/>for a good story.</span>
<Link to="/library" aria-label="Explore the collection">
<ArrowUpRight size={18}/>
</Link>
</div>
      </div>
      <div className="sidebar-bottom">
{session&&<button className="nav-item" onClick={()=>{client?.invalidate();window.dispatchEvent(new Event('frame:server-reload'));setMobileOpen(false);}}><RefreshCw size={19}/><span className="nav-text">Reload</span></button>}
<NavLink to="/settings" className="nav-item" title="Settings" aria-label="Settings">
<Settings2 size={19}/>
<span className="nav-text">Settings</span>
</NavLink>
<button className="nav-item" aria-label="Open frame. on another device" onClick={()=>setAccessOpen(true)}><QrCode size={20}/><span className="nav-text">QR access</span></button>
</div>
    </aside>
    <div className="workspace" inert={mobileOpen}>
<header className={`topbar ${immersiveHeader?'topbar-immersive':''} ${scrolled?'topbar-scrolled':''}`}>
<Link className="masthead-brand" to="/" aria-label="frame. home">frame<span>.</span></Link>
<div className="topbar-location">
<IconButton className="mobile-menu" label={mobileOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMobileOpen(o => !o)}>{mobileOpen ? <X size={20}/> : <Menu size={20}/>}</IconButton>
<IconButton label="Go back" onClick={() => location.key === 'default' ? navigate('/') : navigate(-1)}>
<ArrowLeft size={18}/>
</IconButton>
<span className="breadcrumb">Your library <span>/</span> <strong>{section}</strong>
</span>
</div>
<nav className="cinema-top-links" aria-label="Cinema navigation"><NavLink to="/" end>Discover</NavLink><NavLink to="/movies">Movies</NavLink><NavLink to="/shows">TV shows</NavLink><NavLink to="/library">Your Library</NavLink></nav>
<div id="appearance-actions-slot"/>
<form className="global-search" onSubmit={submitSearch} role="search">
<Search size={16}/>
<input ref={searchRef} aria-label="Search your library" placeholder="Search your library" value={search} onChange={e => setSearch(e.target.value)}/>
<kbd>Ctrl K</kbd>
</form>
<span className="local-status">
<i/> {session ? (session.server.Id === 'frame-fixture' ? 'SIMULATED JELLYFIN' : 'JELLYFIN') : 'MOCK PREVIEW'}</span>
<div className="masthead-actions"><Link className="icon-button" to="/watchlist" aria-label="Watchlist" title="Watchlist"><Bookmark size={20}/></Link><Link className="icon-button" to="/settings" aria-label="Settings" title="Settings"><Settings2 size={20}/></Link><button className="icon-button qr-access-trigger" aria-label="Open frame. on another device" title="QR access" onClick={()=>setAccessOpen(true)}><QrCode size={21}/></button><NavLink className="icon-button favorites-access-trigger" to="/favorites" aria-label="Favorites" title="Favorites"><Heart size={20}/></NavLink></div>
</header>
      {message && <section className="connection-notice" role="status" aria-label="Server connection update">
<CircleAlert size={20} aria-hidden="true"/>
<div className="connection-notice-copy"><strong>Server Connection</strong><p>{message}</p></div>
<Link className="connection-notice-action" to="/connect">Reconnect<ArrowUpRight size={16} aria-hidden="true"/></Link>
</section>}
      <main id="main-content" tabIndex={-1}>
<div key={`${location.pathname}:${session?.server.Id ?? 'mock'}:${session?.user.Id ?? ''}:${session?.created ?? ''}`} className="page-transition">
<Outlet/>
</div>
</main><MetadataCredit/>

    </div>
    {toast && <div className="toast" role="status">
<Check size={17}/>{toast}</div>}
    {accessOpen && <AccessPanel close={()=>setAccessOpen(false)}/>}
  </div>;
}




