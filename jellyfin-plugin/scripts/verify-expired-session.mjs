import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {JellyfinClient} from '../../ui-preview/src/jellyfin/client.ts';
import {base,session,api} from './test-api.mjs';
const credentials=JSON.parse(await readFile('.test-instance/credentials.json','utf8'));
const client=new JellyfinClient(base,'frame-expiration-test');const server=await client.probe();const temporary=await client.authenticate(server,credentials.username,credentials.password);await client.logout();
let rejected=false;const expired=new JellyfinClient(base,'frame-expiration-test',undefined,()=>{rejected=true;});expired.restore(temporary);
await assert.rejects(()=>expired.libraries(temporary.user.Id),e=>e.status===401);assert.ok(rejected);expired.dispose();
await writeFile('docs/auth-verification.json',JSON.stringify({realServer:true,existingDisposableAccountOnly:true,logoutRevokedTemporaryToken:true,expiredTokenReturned401:true,unauthorizedCallbackRan:true,secretsLogged:false},null,2));console.log('Real logout, revoked-token401 and client unauthorized callback passed.');
