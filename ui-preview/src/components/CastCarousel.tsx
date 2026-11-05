import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {Link} from 'react-router';
import type {ItemDto} from '../jellyfin/types';
import {CastAvatar} from './CastAvatar';

type Person=NonNullable<ItemDto['People']>[number];
/** Whole-card pages, with no native horizontal scroll area. */
export function CastCarousel({people,sourceControl,attribution,personLink}:{people:Person[];sourceControl?:ReactNode;attribution?:ReactNode;personLink?:(person:Person)=>string}){
 const viewport=useRef<HTMLDivElement>(null);const pointer=useRef<{id:number;x:number;y:number}|null>(null);
 const [capacity,setCapacity]=useState(6);const [requestedPage,setPage]=useState(0);
 useEffect(()=>{
  const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width??0;if(width)setCapacity(Math.max(1,Math.floor((width+24)/140)));});
  if(viewport.current)observer.observe(viewport.current);return()=>observer.disconnect();
 },[]);
 if(!people.length)return null;
 const pages=Array.from({length:Math.ceil(people.length/capacity)},(_,i)=>people.slice(Math.min(i*capacity,Math.max(0,people.length-capacity)),Math.min(i*capacity,Math.max(0,people.length-capacity))+capacity));
 const page=Math.min(requestedPage,Math.max(0,pages.length-1));
 function move(delta:number){setPage(Math.max(0,Math.min(pages.length-1,page+delta)));}
 function card(person:Person,index:number){const content=<><CastAvatar person={person} index={index}/><span><strong>{person.Name}</strong>{person.Role&&<small>{person.Role}</small>}</span></>;return personLink?<Link className="cast-person" key={`${person.Id??person.Name}:${index}`} to={personLink(person)}>{content}</Link>:<a className="cast-person" key={`${person.Id??person.Name}:${index}`} href={`https://www.imdb.com/find/?q=${encodeURIComponent(person.Name??'')}&s=nm`} target="_blank" rel="noopener noreferrer" title={`Find ${person.Name} on IMDb`}>{content}</a>;}
 return <section className="cast-section cast-carousel" aria-label="Cast" aria-roledescription="carousel">
  <div className="section-heading cast-heading"><h2>Cast</h2><div className="cast-heading-actions">{sourceControl}<div className="cast-navigation"><span aria-live="polite" aria-atomic="true">{page+1} / {pages.length}</span><button className="icon-button" aria-label="Previous cast page" disabled={page===0} onClick={()=>move(-1)}><ChevronLeft size={19}/></button><button className="icon-button" aria-label="Next cast page" disabled={page>=pages.length-1} onClick={()=>move(1)}><ChevronRight size={19}/></button></div></div></div>
  {attribution}
  <div ref={viewport} className="cast-viewport" tabIndex={0} aria-label="Cast portraits. Use left and right arrow keys to browse." onKeyDown={event=>{
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}
   if(event.key==='Home'||event.key==='End'){event.preventDefault();setPage(event.key==='Home'?0:pages.length-1);}
  }} onPointerDown={event=>{pointer.current={id:event.pointerId,x:event.clientX,y:event.clientY};}} onPointerCancel={()=>{pointer.current=null;}} onPointerUp={event=>{
   const start=pointer.current;pointer.current=null;if(!start||start.id!==event.pointerId)return;
   const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){move(dx>0?-1:1);}
  }}>
   <div className="cast-track" style={{transform:`translateX(-${page*100}%)`}}>{pages.map((group,index)=><div className="cast-page" key={index} role="group" aria-label={`Cast page ${index+1} of ${pages.length}`} aria-hidden={index!==page} inert={index!==page} style={{gridTemplateColumns:`repeat(${Math.min(capacity,people.length)}, minmax(0, 1fr))`}}>{group.map((person,i)=>card(person,index*capacity+i))}</div>)}</div>
  </div>
 </section>;
}
