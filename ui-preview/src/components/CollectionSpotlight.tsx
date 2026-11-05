import {useFeaturedPool} from '../state/featured';
import type {FeaturedPage} from '../state/featuredModel';
import type {ReactNode} from 'react';
import {Link} from 'react-router';
import {ArrowUpRight} from 'lucide-react';
import {useFeaturedCarousel} from '../state/useFeaturedCarousel';
import {CarouselControls} from './CarouselControls';
export interface CollectionStory {id:string;title:string;description?:string;meta?:string;to:string;artwork:ReactNode}
/** Presentation for the page's permitted banner candidates and local preferences. */
export function CollectionSpotlight({stories:allStories,pageTitle,page}:{stories:CollectionStory[];pageTitle?:string;context?:string;page:FeaturedPage}){
 const stories=useFeaturedPool(allStories,page);
 const carousel=useFeaturedCarousel(stories.length);const story=stories[carousel.active];if(!story)return null;
 return <section className={`collection-spotlight featured-stage ${pageTitle?'collection-spotlight-hero':''}`} aria-label="Featured in this collection">
 <div className="collection-spotlight-art" key={story.id}>{story.artwork}</div>
 {pageTitle&&<h1 className="sr-only">{pageTitle}</h1>}
 <div className="collection-spotlight-copy"><h2>{story.title}</h2>{story.meta&&<p className="spotlight-meta">{story.meta}</p>}{story.description&&<p className="spotlight-description">{story.description}</p>}<Link className="button spotlight-action" to={story.to}>Explore <ArrowUpRight size={19}/></Link></div>
 <CarouselControls titles={stories.map(s=>s.title)} {...carousel}/></section>;
}
