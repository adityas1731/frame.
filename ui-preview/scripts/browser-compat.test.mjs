import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomId,requestSignal,streamingRequirement,BrowserCapabilityError} from '../src/platform/browser.ts';
import {errorMessage} from '../src/jellyfin/errors.ts';
import {JellyfinClient} from '../src/jellyfin/client.ts';
import {createFixtureFetch} from '../src/jellyfin/fixtures.ts';
import {hosting} from '../src/build/hosting.ts';

test('LAN HTTP UUID fallback uses strong random bytes with UUID v4 bits',()=>{
 const source={getRandomValues:crypto.getRandomValues.bind(crypto)};
 const ids=Array.from({length:1000},()=>randomId(source));
 assert.equal(new Set(ids).size,1000);
 for(const id of ids)assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 assert.throws(()=>randomId({}),BrowserCapabilityError);
});
test('capability diagnostics are actionable and arbitrary exceptions cannot leak secrets',()=>{
 assert.match(errorMessage(new BrowserCapabilityError('Secure random generation is unavailable.')),/Secure random/);
 const result=errorMessage(new TypeError('http://private.invalid?token=secret'));
 assert.match(result,/CONNECTION_INIT/);assert.doesNotMatch(result,/private|secret|token=/);
});
test('portable cancellation combines parent, already-aborted and timeout signals',async()=>{
 const parent=new AbortController(),joined=requestSignal([parent.signal],1000);parent.abort();assert.equal(joined.signal.aborted,true);joined.dispose();
 const existing=requestSignal([parent.signal],1000);assert.equal(existing.signal.aborted,true);existing.dispose();
 const timed=requestSignal([],5);await new Promise(resolve=>setTimeout(resolve,15));assert.equal(timed.signal.aborted,true);timed.dispose();
 const disposed=requestSignal([],5);disposed.dispose();await new Promise(resolve=>setTimeout(resolve,15));assert.equal(disposed.signal.aborted,false);
});
test('connection, authentication, library reads and logout work without AbortSignal statics',async()=>{
 const any=AbortSignal.any,timeout=AbortSignal.timeout;
 AbortSignal.any=undefined;AbortSignal.timeout=undefined;
 const client=new JellyfinClient('http://fixture.invalid',randomId({getRandomValues:crypto.getRandomValues.bind(crypto)}),createFixtureFetch('12.3.0'));
 try {const server=await client.probe();const session=await client.authenticate(server,'fictional','');assert.ok(session.token);assert.ok(await client.libraries(session.user.Id));await client.logout();}
 finally{client.dispose();AbortSignal.any=any;AbortSignal.timeout=timeout;}
});
test('hosted discovery preserves origin and reverse-proxy BaseUrl',()=>{
 assert.equal(hosting('http://media.invalid:8096/Frame/Web/index.html').serverUrl,'http://media.invalid:8096');
 assert.equal(hosting('https://media.invalid/jellyfin/Frame/Web/').serverUrl,'https://media.invalid/jellyfin');
});
test('HTTP playback explicitly requires HTTPS, separately from connection',()=>{
 assert.match(streamingRequirement(false,false),/HTTP allows connection, sign-in and browsing/);
 assert.match(streamingRequirement(true,false),/service-worker/);
 assert.equal(streamingRequirement(true,true),undefined);
});

