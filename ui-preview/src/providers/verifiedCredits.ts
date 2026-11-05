import type {ItemDto} from '../jellyfin/types.ts';
import {providerId} from './metadata.ts';

/** Reviewed factual credits from a primary source. No server mutations or name guesses.
 * Corrections require two agreeing external IDs and reject any contradictory known ID.
 * Keep this dataset explicit: absence of a name in an incomplete API is not a conflict. */
const reviewedCredits = [{
  kind:'Series',
  ids:{Imdb:'tt23112594',Tmdb:'213375',Tvdb:'426606'},
  directors:['Christopher J. Byrne','Gandja Monteiro','Vincenzo Natali','Terry Matalas'],
  source:'Disney+ press kit',
  url:'https://press.disney.co.uk/press-kit/visionquest-press-kit',
  reviewed:'2026-10-29',
}];

const comparable=(name:string)=>name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
export function directorCredits(item:ItemDto) {
  const serverNames=[...new Set((item.People??[]).filter(person=>person.Type==='Director'&&person.Name?.trim()).map(person=>person.Name!.trim()))];
  const correction=reviewedCredits.find(row=>{
    if(item.Type!==row.kind)return false;
    let agreed=0;
    for(const [provider,expected] of Object.entries(row.ids)){
      const actual=providerId(item,provider);
      if(actual&&actual!==expected)return false;
      if(actual===expected)agreed++;
    }
    return agreed>=2;
  });
  if(!correction)return {names:serverNames,serverNames,conflict:false,source:'Jellyfin',url:undefined};
  const expected=new Set(correction.directors.map(comparable));
  return {names:[...correction.directors],serverNames,conflict:serverNames.some(name=>!expected.has(comparable(name))),source:correction.source,url:correction.url};
}
