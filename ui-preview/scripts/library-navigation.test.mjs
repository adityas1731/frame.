import {test} from 'node:test';
import assert from 'node:assert/strict';
import {libraryNavigation,activeLibrary,libraryHeading,ancestorLibrary} from '../src/app/libraryNavigation.ts';
test('navigation follows server library names and types, never name guesses',()=>{
 const links=libraryNavigation([{Id:'films',Name:'Cinema nights',CollectionType:'movies'},{Id:'series',Name:'Shows',CollectionType:'tvshows'}]);
 assert.deepEqual(links.map(link=>[link.title,link.to]),[['Cinema nights','/movies?library=films'],['Shows','/shows?library=series']]);
 assert.equal(libraryNavigation([{Id:'misleading',Name:'TV shows',CollectionType:'movies'}])[0].mode,'movies');
});
test('absent TV libraries stay absent while an empty TV library remains accessible',()=>{
 assert.equal(libraryNavigation([{Id:'films',Name:'Films',CollectionType:'movies'}]).some(link=>link.mode==='shows'),false);
 const empty=libraryNavigation([{Id:'series',Name:'Shows',CollectionType:'tvshows',ChildCount:0}]);assert.equal(empty[0].title,'Shows');assert.equal(empty[0].count,0);
 assert.deepEqual(libraryNavigation([]),[]);
});
test('multiple libraries keep separate scopes and only the selected library is active',()=>{
 const links=libraryNavigation([{Id:'a',Name:'Shows',CollectionType:'tvshows'},{Id:'b',Name:'Anime',CollectionType:'tvshows'},{Id:'mixed&1',Name:'Family',CollectionType:'mixed'},{Id:'music',Name:'Music',CollectionType:'music'}]);
 assert.equal(links.length,4);assert.equal(links[2].to,'/library?library=mixed%261');
 assert.equal(activeLibrary('a','shows','/shows','?library=b'),false);assert.equal(activeLibrary('b','shows','/shows','?library=b'),true);
 assert.equal(activeLibrary('b','shows','/movies','?library=b'),false);
});
test('renaming is reflected without changing library identity or destination',()=>{
 const before=libraryNavigation([{Id:'a',Name:'TV shows',CollectionType:'tvshows'}])[0],after=libraryNavigation([{Id:'a',Name:'My Series',CollectionType:'tvshows'}])[0];
 assert.equal(before.to,after.to);assert.equal(after.title,'My Series');assert.equal(after.id,before.id);
});

test('headings and bookmarked detail back links use server names and exact ancestry',()=>{
 const libraries=[{Id:'a',Name:'Shows',CollectionType:'tvshows'},{Id:'b',Name:'Anime',CollectionType:'tvshows'},{Id:'c',Name:'Cinema nights',CollectionType:'movies'}];
 assert.equal(libraryHeading(libraries,'shows','b'),'Anime');
 assert.equal(libraryHeading(libraries,'shows'),'Shows · Anime');
 assert.equal(ancestorLibrary(libraries,[{Id:'season'},{Id:'series'},{Id:'b'}]).to,'/shows?library=b');
 assert.equal(ancestorLibrary(libraries,[{Id:'inaccessible'}]),undefined);
 assert.equal(libraryHeading(libraries,'shows','inaccessible'),'Your Library');
 assert.equal(libraryHeading([],'movies'),'Your Library');
 assert.equal(libraryNavigation([{Id:'nameless',CollectionType:'movies'}])[0].title,'nameless');
});
