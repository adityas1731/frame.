import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultStudio,normalizeStudio,migrateLegacyHome,continueItems,widgetQuery,widget,moveWidget,appearanceErrors,defaultAppearance} from '../src/studio/model.ts';
import {JellyfinClient,parseItem} from '../src/jellyfin/client.ts';
import {createFixtureFetch,fixtureResumeEpisodes} from '../src/jellyfin/fixtures.ts';
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('Continue Watching refresh reads new server activity without evicting stable library metadata',async()=>{
 let calls=0;let position=600000000;const client=new JellyfinClient('https://fixture.invalid','device',async()=>{calls++;return json({Items:[{Id:'episode',Type:'Episode',UserData:{Played:false,PlaybackPositionTicks:position}}],TotalRecordCount:1});});
 const query=widgetQuery(widget('continue'));
 assert.equal((await client.items('user',query)).Items[0].UserData.PlaybackPositionTicks,600000000);
 position=1200000000;
 assert.equal((await client.items('user',query)).Items[0].UserData.PlaybackPositionTicks,1200000000);
 await client.nextUp('user');position=1800000000;
 assert.equal((await client.nextUp('user')).Items[0].UserData.PlaybackPositionTicks,1800000000);
 await client.items('user',{kind:'Movie'});await client.items('user',{kind:'Movie'});
 assert.equal(calls,5);client.dispose();
});
test('four-row defaults are independent snapshots; legacy custom visibility/order migrate safely',()=>{const first=defaultStudio(),second=defaultStudio();assert.deepEqual(first.widgets.map(w=>w.kind),['continue','categories','recent','custom']);first.widgets[0].visible=false;assert.equal(second.widgets[0].visible,true);assert.deepEqual(migrateLegacyHome(['top','continue']).widgets.map(w=>w.id),['top','categories','continue']);assert.equal(migrateLegacyHome([]).widgets.length,0);assert.equal(migrateLegacyHome(['continue','new','picks','top','shows']).widgets.length,4);});
test('resume grouping uses real latest activity and excludes completed titles and duplicate series, with optional movies',()=>{const w={...widget('continue'),includeMovies:false};const rows=[...fixtureResumeEpisodes,{Id:'done',Type:'Episode',SeriesId:'done',UserData:{Played:true,PlaybackPositionTicks:200,LastPlayedDate:'2026-10-24'}},{Id:'movie',Type:'Movie',UserData:{Played:false,PlaybackPositionTicks:100,LastPlayedDate:'2026-10-24'}}];const result=continueItems(rows,w);assert.deepEqual(result.map(i=>i.Id),['resume-episode-0','resume-episode-2','resume-episode-3']);assert.equal(continueItems(rows,{...w,includeMovies:true})[0].Id,'movie');assert.ok(!JSON.stringify(result).includes('done'));});
test('widget query uses authoritative date played/date created and supported filters',()=>{const resume=widgetQuery(widget('continue'));assert.equal(resume.sort,'DatePlayed');assert.equal(resume.kind,undefined);assert.equal(widgetQuery({...widget('continue'),includeMovies:false}).kind,'Episode');assert.equal(resume.limit,40);assert.equal(widgetQuery(widget('recent')).sort,'DateCreated');const query=widgetQuery({...widget('custom'),source:'unwatched',library:'lib',year:'2025',minRating:8,genre:'Drama',media:'Movie'});assert.equal(query.played,false);assert.equal(query.parentId,'lib');assert.equal(query.year,'2025');assert.equal(query.minRating,8);assert.equal(query.kind,'Movie');assert.equal(widgetQuery({...widget('custom'),year:'20'}).year,undefined);});
test('schema bounds local-storage data, rejects CSS injection, keeps partial years editable and stable IDs unique',()=>{const c=defaultStudio();const value=normalizeStudio({...c,appearance:{...defaultAppearance,enabled:true,accent:'url(evil)'},widgets:[{...c.widgets[0],id:'a',limit:999,spacing:-1,year:'20'}, {...c.widgets[0],id:'a'}],categoryLayout:{columns:99}});assert.equal(value.widgets.length,1);assert.equal(value.widgets[0].limit,40);assert.equal(value.widgets[0].spacing,8);assert.equal(value.widgets[0].year,'20');assert.equal(value.categoryLayout.columns,6);assert.equal(value.appearance.accent,defaultAppearance.accent);});
test('readable colors pass while low contrast palettes fail before preview',()=>{assert.deepEqual(appearanceErrors(defaultAppearance),[]);assert.ok(appearanceErrors({...defaultAppearance,text:'#202326'}).some(v=>v.includes('Primary')));assert.ok(appearanceErrors({...defaultAppearance,background:'#ffffff'}).length);assert.ok(appearanceErrors({...defaultAppearance,accent:'#000000'}).length);});
test('keyboard and drag reordering preserve widgets and never mutate prior snapshots',()=>{const c=defaultStudio();const next=moveWidget(c,0,3);assert.deepEqual(c.widgets.map(w=>w.id),['continue','categories','recent','favorites']);assert.deepEqual(next.widgets.map(w=>w.id),['categories','recent','favorites','continue']);assert.equal(moveWidget(c,0,-1),c);});
test('new query filters and Next Up remain scoped GET-only and omit library restriction for aggregate browsing',async()=>{const calls=[];const client=new JellyfinClient('https://fixture.invalid','device',async(url,init)=>{calls.push({url,init});return json({Items:[],TotalRecordCount:0});});await client.items('user',widgetQuery(widget('continue')));await client.items('user',{kind:'Movie',year:'2025',minRating:8,played:false,sort:'PremiereDate'});await client.nextUp('user',3);assert.ok(calls.every(c=>c.init.method==='GET'&&new URL(c.url).searchParams.get('userId')==='user'));assert.equal(new URL(calls[0].url).searchParams.get('includeItemTypes'),'Movie,Episode');const params=new URL(calls[1].url).searchParams;assert.equal(params.get('years'),'2025');assert.equal(params.get('minCommunityRating'),'8');assert.equal(params.get('sortOrder'),'Descending');assert.equal(params.has('parentId'),false);assert.match(calls[2].url,/Shows\/NextUp/);client.dispose();});
test('simulated widgets return genuine fixture resume ordering and recent sorting without affecting library totals',async()=>{const client=new JellyfinClient('https://frame-fixture.invalid','device',createFixtureFetch());const resume=await client.items('fixture-user',widgetQuery(widget('continue')));assert.equal(continueItems(resume.Items,widget('continue')).length,3);const recent=await client.items('fixture-user',{sort:'DateCreated',limit:40});assert.equal(recent.TotalRecordCount,80);assert.ok(Date.parse(recent.Items[0].DateCreated)>=Date.parse(recent.Items[1].DateCreated));assert.equal((await client.nextUp('fixture-user',3)).Items.length,3);client.dispose();});
test('parse boundary retains real series/activity fields and discards malformed activity dates',()=>{const item=parseItem({Id:'e',SeriesName:'Series',DateCreated:'2026-01-01',UserData:{LastPlayedDate:'2026-10-22',Played:false}});assert.equal(item.SeriesName,'Series');assert.equal(item.UserData.LastPlayedDate,'2026-10-22');assert.equal(parseItem({Id:'x',UserData:{LastPlayedDate:'garbage'}}).UserData.LastPlayedDate,undefined);});

test('Continue Watching accepts server-selected Next Up episodes without inventing a resume position',()=>{const w=widget('continue');const next=[{Id:'next-b',Type:'Episode',SeriesId:'b',SeriesName:'Second',UserData:{Played:false}},{Id:'next-a',Type:'Episode',SeriesId:'a',SeriesName:'First',UserData:{Played:false}}];const resumes=[{Id:'next-a',Type:'Episode',SeriesId:'a',UserData:{Played:false,PlaybackPositionTicks:600000000,LastPlayedDate:'2026-10-22'}}];const result=continueItems(resumes,w,next);assert.deepEqual(result.map(i=>i.Id),['next-a','next-b']);assert.equal(result[1].UserData.PlaybackPositionTicks,undefined);assert.equal(result[0].UserData.PlaybackPositionTicks,600000000);});

test('Favorites follows Recently Added and the legacy default upgrades without overwriting renamed sections',()=>{
 const defaults=defaultStudio();assert.equal(defaults.widgets[3].title,'Favorites');assert.equal(defaults.widgets[3].source,'favorites');assert.equal(defaults.widgets[0].art,'episode');
 const {homeRevision,...legacy}=defaults;legacy.widgets=defaults.widgets.map(w=>w.id==='favorites'?{...w,id:'custom',title:'My Custom Section'}:w);
 const migrated=normalizeStudio(legacy);assert.deepEqual(migrated.widgets.map(w=>w.id),['continue','categories','recent','favorites']);assert.equal(migrated.widgets[3].title,'Favorites');
 legacy.widgets[3].title='Weekend Picks';assert.equal(normalizeStudio(legacy).widgets[3].title,'Weekend Picks');
});
test('removed Favorites stays removed across normalization and saved reloads',()=>{
 const config=defaultStudio();config.widgets=config.widgets.filter(w=>w.id!=='favorites');
 assert.equal(normalizeStudio(normalizeStudio(config)).widgets.some(w=>w.id==='favorites'),false);
 const {homeRevision,...legacy}=config;assert.equal(normalizeStudio(legacy).widgets.some(w=>w.source==='favorites'&&w.kind==='custom'),false);
});
test('section names and episode artwork survive saved-layout normalization',()=>{
 const config=defaultStudio();config.widgets[0].title='Up Next Tonight';config.widgets[0].art='episode';
 const saved=normalizeStudio(JSON.parse(JSON.stringify(config)));assert.equal(saved.widgets[0].title,'Up Next Tonight');assert.equal(saved.widgets[0].art,'episode');
});

 test('Continue Watching defaults match the approved episode-still carousel setup',()=>{
 const w=defaultStudio().widgets[0];assert.equal(w.title,'Continue Watching');assert.equal(w.library,'');assert.equal(w.limit,3);assert.equal(w.layout,'carousel');assert.equal(w.art,'episode');assert.equal(w.size,'large');assert.equal(w.spacing,20);assert.equal(w.includeMovies,true);
 const saved=normalizeStudio({...defaultStudio(),widgets:[{...w,layout:'grid',size:'small',includeMovies:false}]});assert.equal(saved.widgets[0].layout,'grid');assert.equal(saved.widgets[0].size,'small');assert.equal(saved.widgets[0].includeMovies,false);
 });


test('new custom sections are empty manual selections, while default Favorites remains explicit',()=>{
 const custom=widget('custom');assert.equal(custom.title,'Custom Section');assert.equal(custom.source,'selection');assert.deepEqual(custom.selection,[]);assert.equal(widgetQuery(custom).favorite,undefined);
 const config=defaultStudio();assert.equal(config.widgets[3].title,'Favorites');assert.equal(config.widgets[3].source,'favorites');
 const edited={...custom,title:'Personal Collection',selection:['second','first'],genre:'Drama',watched:'watched'};
 const saved=normalizeStudio(JSON.parse(JSON.stringify({...config,widgets:[edited]}))).widgets[0];assert.equal(saved.title,edited.title);assert.equal(saved.source,'selection');assert.deepEqual(saved.selection,['second','first']);
 assert.equal(normalizeStudio({...config,widgets:[{kind:'custom',id:'new'}]}).widgets[0].source,'selection');
 assert.equal(normalizeStudio({...config,widgets:[{...edited,source:'favorites'}]}).widgets[0].source,'favorites');
});

test('custom selection discovery includes mixed media and uses only scoped read requests',async()=>{
 const calls=[];const client=new JellyfinClient('https://fixture.invalid','device',async(url,init)=>{calls.push({url,init});return json({Items:[{Id:'song',Type:'Audio',Name:'Track'}],TotalRecordCount:1});});
 const page=await client.selectionItems('user','a title',20);assert.equal(page.Items[0].Type,'Audio');const params=new URL(calls[0].url).searchParams;
 assert.equal(params.get('userId'),'user');assert.equal(params.get('includeItemTypes'),'Movie,Series,Episode,Audio,MusicAlbum,MusicVideo');assert.equal(params.get('searchTerm'),'a title');assert.equal(params.get('startIndex'),'20');assert.equal(params.get('limit'),'20');assert.equal(params.has('isFavorite'),false);assert.equal(calls[0].init.method,'GET');client.dispose();
});


test('genre discovery is scoped, paginated, deduplicated and cached without changing metadata',async()=>{
 const calls=[];const client=new JellyfinClient('https://fixture.invalid','device',async(url,init)=>{calls.push({url,init});const start=new URL(url).searchParams.get('startIndex');return json({Items:start==='0'?[{Id:'g1',Name:'Drama'},{Id:'g2',Name:'Fantasy'}]:[{Id:'g3',Name:'Drama'},{Id:'g4',Name:'Action'}],TotalRecordCount:4});});
 assert.deepEqual(await client.genres('user','shows','Series'),['Action','Drama','Fantasy']);
 assert.deepEqual(await client.genres('user','shows','Series'),['Action','Drama','Fantasy']);assert.equal(calls.length,2);
 for(const call of calls){const url=new URL(call.url);assert.equal(url.pathname,'/Genres');assert.equal(url.searchParams.get('userId'),'user');assert.equal(url.searchParams.get('parentId'),'shows');assert.equal(url.searchParams.get('includeItemTypes'),'Series');assert.equal(call.init.method,'GET');}
 assert.equal(new URL(calls[1].url).searchParams.get('startIndex'),'2');client.dispose();
});

test('genre discovery returns a genuine empty list for an empty accessible library',async()=>{
 const client=new JellyfinClient('https://fixture.invalid','device',async()=>json({Items:[],TotalRecordCount:0}));assert.deepEqual(await client.genres('user'),[]);client.dispose();
});

const {sectionContent,changeSectionContent,sectionContentOptions}=await import('../src/studio/sectionContent.ts');
test('one custom section can become each content source without changing its name or identity',()=>{
 const original={...widget('custom','personal-row'),title:'My Collection',visible:false,spacing:28,layout:'grid',size:'large',limit:16,selection:['movie','show']};
 for(const option of sectionContentOptions){
  const next=changeSectionContent(original,option.value);
  assert.equal(sectionContent(next),option.value);
  assert.equal(next.id,original.id);assert.equal(next.title,original.title);
  assert.equal(next.visible,false);assert.equal(next.spacing,28);assert.equal(next.layout,'grid');assert.equal(next.limit,16);
  assert.deepEqual(next.selection,['movie','show']);
 }
 assert.equal(changeSectionContent(original,'not-a-source'),original);
 assert.equal(changeSectionContent(original,'selection'),original);
});
test('inline content switching gives recent and resume sections their proper Jellyfin query',()=>{
 const row=widget('custom','editable');
 assert.equal(widgetQuery(changeSectionContent(row,'recent')).sort,'DateCreated');
 const resume=changeSectionContent(row,'continue');assert.equal(resume.art,'episode');
 assert.equal(widgetQuery(resume).resume,true);
 assert.equal(widgetQuery(changeSectionContent(row,'favorites')).favorite,true);
 assert.equal(changeSectionContent(resume,'selection').kind,'custom');
 assert.equal(widgetQuery(changeSectionContent(resume,'selection')).resume,undefined);
});
