import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasAppearanceChanges} from '../src/studio/appearanceChanges.ts';
import {defaultAppearance,normalizeStudio,defaultStudio} from '../src/studio/model.ts';
import {optionLabel} from '../src/components/optionLabels.ts';
const prefs={episodeSize:'medium',font:'system',customFont:'',textScale:'100',theme:'graphite',accent:'amber'};
test('appearance action visibility tracks real palette, layout and preference edits',()=>{
 assert.equal(hasAppearanceChanges(defaultAppearance,{...defaultAppearance,accentCustom:false},prefs,prefs),false);
 for(const edit of [{radius:20},{spacing:25},{poster:200},{blur:false},{enabled:true,atmosphereSeed:'#059999'},{accentCustom:true,accent:'#aabbcc'}])assert.equal(hasAppearanceChanges({...defaultAppearance,...edit},defaultAppearance,prefs,prefs),true);
 for(const edit of [{font:'mono'},{textScale:'125'},{theme:'forest'},{accent:'lavender'},{episodeSize:'large'},{customFont:'Aptos'}])assert.equal(hasAppearanceChanges(defaultAppearance,defaultAppearance,{...prefs,...edit},prefs),true);
 // Unused custom values do not produce phantom pending changes.
 assert.equal(hasAppearanceChanges({...defaultAppearance,accent:'#123456',atmosphereSeed:'#123456'},defaultAppearance,prefs,prefs),false);
});
test('saved normalization and cancel snapshots clear pending state',()=>{
 const draft={...defaultAppearance,enabled:true,atmosphereSeed:'#059999',accentCustom:true,accent:'#90d8e0'};
 const saved=normalizeStudio({...defaultStudio(),appearance:draft}).appearance;
 assert.equal(hasAppearanceChanges(draft,saved,prefs,prefs),false);
 assert.equal(hasAppearanceChanges(saved,saved,prefs,prefs),false);
});
test('enum option labels use readable sentence case without changing values or library names',()=>{
 for(const value of ['small','medium','large','compact','expanded','row','poster'])assert.equal(optionLabel(value,value),value[0].toUpperCase()+value.slice(1));
 assert.equal(optionLabel('my movies','library-id'),'my movies');assert.equal(optionLabel('Sci-Fi','genre'),'Sci-Fi');assert.equal(optionLabel('TV Shows','shows'),'TV Shows');
});
