import {useServerFeatured} from '../state/featured';
import {HomeWidgets} from '../studio/Widgets';
import {FeaturedServerArtwork} from '../components/FeaturedServerArtwork';
import {FeaturedHero} from '../components/FeaturedHero';
import {useFeaturedCarousel} from '../state/useFeaturedCarousel';
import {Link} from 'react-router';
import {useConnection} from '../jellyfin/useConnection';
import {useRemote} from '../jellyfin/hooks';
import {itemTitle, runtime} from '../jellyfin/presentation';
import {EmptyState} from '../components/Primitives';
import {RequestStatus} from './LiveShared';
export function LiveHome() {
  const { client, session } = useConnection();
  const data = useRemote('home', () => client!.items(session!.user.Id, { sort: 'DateCreated', limit: 40 }));
  const items = data.data?.Items ?? [];
  const featured=useServerFeatured('discover');
  const carousel = useFeaturedCarousel(featured.length);
  const item = featured[carousel.active];
  return <div className={`home-page ${!item?'home-no-featured':''}`}>
    <RequestStatus {...data} stale={!!data.data}/>
    {item && <FeaturedHero story={{ id: item.Id, title: itemTitle(item), description: item.Overview ?? '', metadata: [item.ProductionYear ? String(item.ProductionYear) : '', item.OfficialRating ?? '', item.Type==='Series'?'':runtime(item) ?? ''], genres: item.Genres }} artwork={<FeaturedServerArtwork item={item}/>} titles={featured.map(itemTitle)} {...carousel} actions={<>
      <Link className="button hero-primary" to={`/item/${encodeURIComponent(item.Id)}`}>Explore</Link>
    </>}/>}
    {items.length ? <HomeWidgets/> : !data.loading && !data.error && <EmptyState title="Your Next Chapter Starts Here." description="No movies or series are visible to this account."/>}  </div>;
}
