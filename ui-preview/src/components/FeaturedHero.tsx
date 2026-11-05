import {displayGenres} from '../providers/genres';
import type { ReactNode } from 'react';



import {CarouselControls} from './CarouselControls';
export interface FeaturedStory { id: string; title: string; description: string; metadata: string[]; genres?: string[] }
interface Props { story: FeaturedStory; artwork: ReactNode; actions: ReactNode; titles: string[]; active: number; progress?:number; select: (index: number) => void; previous: () => void; next: () => void }
/** Shared presentation contract; each mode has its own spatial structure and typography. */
export function FeaturedHero({ story, artwork, actions, titles, active, progress, select, previous, next }: Props) {

  const copy = <>
    
    <h2 title={story.title}>{story.title}</h2>
    <div className="hero-meta">{story.metadata.filter(Boolean).map((m, i) => <span key={`${m}:${i}`}>{m}</span>)}{displayGenres(story.genres)[0] && <span>{displayGenres(story.genres)[0]}</span>}</div>
    <p>{story.description}</p>
    <div className="hero-buttons">{actions}</div>
  </>;
  return <section className="cinema-hero featured-stage" aria-label="Featured collection">
    <div className="cinema-backdrop" key={story.id}>{artwork}</div><div className="cinema-shade"/>
    <div className="cinema-copy" key={`${story.id}-copy`}>{copy}</div>
    <div className="cinema-feature-nav"><CarouselControls titles={titles} active={active} progress={progress} select={select} previous={previous} next={next}/></div>
  </section>;
}


