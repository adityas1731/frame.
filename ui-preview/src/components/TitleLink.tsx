import {Link,type LinkProps} from 'react-router';
import {useConnection} from '../jellyfin/useConnection';
import type {ItemDto} from '../jellyfin/types';
import {rememberTitle} from './titleNavigation';

export function TitleLink({item,onClick,...props}:LinkProps&{item?:ItemDto}){
 const {client}=useConnection();
 return <Link {...props} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)rememberTitle(client,item);}}/>;
}
