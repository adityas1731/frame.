import {useEffect,useRef,useState,type ButtonHTMLAttributes,type ReactNode} from 'react';
import {Play} from 'lucide-react';
import './ticket-button.css';

export const ticketTearDuration=260;
export const ticketAfterTearDelay=500;
export function ticketMotionEnabled(){
  return typeof window!=='undefined'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&document.documentElement.dataset.effects!=='off'&&document.documentElement.dataset.motion!=='reduced';
}

/** Original CSS ticket treatment. Native button semantics and click handling stay intact. */
export function TicketButton({children,stub,className='',onClick,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{stub?:ReactNode}){
  const [torn,setTorn]=useState(false);
  const reset=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(reset.current),[]);
  return <button {...props} type={props.type??'button'} className={`button hero-primary ticket-button ${className}`} data-episode={stub?true:undefined} data-torn={torn||undefined} onClick={event=>{
    onClick?.(event);
    if(event.defaultPrevented||!ticketMotionEnabled())return;
    clearTimeout(reset.current);setTorn(true);
    reset.current=setTimeout(()=>setTorn(false),ticketTearDuration+ticketAfterTearDelay+300);
  }}>
    <span className="ticket-button-main"><Play size={14} fill="currentColor" aria-hidden="true"/><span>{children}</span></span>
    <span className="ticket-button-stub" aria-hidden="true">{stub??<span className="ticket-play-label">PLAY</span>}</span>
  </button>;
}
