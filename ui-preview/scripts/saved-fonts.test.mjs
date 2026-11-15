import {test} from 'node:test';import assert from 'node:assert/strict';
import {fontNames,readSavedFonts,saveFontName,savedFontsKey} from '../src/appearance/savedFonts.ts';
test('saved font names normalize, deduplicate and reject CSS/URLs with a bounded list',()=>{
 assert.deepEqual(fontNames([' Saira   SemiExpanded ','saira semiexpanded','Agrave Pro','url(https://evil.invalid/font)','x; color:red',null]),['Saira SemiExpanded','Agrave Pro']);assert.equal(fontNames(Array.from({length:50},(_,i)=>`Font ${i}`)).length,20);
});
test('Appearance and subtitles share saved names across refresh; removing a name leaves font preferences intact',()=>{
 const previousStorage=globalThis.localStorage,previousWindow=globalThis.window;const rows=new Map([['subtitle-preferences','keep']]);let events=0;
 globalThis.localStorage={getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value)};globalThis.window={dispatchEvent:()=>{events++;}};
 try{assert.equal(saveFontName('Agrave Pro'),true);assert.deepEqual(readSavedFonts(),['Agrave Pro']);saveFontName('Saira SemiExpanded');assert.deepEqual(JSON.parse(rows.get(savedFontsKey)),['Saira SemiExpanded','Agrave Pro']);saveFontName('AGrave Pro',true);assert.deepEqual(readSavedFonts(),['Saira SemiExpanded']);assert.equal(rows.get('subtitle-preferences'),'keep');assert.equal(events,3);}finally{globalThis.localStorage=previousStorage;globalThis.window=previousWindow;}
});
test('corrupt or denied browser storage cannot break installed-font selection',()=>{
 const original=globalThis.localStorage;try{globalThis.localStorage={getItem:()=>'{bad'};assert.deepEqual(readSavedFonts(),[]);globalThis.localStorage={getItem:()=>{throw Error('Denied')},setItem:()=>{throw Error('Denied')}};assert.deepEqual(readSavedFonts(),[]);assert.equal(saveFontName('Aptos'),false);}finally{globalThis.localStorage=original;}
});
