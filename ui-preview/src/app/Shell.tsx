import {AccessPanel} from '../access/AccessPanel';
import {MetadataCredit} from '../components/MetadataCredit';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { CircleAlert, RefreshCw, QrCode, ArrowLeft, ArrowUpRight, Bookmark, Check, Clapperboard, Film, Heart, House, Library, Music2, Menu, Search, Settings2, Tv, X, type LucideIcon } from 'lucide-react';
import {activeLibrary,libraryHeading} from './libraryNavigation';
import {useLibraries} from './useLibraries';
import { usePreview } from '../state/PreviewContext';
import { IconButton } from '../components/Primitives';
import { useConnection } from '../jellyfin/useConnection';

export function Shell() {
  const { watchlist, favorites, toast } = usePreview();
  const { client, session, message } = useConnection();
  const libraries=useLibraries();
  const libraryLinks=libraries.links;
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
  // Reset before paint so the new page never flashes at the previous scroll offset.
  useLayoutEffect(() => { setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }); setScrolled(false); }, [location.pathname]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === 'k') { event.preventDefault(); searchRef.current?.focus(); } if (event.key === 'Escape') setMobileOpen(false); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
  const submitSearch = (event: FormEvent) => { event.preventDefault(); const music=location.pathname==='/music'||location.pathname.startsWith('/music/');const library=new URLSearchParams(location.search).get('library');navigate(music?`/music?${new URLSearchParams({tab:'songs',q:search.trim(),...(library?{library}:{})})}`:`/search?q=${encodeURIComponent(search.trim())}`); searchRef.current?.blur(); };
  const selectedLibrary=libraryLinks.find(link=>activeLibrary(link.id,link.mode,location.pathname,location.search));
  const section = selectedLibrary?.title??(location.pathname.startsWith('/item/') ? 'Details' : location.pathname === '/' ? 'Discover' : ['/movies','/shows','/music'].includes(location.pathname) ? libraryHeading(libraries.items,location.pathname.slice(1)) : location.pathname.split('/')[1].replace(/^./, c => c.toUpperCase()));
  // No connection must never silently turn the user's library into demo content.
  if(!session&&location.pathname!=='/connect'&&!location.pathname.startsWith('/settings'))return <Navigate to="/connect" replace/>;
  const connectionPage=location.pathname==='/connect';
  return <div className={`app-shell ${connectionPage?'connection-shell':''} ${mobileOpen ? 'nav-open' : ''}`}>
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
<span className="nav-label">Your Library</span>
<nav><NavLink to="/" end className={({isActive})=>`nav-item ${isActive?'active':''}`}><House size={19}/><span className="nav-text">Home</span></NavLink>{libraryLinks.map(({id,mode,to,title,count})=>{const Icon:LucideIcon=mode==='movies'?Film:mode==='shows'?Tv:mode==='music'?Music2:Library;const active=activeLibrary(id,mode,location.pathname,location.search);return <Link key={id} to={to} className={`nav-item ${active?'active':''}`} aria-current={active?'page':undefined} aria-label={title} title={title}>
<Icon size={19}/>
<span className="nav-text">{title}</span>{count !== undefined && <span className="nav-count">{count}</span>}</Link>;})}<Link to="/library" className={`nav-item ${location.pathname==='/library'&&!selectedLibrary?'active':''}`} aria-current={location.pathname==='/library'&&!selectedLibrary?'page':undefined}><Library size={19}/><span className="nav-text">All libraries</span></Link></nav>
        <span className="nav-label personal-label">Saved</span>
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
<NavLink className="masthead-brand" to="/" end aria-label="frame. home">frame<span>.</span></NavLink>
{!connectionPage&&<><div className="topbar-location">
<IconButton className="mobile-menu" label={mobileOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMobileOpen(o => !o)}>{mobileOpen ? <X size={20}/> : <Menu size={20}/>}</IconButton>
<IconButton label="Go back" onClick={() => location.key === 'default' ? navigate('/') : navigate(-1)}>
<ArrowLeft size={18}/>
</IconButton>
<span className="breadcrumb">Your library <span>/</span> <strong>{section}</strong>
</span>
</div>
<nav className="cinema-top-links" aria-label="Cinema navigation">{libraryLinks.map(link=>{const active=activeLibrary(link.id,link.mode,location.pathname,location.search);return <Link key={link.id} to={link.to} className={active?'active':undefined} aria-current={active?'page':undefined} title={link.title}>{link.title}</Link>;})}<Link to="/library" className={location.pathname==='/library'&&!selectedLibrary?'active':undefined}>Your Library</Link></nav>
<div id="appearance-actions-slot"/>
<form className="global-search" onSubmit={submitSearch} role="search">
<Search size={16}/>
<input ref={searchRef} aria-label="Search your library" placeholder="Search your library" value={search} onChange={e => setSearch(e.target.value)}/>
<kbd>Ctrl K</kbd>
</form>
<span className="local-status">
<i/> {session ? (session.server.Id === 'frame-fixture' ? 'SIMULATED JELLYFIN' : 'JELLYFIN') : 'MOCK PREVIEW'}</span>
<div className="masthead-actions"><Link className="icon-button" to="/watchlist" aria-label="Watchlist" title="Watchlist"><Bookmark size={20}/></Link><Link className="icon-button" to="/settings" aria-label="Settings" title="Settings"><Settings2 size={20}/></Link><button className="icon-button qr-access-trigger" aria-label="Open frame. on another device" title="QR access" onClick={()=>setAccessOpen(true)}><QrCode size={21}/></button><NavLink className="icon-button favorites-access-trigger" to="/favorites" aria-label="Favorites" title="Favorites"><Heart size={20}/></NavLink></div>
</>}
</header>
      {message && location.pathname!=='/connect' && <section className="connection-notice" role="status" aria-label="Server connection update">
<CircleAlert size={20} aria-hidden="true"/>
<div className="connection-notice-copy"><strong>Server Connection</strong><p>{message}</p></div>
<Link className="connection-notice-action" to="/connect">Reconnect<ArrowUpRight size={16} aria-hidden="true"/></Link>
</section>}
      <main id="main-content" tabIndex={-1}>
<div key={`${location.pathname}:${session?.server.Id ?? 'mock'}:${session?.user.Id ?? ''}:${session?.created ?? ''}`} className={`page-transition${location.pathname.startsWith('/item/')?' title-transition':''}`}>
<Outlet/>
</div>
</main><MetadataCredit/>

    </div>
    {toast && <div className="toast" role="status">
<Check size={17}/>{toast}</div>}
    {accessOpen && <AccessPanel close={()=>setAccessOpen(false)}/>}
  </div>;
}




