import {test} from 'node:test';
import assert from 'node:assert/strict';
import {directorCredits} from '../src/providers/verifiedCredits.ts';

const series={Type:'Series',ProviderIds:{Imdb:'tt23112594',Tvdb:'426606',Tmdb:'213375'},People:[{Name:'medo lshl',Type:'Director'},{Name:'An actor',Type:'Actor'}]};
test('reviewed primary-source directors replace a conflicting display credit without mutating the server DTO',()=>{
 const before=structuredClone(series),result=directorCredits(series);
 assert.deepEqual(result.names,['Christopher J. Byrne','Gandja Monteiro','Vincenzo Natali','Terry Matalas']);
 assert.equal(result.conflict,true);assert.deepEqual(result.serverNames,['medo lshl']);assert.match(result.url,/^https:\/\/press\.disney\.co\.uk\//);assert.deepEqual(series,before);
});
test('director correction requires corroborated identity and rejects conflicting IDs, a different item type and partial identities',()=>{
 for(const patch of [{Type:'Movie'},{ProviderIds:{Imdb:'tt23112594'}},{ProviderIds:{Imdb:'tt23112594',Tvdb:'426606',Tmdb:'999'}},{ProviderIds:{Imdb:'tt99999999',Tvdb:'426606'}}]){
  const result=directorCredits({...series,...patch});assert.deepEqual(result.names,['medo lshl']);assert.equal(result.conflict,false);assert.equal(result.url,undefined);
 }
});
test('absence from incomplete external credits never labels an unrelated server director as wrong',()=>{
 const result=directorCredits({Type:'Series',ProviderIds:{Tvmaze:'123'},People:[{Type:'Director',Name:'Original director'}]});
 assert.deepEqual(result.names,['Original director']);assert.equal(result.conflict,false);
 const verified=directorCredits({...series,People:[{Type:'Director',Name:'terry matalas'}]});assert.equal(verified.conflict,false);
});
