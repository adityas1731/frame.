import {useRemote} from '../jellyfin/hooks';
import {useConnection} from '../jellyfin/useConnection';
import {libraryNavigation} from './libraryNavigation';
export function useLibraries(){
 const {client,session}=useConnection();
 const result=useRemote(`libraries:${session?.server.Id}:${session?.user.Id}`,()=>client&&session?client.libraries(session.user.Id):Promise.resolve(undefined),false);
 const items=result.data?.Items??[];
 return {...result,items,links:libraryNavigation(items)};
}
