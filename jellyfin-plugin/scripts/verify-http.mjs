import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:18096'+(process.env.FRAME_TEST_BASE==='/jellyfin'?'/jellyfin':'');
const report=[];async function check(path,status,options={},validate){const response=await fetch(base+path,{redirect:'manual',...options});assert.equal(response.status,status,path);if(validate)await validate(response);report.push({path,status,method:options.method??'GET'});return response;}
const html=await check('/Frame/Web/',200,{},async r=>{assert.match(r.headers.get('content-type'),/text\/html/);assert.equal(r.headers.get('cache-control'),'no-store');});const text=await html.text();assert.ok(text.includes(`<base href="${new URL(base).pathname.replace(/\/$/,'')}/Frame/Web/"`));
const asset=text.match(/src="\.\/([^\"]+\.js)"/)[1];const js=await check('/Frame/Web/'+asset,200,{},async r=>{assert.match(r.headers.get('content-type'),/javascript/);assert.match(r.headers.get('cache-control'),/immutable/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');});
await check('/Frame/Web/'+asset,304,{headers:{'If-None-Match':js.headers.get('etag')}});
await check('/Frame/Web/frame-stream-sw.js',200,{method:'HEAD'},async r=>{assert.match(r.headers.get('content-type'),/javascript/);assert.equal(r.headers.get('service-worker-allowed'),new URL(base).pathname.replace(/\/$/,'')+'/Frame/Web/');assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(!(await r.text()).length);});
await check('/Frame/Web',302,{},r=>assert.equal(r.headers.get('location'),new URL(base).pathname.replace(/\/$/,'')+'/Frame/Web/'));
await check('/Frame/Web/item/example',302,{},r=>assert.equal(r.headers.get('location'),new URL(base).pathname.replace(/\/$/,'')+'/Frame/Web/#/item/example'));
for(const path of ['/Frame/Web/assets/missing.js','/Frame/Web/.env','/Frame/Web/.vite/manifest.json','/Frame/Web/%252e%252e/config/system.xml','/Frame/Web/C:%5csecret','/Frame/Web/credentials.json'])await check(path,404);
await check('/Frame/Web/',405,{method:'POST'});
await check('/web/index.html',200,{},r=>assert.match(r.headers.get('content-type'),/text\/html/));
await check('/UserViews',401);
await writeFile('docs/http-verification'+(process.env.FRAME_TEST_BASE?'-basepath':'')+'.json',JSON.stringify({basePath:new URL(base).pathname,checks:report},null,2));console.log(`Actual Jellyfin static HTTP checks passed: ${report.length}`);
