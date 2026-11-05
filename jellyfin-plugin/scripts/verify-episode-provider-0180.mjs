/** Exact public IDs and selected chronology from the stopped-server backup.
 * No production API, credentials, private IDs or media paths are transmitted. */
import {FreeMetadataClient} from '../../ui-preview/src/providers/free.ts';
import {mergeMetadata} from '../../ui-preview/src/providers/metadata.ts';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const parent={Id:'synthetic-parent',Type:'Series',ProviderIds:{Imdb:'tt23112594',Tvdb:'426606'}};
let requests=0;
const client=new FreeMetadataClient({remoteBackdrop:async()=>null,invalidateRemoteImages(){}},(url,options)=>{
 assert.equal(new URL(url).origin,'https://api.tvmaze.com');assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,undefined);requests++;return fetch(url,options);
});
try{
 const source=[{IndexNumber:3,Name:'series.s01e03',PremiereDate:'2026-10-21T07:44:33Z'},{IndexNumber:4,Name:'series.s01e04',PremiereDate:'2026-10-21T07:44:41Z'},{IndexNumber:5,Name:'Firewall',PremiereDate:'2026-10-26T18:30:00Z',Overview:'Synthetic server description.'},{IndexNumber:6,Name:'Deadlock',PremiereDate:'2026-10-26T18:30:00Z',Overview:'Another synthetic server description.'}].map(item=>({...item,Id:'synthetic-'+item.IndexNumber,SeriesId:parent.Id,Type:'Episode',ParentIndexNumber:1}));
 const before=JSON.stringify(source),values=await Promise.all(source.map(item=>client.enrich(item,parent)));
 assert.equal(requests,3);assert.equal(new Set(values.map(v=>v?.still)).size,4);
 const results=[];
 for(let i=0;i<values.length;i++){
  const online=values[i];assert.ok(online?.still&&online.overview);const merged=mergeMetadata(source[i],online).item;
  assert.equal(merged.PremiereDate,source[i].PremiereDate);if(source[i].Overview)assert.equal(merged.Overview,source[i].Overview);
  const response=await fetch(online.still,{method:'HEAD',credentials:'omit',referrerPolicy:'no-referrer'});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^image\//);
  results.push({season:1,episode:source[i].IndexNumber,providerEpisodeId:online.id,descriptionAvailable:true,distinctStillAvailable:true,imageHeadStatus:response.status,serverDatePreserved:true,serverDescriptionPreserved:true});
 }
 assert.equal(JSON.stringify(source),before);
 const result={format:'frame-episode-0180-verification',evidence:'Selected fields from verified stopped-server backup; current public provider records and image HEAD checks',episodes:results,metadataRequests:requests,productionContacted:false,serverMetadataChanged:false};
 await writeFile('docs/episode-0180-provider-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{client.dispose();}
