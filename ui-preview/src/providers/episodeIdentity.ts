import type {ItemDto} from '../jellyfin/types.ts';
import {genericEpisodeTitle,providerId} from './metadata.ts';
/** Numbered matching already requires a verified show, unique aired numbering,
 * no combined episodes and no alternate order. A date-only conflict still fails.
 * Adjacent-day timestamps may represent ingestion or a date-only value serialized
 * through a timezone. Require two corroborating show IDs plus a generic filename
 * or an exact episode-title match, and a broadcast timestamp within 36 hours.
 * Never overwrite server dates or accept a conflicting proper title. */
export function episodeScheduleCompatible(item:ItemDto,parent:ItemDto,value:{airdate?:string;airstamp?:string;name?:string}){
 if(!item.PremiereDate||!value.airdate)return true;
 if(item.PremiereDate.slice(0,10)===value.airdate)return true;
 const imdb=providerId(parent,'Imdb'),tvdb=providerId(parent,'Tvdb');
 const title=(name:string|undefined)=>name?.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
 const exactTitle=!!title(item.Name)&&title(item.Name)===title(value.name);
 if(!imdb||!/^tt\d{7,10}$/.test(imdb)||!tvdb||! /^[1-9]\d*$/.test(tvdb)||(!genericEpisodeTitle(item.Name)&&!exactTitle))return false;
 if(!/T\d{2}:\d{2}:\d{2}/.test(item.PremiereDate)||/T00:00:00(?:\.0+)?(?:Z|[+-]00:00)?$/.test(item.PremiereDate))return false;
 const day=Date.parse(item.PremiereDate.slice(0,10)),providerDay=Date.parse(value.airdate);
 const timestamp=Date.parse(item.PremiereDate),broadcast=Date.parse(value.airstamp??'');
 return Math.abs(day-providerDay)===86400000&&Number.isFinite(timestamp)&&Number.isFinite(broadcast)&&Math.abs(timestamp-broadcast)<=36*3600000;
}
