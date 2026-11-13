import {useEffect,useState} from 'react';
const eventName='frame:artwork-refreshed';
export function artworkRefreshed(itemId:string){window.dispatchEvent(new CustomEvent(eventName,{detail:itemId}));}
export function useArtworkRevision(itemId?:string){
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const changed=(event:Event)=>{if((event as CustomEvent).detail===itemId)setRevision(value=>value+1);};window.addEventListener(eventName,changed);return()=>window.removeEventListener(eventName,changed);},[itemId]);
  return revision;
}
