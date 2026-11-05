import type { ItemDto } from '../jellyfin/types';
import { useConnection } from '../jellyfin/useConnection';
import { useRemote } from '../jellyfin/hooks';
import { useOnline } from '../providers/context';
import { useRichItem } from '../providers/hooks';
import { DetailArtwork } from './DetailArtwork';
export function FeaturedServerArtwork({item}:{item:ItemDto}) {
  const {client,session}=useConnection();const online=useOnline();
  const detail=useRemote(`featured-art:${item.Id}:${!!online.client}`,()=>online.client&&client&&session?client.item(session.user.Id,item.Id):Promise.resolve(item));
  const rich=useRichItem(detail.data??item);
  return <DetailArtwork item={detail.data??item} online={rich.online}/>;
}
