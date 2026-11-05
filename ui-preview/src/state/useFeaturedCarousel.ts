import { useEffect, useRef, useState } from 'react';
import { usePreview } from './PreviewContext';
import {advanceFeatured,FEATURE_INTERVAL_MS} from './carouselTiming';
export function useFeaturedCarousel(count: number) {
  const { preferences } = usePreview();
  const [index, setIndex] = useState(0);
  const elapsed=useRef(0);const [progress,setProgress]=useState(0);
  const active = count ? index % count : 0;
  const autoPlaying=count>1&&preferences.heroAutoAdvance&&!preferences.reducedMotion&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (count < 2 || !preferences.heroAutoAdvance || preferences.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let last=performance.now();
    const timer=setInterval(()=>{const now=performance.now();const delta=Math.min(250,now-last);last=now;
      const step=advanceFeatured(elapsed.current,delta,count,document.hidden||!!document.querySelector('.featured-stage :focus-visible'));
      elapsed.current=step.elapsed;if(step.advance)setIndex(i=>(i+1)%count);setProgress(elapsed.current/FEATURE_INTERVAL_MS);
    },100);
    return () => clearInterval(timer);
  }, [count, preferences.heroAutoAdvance, preferences.reducedMotion]);
  const reset=()=>{elapsed.current=0;setProgress(0);};
  return {active,progress:autoPlaying?progress:0,autoPlaying,select:(value:number)=>{reset();setIndex(Math.max(0,value));},previous:()=>{reset();setIndex(i=>(i-1+count)%Math.max(1,count));},next:()=>{reset();setIndex(i=>(i+1)%Math.max(1,count));}};
}

