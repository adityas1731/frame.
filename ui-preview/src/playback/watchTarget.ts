import type {JellyfinClient} from '../jellyfin/client';
import type {ItemDto,Session} from '../jellyfin/types';
import {earlyProgressItems,earlyProgressStore,readEarlyProgress,type EarlyProgress} from './earlyProgress';

/** The ticket and its click share one target: unfinished playback before Next Up. */
export async function watchTarget(client:JellyfinClient,session:Session,item:ItemDto,records:EarlyProgress[]=readEarlyProgress(session,earlyProgressStore())):Promise<ItemDto|undefined>{
 if(item.Type!=='Series')return item;
 const userId=session.user.Id;
 const [resume,early]=await Promise.all([
  client.items(userId,{kind:'Episode',parentId:item.Id,resume:true,sort:'DatePlayed',limit:1}),
  records.length?client.itemsById(userId,records.map(row=>row.id),item.Id,'Episode'):Promise.resolve({Items:[] as ItemDto[]}),
 ]);
 const candidates=[...resume.Items,...earlyProgressItems(early.Items,records)]
  .filter(episode=>episode.Type==='Episode'&&(!episode.SeriesId||episode.SeriesId===item.Id)&&(episode.UserData?.PlaybackPositionTicks??0)>0)
  .sort((a,b)=>(Date.parse(b.UserData?.LastPlayedDate??'')||0)-(Date.parse(a.UserData?.LastPlayedDate??'')||0));
 if(candidates[0])return candidates[0];
 const next=await client.nextUp(userId,1,undefined,item.Id);
 if(next.Items[0])return next.Items[0];
 const seasons=await client.seasons(userId,item.Id);
 const season=seasons.Items.find(s=>s.IndexNumber===1)??seasons.Items[0];
 return season?(await client.episodes(userId,item.Id,season.Id)).Items[0]:undefined;
}
