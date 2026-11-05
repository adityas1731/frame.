import {useEffect, useRef, useState} from 'react';
import {Heart, LoaderCircle} from 'lucide-react';
import {useConnection, errorMessage} from '../jellyfin/useConnection';
import {usePreview} from '../state/PreviewContext';
import type {ItemDto} from '../jellyfin/types';

interface Props {item: ItemDto; variant?: 'card' | 'button' | 'inline'}
export function FavoriteToggle(props: Props) {
  const {client, session} = useConnection();
  return <FavoriteControl key={`${client?.baseUrl}:${session?.user.Id}:${props.item.Id}`} {...props}/>;
}

/** Confirmed, user-scoped writes. No grid reload, metadata refresh or watched-history write. */
function FavoriteControl({item, variant = 'card'}: Props) {
  const {client, session} = useConnection();
  const {notify} = usePreview();
  const [favorite, setFavorite] = useState(item.UserData?.IsFavorite);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => setFavorite(item.UserData?.IsFavorite), [item.UserData?.IsFavorite]);
  useEffect(() => {
    const changed = (event: Event) => {
      const update = (event as CustomEvent).detail;
      if (update?.client === client && update?.userId === session?.user.Id && update?.itemId === item.Id) setFavorite(update.favorite);
    };
    window.addEventListener('frame:favorite-updated', changed);
    return () => window.removeEventListener('frame:favorite-updated', changed);
  }, [client, session?.user.Id, item.Id]);
  const unavailable = !client || !session || favorite === undefined;
  const action = favorite ? 'Remove from favorites' : 'Add to favorites';
  async function toggle() {
    if (pending.current || unavailable) return;
    pending.current = true; setBusy(true);
    try {
      const confirmed = await client!.setFavorite(session!.user.Id, item.Id, !favorite);
      if (mounted.current) setFavorite(confirmed);
      window.dispatchEvent(new CustomEvent('frame:favorite-updated', {detail:{client, userId:session!.user.Id, itemId:item.Id, favorite:confirmed}}));
      if (mounted.current) notify(confirmed ? 'Added to favorites' : 'Removed from favorites');
    } catch (error) {if (mounted.current) notify(errorMessage(error));}
    finally {pending.current = false; if (mounted.current) setBusy(false);}
  }
  return <button type="button" className={`favorite-control favorite-${variant} ${favorite ? 'is-favorite' : ''} ${variant === 'button' ? 'button hero-secondary' : ''}`} aria-label={`${action}: ${item.Name ?? 'Untitled'}`} aria-pressed={!!favorite} aria-busy={busy} disabled={busy || unavailable} title={unavailable ? 'Favorite status unavailable' : action} onClick={event => {event.preventDefault(); event.stopPropagation(); void toggle();}}>
    {busy ? <LoaderCircle size={18} className="watched-spinner"/> : <Heart size={18} fill={favorite ? 'currentColor' : 'none'}/>}
    {variant !== 'card' && <span>{favorite ? 'Favorited' : 'Favorite'}</span>}
  </button>;
}
