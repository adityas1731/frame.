import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibleSettingsSection} from '../src/studio/activeSection.ts';

test('Playback is active when its panel dominates, even before its heading reaches the header',()=>{
 assert.equal(visibleSettingsSection([
  {id:'layout-heading',top:-700,bottom:125},
  {id:'playback-heading',top:158,bottom:797},
  {id:'devices-heading',top:829,bottom:1200},
 ],70,997),'playback-heading');
});
test('navigation follows visible space in both scroll directions and excludes hidden header space',()=>{
 assert.equal(visibleSettingsSection([{id:'layout',top:-500,bottom:460},{id:'playback',top:490,bottom:1300}],80,900),'playback');
 assert.equal(visibleSettingsSection([{id:'layout',top:-100,bottom:700},{id:'playback',top:730,bottom:1500}],80,900),'layout');
 assert.equal(visibleSettingsSection([{id:'previous',top:-300,bottom:70},{id:'current',top:100,bottom:700}],80,900),'current');
});
test('large expanded editors, small screens and gaps retain a valid active section',()=>{
 assert.equal(visibleSettingsSection([{id:'home',top:-2000,bottom:2000},{id:'online',top:2032,bottom:2600}],80,844),'home');
 assert.equal(visibleSettingsSection([{id:'first',top:-200,bottom:100},{id:'next',top:132,bottom:500}],110,130),'next');
 assert.equal(visibleSettingsSection([],80,844),undefined);
});
