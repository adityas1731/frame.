import {useEffect} from 'react';
import {installedFontAvailable} from './fonts';

export function useInstalledFont(name:string,enabled:boolean){
 useEffect(()=>{
  if(!enabled||!name.trim())return;
  const timer=setTimeout(()=>{void installedFontAvailable(name);},300);
  return()=>clearTimeout(timer);
 },[name,enabled]);
}
