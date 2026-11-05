import {atmosphereFromSeed,readableAccent,mixColor} from '../src/appearance/palette.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {atmospherePresets,accentPresets,resolvePalette} from '../src/studio/presets.ts';
import {defaultAppearance,appearanceErrors,contrast,normalizeStudio,defaultStudio} from '../src/studio/model.ts';

test('all 64 atmosphere/accent preset combinations meet the text and accent contrast gates',()=>{
 for(const atmosphere of atmospherePresets)for(const accent of Object.keys(accentPresets)){
  const palette=resolvePalette(defaultAppearance,atmosphere.id,accent);
  assert.deepEqual(appearanceErrors(palette),[],`${atmosphere.id}/${accent}`);
  const ink=contrast(palette.accent,'#101111')>=contrast(palette.accent,'#ffffff')?'#101111':'#ffffff';
  assert.ok(contrast(palette.accent,ink)>=4.5);
 }
});
test('custom accent remains independent from atmosphere and persists through normalization',()=>{
 const appearance={...defaultAppearance,accentCustom:true,accent:'#90d8e0'};
 for(const atmosphere of atmospherePresets){const palette=resolvePalette(appearance,atmosphere.id,'amber');assert.equal(palette.accent,'#90d8e0');assert.equal(palette.background,atmosphere.canvas);assert.deepEqual(appearanceErrors(palette),[]);}
 const restored=normalizeStudio({...defaultStudio(),appearance});assert.equal(restored.appearance.accentCustom,true);assert.equal(restored.appearance.accent,'#90d8e0');
 assert.equal(resolvePalette({...appearance,accentCustom:false},'forest','rose').accent,accentPresets.rose);
 assert.equal(normalizeStudio(defaultStudio()).appearance.accentCustom,false);
 assert.equal(normalizeStudio({...defaultStudio(),appearance:{...defaultAppearance,enabled:true,accent:'#90d8e0'}}).appearance.accentCustom,true);
});
test('custom atmosphere and accent combinations reject unreadable, malformed and bright palettes',()=>{
 const custom={...defaultAppearance,enabled:true,accentCustom:true,background:'#101b25',surface:'#1c2d3a',accent:'#90d8e0'};
 assert.deepEqual(appearanceErrors(resolvePalette(custom,'plum','rose')),[]);
 for(const change of [{text:'#101b25'},{secondary:'#1c2d3a'},{background:'#ffffff'},{surface:'#ffffff'},{accent:'#101b25'},{accent:'red'},{text:'url(evil)'}])assert.ok(appearanceErrors({...custom,...change}).length);
 // An accent may pass the canvas but disappear on a lighter surface.
 assert.ok(appearanceErrors({...custom,background:'#000000',surface:'#333333',accent:'#777777'}).some(e=>e.includes('Accent')));
 assert.equal(resolvePalette(custom,'plum','rose').background,atmosphereFromSeed(custom.background).background);
});

test('single-tint generation handles saturated, bright and dark inputs with readable independent accents',()=>{
 const seeds=['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#059999','#ffff00','#ff00ff','#00ffff','#808080','#123456'];
 for(const seed of seeds){const colors=atmosphereFromSeed(seed);for(const accent of seeds){
  const palette=resolvePalette({...defaultAppearance,enabled:true,atmosphereSeed:seed,accentCustom:true,accent},'graphite','amber');
  assert.deepEqual(appearanceErrors(palette),[],`${seed}/${accent}`);
  assert.ok(Math.min(contrast(palette.accent,colors.background),contrast(palette.accent,colors.surface))>=4.5);
  assert.equal(palette.background,colors.background);
 }}
 assert.equal(readableAccent('#c9b7f5','#101111','#191c1d'),'#c9b7f5');
 assert.notEqual(readableAccent('#000000','#101111','#191c1d'),'#e6a039');
});
test('custom tint survives saving, switching presets and legacy palette migration without coupling accent',()=>{
 const initial={...defaultStudio(),appearance:{...defaultAppearance,enabled:true,atmosphereSeed:'#059999',accentCustom:false}};
 const first=normalizeStudio(initial),second=normalizeStudio(first);assert.deepEqual(second,first);assert.equal(first.appearance.atmosphereSeed,'#059999');
 assert.equal(normalizeStudio({...first,appearance:{...first.appearance,enabled:false}}).appearance.atmosphereSeed,'#059999');
 for(const accent of Object.keys(accentPresets))assert.equal(resolvePalette(first.appearance,'graphite',accent).accent,readableAccent(accentPresets[accent],first.appearance.background,first.appearance.surface));
 const old=normalizeStudio({...defaultStudio(),appearance:{...defaultAppearance,enabled:true,background:'#059999',text:'#059999',accent:'#000000'}});assert.equal(old.appearance.enabled,true);assert.equal(old.appearance.atmosphereSeed,'#059999');assert.deepEqual(appearanceErrors(resolvePalette(old.appearance,'graphite','amber')),[]);
});
