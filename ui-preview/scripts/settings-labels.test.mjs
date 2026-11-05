import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]},esbuild:{jsx:'automatic'}});
after(()=>server.close());
const {Field,SettingsSection}=await server.ssrLoadModule('/src/components/SettingsSection.tsx');
const {Select,SettingsSelect}=await server.ssrLoadModule('/src/components/Select.tsx');
test('Settings field labels use Title Case while editable names and instructions retain exact content',()=>{
 const html=renderToStaticMarkup(h(Field,{label:'Section title',hint:'Choose your own titles.'},h('input',{defaultValue:'my personal collection'})));
 assert.match(html,/>Section Title</);assert.match(html,/value="my personal collection"/);assert.match(html,/>Choose your own titles\.</);
 const section=renderToStaticMarkup(h(SettingsSection,{id:'heading',title:'Layout & navigation'},'Content'));assert.match(section,/Layout &amp; Navigation/);assert.match(section,/aria-labelledby="heading"/);
});
test('Settings dropdown treatment preserves values and does not change dropdowns elsewhere',()=>{
 const props={value:'row',name:'presentation',children:h('option',{value:'row'},'Horizontal row')};
 const settings=renderToStaticMarkup(h(SettingsSelect,props));const normal=renderToStaticMarkup(h(Select,props));
 assert.match(settings,/>Horizontal Row</);assert.match(settings,/value="row"/);assert.match(normal,/>Horizontal row</);assert.doesNotMatch(normal,/>Horizontal Row</);
});
