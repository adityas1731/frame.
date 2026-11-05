import { useEffect, useState, type ReactNode } from 'react';
import { useConnection } from '../jellyfin/useConnection';
import { usePreview } from '../state/PreviewContext';
import type { JellyfinClient } from '../jellyfin/client';
import { FreeMetadataClient } from './free';
import { OnlineContext } from './context';
export function OnlineProvider({children}:{children:ReactNode}) {
  const {client:server}=useConnection();const {preferences}=usePreview();
  const [active,setActive]=useState<{scope:JellyfinClient;client:FreeMetadataClient;simulated:boolean}|null>(null);
  useEffect(()=>{
    let cancelled=false;let client:FreeMetadataClient|undefined;
    if(!server||!preferences.onlineMetadata)return;
    const scope=server;
    void (async()=>{
      const simulated=server.baseUrl==='https://frame-fixture.invalid';
      // Fictional IDs must never reach a public provider, even outside development.
      if(simulated&&!import.meta.env.DEV)return;
      const fixture=import.meta.env.DEV&&simulated?await import('./fixtures'):undefined;
      if(cancelled)return;
      client=new FreeMetadataClient(scope,fixture?.createOnlineFixture(),fixture?.fixtureImageUrl);
      setActive({scope,client,simulated});
    })();
    return()=>{cancelled=true;client?.dispose();};
  },[server,preferences.onlineMetadata]);
  const visible=preferences.onlineMetadata&&active?.scope===server?active:null;
  return <OnlineContext value={{client:visible?.client??null,simulated:visible?.simulated??false}}>{children}</OnlineContext>;
}
