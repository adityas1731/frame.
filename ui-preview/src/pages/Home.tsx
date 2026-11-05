import {useFeaturedPool} from '../state/featured';
import { HomeWidgets } from '../studio/Widgets';
import { FeaturedHero } from '../components/FeaturedHero';
import { useFeaturedCarousel } from '../state/useFeaturedCarousel';
import { Link } from 'react-router';
import { Bookmark, Check, Info } from 'lucide-react';
import { media, duration } from '../data/media';
import { usePreview } from '../state/PreviewContext';
import { Artwork } from '../components/Artwork';


export function Home() {
  const { watchlist, toggleWatchlist, notify } = usePreview();
  const featured=useFeaturedPool(media,'discover');
  const carousel = useFeaturedCarousel(featured.length);
  const { active } = carousel;
  const item = featured[active];
  const saved = !!item&&watchlist.includes(item.id);
  return <div className={`home-page ${!item?'home-no-featured':''}`}>
    {item&&<FeaturedHero story={{ id: item.id, title: item.title, description: item.overview, metadata: [String(item.year), item.rating, item.kind === 'show' ? `${item.seasons} seasons` : duration(item.runtime)], genres: item.genres }} artwork={<Artwork item={item}/>} titles={featured.map(m => m.title)} {...carousel} actions={<>
      <Link className="button hero-primary" to={`/item/${item.id}`}><Info size={17}/> Explore</Link>
      <button className="button hero-secondary" aria-pressed={saved} onClick={() => { toggleWatchlist(item.id); notify(saved ? 'Removed from your watchlist' : 'Added to your watchlist'); }}>{saved ? <Check size={17}/> : <Bookmark size={17}/>} {saved ? 'On your list' : 'Watchlist'}</button>
    </>}/>}
    <HomeWidgets/>
  </div>;
}





