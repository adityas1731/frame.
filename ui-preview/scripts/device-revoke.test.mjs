import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JellyfinClient} from '../src/jellyfin/client.ts';
import {canRevokeDevice,currentDevice} from '../src/jellyfin/devices.ts';

test('revoke action is restricted to administrators and excludes the current device',()=>{
 const row={deviceId:'other',client:'frame.'};
 assert.equal(canRevokeDevice(row,'here',true),true);
 assert.equal(canRevokeDevice(row,'here',false),false);
 assert.equal(canRevokeDevice(row,'other',true),false);
 assert.equal(currentDevice({deviceId:'here',client:'frame.'},'here'),true);
});
test('revocation verifies current administrator permissions and sends only the device ID',async()=>{
 const calls=[];const client=new JellyfinClient('https://fixture.invalid/base','here',async(url,init)=>{
  calls.push({url,init});return init.method==='DELETE'?new Response(null,{status:204}):Response.json({Id:'admin',Policy:{IsAdministrator:true}});
 });
 try{await client.revokeDevice('another device&x');assert.equal(calls.length,2);assert.match(calls[0].url,/\/Users\/Me$/);const request=calls[1];assert.equal(request.init.method,'DELETE');assert.equal(new URL(request.url).pathname,'/base/Devices');assert.deepEqual([...new URL(request.url).searchParams],[['id','another device&x']]);assert.equal(request.init.body,undefined);}finally{client.dispose();}
});
test('self-revocation and ordinary accounts cannot dispatch a device deletion',async()=>{
 let calls=0;const client=new JellyfinClient('https://fixture.invalid','here',async()=>{calls++;return Response.json({Id:'user',Policy:{IsAdministrator:false}});});
 try{await assert.rejects(client.revokeDevice('here'),error=>error.status===400);assert.equal(calls,0);await assert.rejects(client.revokeDevice('other'),error=>error.status===403);assert.equal(calls,1);}finally{client.dispose();}
});
test('a rejected revocation does not expire the current connection or retry a write',async()=>{
 let deletes=0,expired=0;const client=new JellyfinClient('https://fixture.invalid','here',async(url,init)=>init.method==='DELETE'?(deletes++,new Response(null,{status:403})):Response.json({Id:'admin',Policy:{IsAdministrator:true}}),()=>expired++);
 try{await assert.rejects(client.revokeDevice('other'),error=>error.status===403);assert.equal(deletes,1);assert.equal(expired,0);}finally{client.dispose();}
});
