import type {ReactNode} from 'react';
import {Navigate,useLocation} from 'react-router';
import {useConnection} from '../jellyfin/useConnection';
import {ServerUnavailable} from './ServerUnavailable';

export function ConnectionGate({children}:{children:ReactNode}) {
  const {session,saved,unavailable,resumeSaved}=useConnection();
  const location=useLocation();
  if(location.pathname!=='/connect') {
    if(unavailable||(!session&&saved))return <ServerUnavailable retry={resumeSaved}/>;
    if(!session)return <Navigate to="/connect" replace/>;
  }
  return children;
}
