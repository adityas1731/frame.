import type {ItemDto} from '../jellyfin/types';

// Short-lived, client-scoped display data; never persisted or used for playback.
const previews=new WeakMap<object,Map<string,{item:ItemDto;expires:number}>>();
export function rememberTitle(client:object|null,item?:ItemDto,now=Date.now()){
 if(!client||!item)return;
 let titles=previews.get(client);
 if(!titles){titles=new Map();previews.set(client,titles);}
 titles.delete(item.Id);titles.set(item.Id,{item,expires:now+30000});
 if(titles.size>40)titles.delete(titles.keys().next().value!);
}
export function titlePreview(client:object|null,id:string,now=Date.now()){
 if(!client)return undefined;
 const titles=previews.get(client),entry=titles?.get(id);
 if(!entry)return undefined;
 if(entry.expires<=now){titles!.delete(id);return undefined;}
 return entry.item;
}
