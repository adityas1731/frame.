import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ConnectionMachine,connectionUnavailable} from '../src/jellyfin/connectionMachine.ts';
import {ArtworkSaveMachine} from '../src/components/artworkSaveMachine.ts';
import {initialPresentation,presentationTransition as step,canHideControls,canPauseIdle,shouldResumeEpisodeBrowser} from '../src/playback/presentationMachine.ts';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const client=name=>({name,disposed:0,dispose(){this.disposed++;}});
const memory=session=>({saved:session,remembered:!!session,message:''});
const connect=(machine,c,session)=>{const operation=machine.begin('connecting');machine.attach(operation,c);assert.equal(machine.accept(c,session,memory(session)),true);};
const media=(patch={})=>({phase:'playing',paused:false,hasPlan:true,error:false,choosing:false,sessionId:'one',...patch});
const play=()=>step(initialPresentation(),{type:'media',media:media()});

test('connection: replaced restoration cannot activate or overwrite a newer session',()=>{
 const machine=new ConnectionMachine('saved'),a=client('A'),b=client('B');
 const first=machine.begin('restoring');machine.attach(first,a);
 const second=machine.begin('restoring');machine.attach(second,b);
 assert.equal(a.disposed,1);assert.equal(machine.current(first),false);
 assert.equal(machine.accept(a,'old',memory('old')),false);
 assert.equal(machine.reject(first,true,'late invalid credentials'),false);
 assert.equal(machine.accept(b,'new',memory('new')),true);
 assert.equal(machine.snapshot().active.client,b);assert.equal(machine.snapshot().saved,'new');
});
test('connection: disconnect invalidates pending restoration and manual authentication synchronously',()=>{
 for(const phase of ['restoring','connecting']){
  const machine=new ConnectionMachine('saved'),a=client('A');
  const operation=machine.begin(phase);machine.attach(operation,a);machine.signOut();
  assert.equal(machine.current(operation),false);assert.equal(machine.owns(a),false);
  assert.equal(machine.accept(a,'late',memory('late')),false);
  assert.equal(machine.snapshot().phase,'signed-out');assert.equal(machine.snapshot().saved,null);
 }
});
test('connection: transport failure retains remembered sign-in; invalid credentials clear it',()=>{
 const machine=new ConnectionMachine('saved'),a=client('A');
 let operation=machine.begin('restoring');machine.attach(operation,a);machine.reject(operation,false,'offline');
 assert.equal(machine.snapshot().phase,'unavailable');assert.equal(machine.snapshot().saved,'saved');assert.equal(machine.snapshot().remembered,true);
 operation=machine.begin('restoring');machine.attach(operation,client('B'));machine.reject(operation,true,'expired');
 assert.equal(machine.snapshot().phase,'signed-out');assert.equal(machine.snapshot().saved,null);assert.equal(machine.snapshot().remembered,false);
});
test('connection: late logout failures and revoked old clients do not change a new account',()=>{
 const machine=new ConnectionMachine(),a=client('A'),b=client('B');connect(machine,a,'A');
 const {operation}=machine.signOut();connect(machine,b,'B');
 machine.logoutFailed(operation,'late logout error');machine.unavailable(a);assert.equal(machine.expire(a,'expired A'),false);
 assert.equal(machine.snapshot().phase,'connected');assert.equal(machine.snapshot().active.client,b);assert.equal(machine.snapshot().message,'');
});
test('connection: active revocation cancels in-flight reconnect and clears memory',()=>{
 const machine=new ConnectionMachine(),a=client('A'),b=client('B');connect(machine,a,'A');
 const operation=machine.begin('restoring');machine.attach(operation,b);assert.equal(machine.expire(a,'expired'),true);
 assert.equal(b.disposed,1);assert.equal(machine.current(operation),false);assert.equal(machine.snapshot().phase,'signed-out');assert.equal(machine.snapshot().saved,null);
});
test('connection: forgetting and cancelling cannot re-persist a pending sign-in',()=>{
 const machine=new ConnectionMachine('saved'),a=client('A');const operation=machine.begin('restoring');machine.attach(operation,a);machine.forget();
 assert.equal(machine.current(operation),false);assert.equal(machine.snapshot().saved,null);
 const b=client('B');const next=machine.begin('connecting');machine.attach(next,b);machine.cancel(b);
 assert.equal(machine.owns(b),false);assert.equal(machine.snapshot().phase,'signed-out');
 const c=client('C');connect(machine,c,'C');machine.remember(memory(null));assert.equal(machine.snapshot().active.client,c);assert.equal(machine.snapshot().remembered,false);
});
test('connection: late attachment is disposed, and stale cancel cannot cancel the current client',()=>{
 const machine=new ConnectionMachine(),a=client('A'),b=client('B');const first=machine.begin('restoring');const second=machine.begin('connecting');machine.attach(second,b);
 assert.equal(machine.attach(first,a),false);assert.equal(a.disposed,1);machine.cancel(a);assert.equal(machine.owns(b),true);
});

test('artwork: rapid duplicate clicks produce exactly one write and preserve step ordering',async()=>{
 const machine=new ArtworkSaveMachine(),prepared=deferred(),written=deferred(),log=[];
 const job={scope:'shared',prepare:()=>{log.push('prepare');return prepared.promise;},write:async()=>{log.push('write');await written.promise;},commit:async()=>{log.push('commit');},applied:()=>log.push('applied'),message:'saved'};
 const first=machine.run(job);assert.equal(await machine.run(job),false);assert.equal(machine.snapshot().phase,'preparing');
 prepared.resolve('blob');await Promise.resolve();assert.equal(machine.snapshot().phase,'saving');assert.deepEqual(log,['prepare','write']);
 written.resolve();assert.equal(await first,true);assert.deepEqual(log,['prepare','write','commit','applied']);assert.equal(machine.snapshot().phase,'saved');
});
test('artwork: changing title/account/kind during preparation prevents any write',async()=>{
 const machine=new ArtworkSaveMachine(),prepared=deferred();let writes=0;
 const old=machine.run({scope:'shared',prepare:()=>prepared.promise,write:async()=>{writes++;}});machine.cancel();
 prepared.resolve('old blob');assert.equal(await old,false);assert.equal(writes,0);assert.equal(machine.snapshot().phase,'idle');
});
test('artwork: completion of an already-started old write cannot clear overrides or finish a newer operation',async()=>{
 const machine=new ArtworkSaveMachine(),written=deferred(),next=deferred();let commits=0,applied=0;
 const old=machine.run({scope:'shared',prepare:async()=>1,write:()=>written.promise,commit:async()=>{commits++;},applied:()=>applied++});await Promise.resolve();
 machine.cancel();const fresh=machine.run({scope:'local',prepare:()=>next.promise,write:async()=>{}});
 written.resolve();assert.equal(await old,false);assert.equal(machine.snapshot().phase,'preparing');assert.equal(commits,0);assert.equal(applied,0);
 next.resolve(2);assert.equal(await fresh,true);assert.equal(machine.snapshot().phase,'saved');
});
test('artwork: cancellation during local persistence rejects follow-up selection and feedback',async()=>{
 const machine=new ArtworkSaveMachine(),written=deferred();let emitted=false,commits=0;
 const work=machine.run({scope:'local',prepare:async()=>1,write:async(_,current)=>{await written.promise;if(current())emitted=true;},commit:async()=>{commits++;}});
 await Promise.resolve();machine.cancel();written.resolve();await work;assert.equal(emitted,false);assert.equal(commits,0);
});
test('artwork: uncertain shared save blocks duplicate retries until rechecked',async()=>{
 const machine=new ArtworkSaveMachine();let writes=0;
 const job={scope:'shared',prepare:async()=>1,write:async()=>{writes++;throw Error('connection lost');}};
 assert.equal(await machine.run(job),false);assert.equal(machine.snapshot().phase,'uncertain');assert.match(machine.snapshot().message,/did not confirm/);
 assert.equal(await machine.run(job),false);assert.equal(writes,1);machine.rechecked();assert.equal(machine.snapshot().phase,'idle');
});
test('artwork: preparation/permission failure is retryable, shared commit failure is not blindly repeated',async()=>{
 const machine=new ArtworkSaveMachine();let writes=0;
 await machine.run({scope:'shared',prepare:async()=>{throw Error('image too large');},write:async()=>{writes++;}});assert.equal(machine.snapshot().phase,'failed');assert.equal(writes,0);
 await machine.run({scope:'shared',prepare:async()=>1,write:async()=>{throw Object.assign(Error('forbidden'),{status:403});}});assert.equal(machine.snapshot().phase,'failed');
 await machine.run({scope:'shared',prepare:async()=>1,write:async()=>{writes++;},commit:async()=>{throw Error('disk full');}});assert.equal(machine.snapshot().phase,'uncertain');assert.match(machine.snapshot().message,/was saved to Jellyfin/);assert.equal(writes,1);
});
test('artwork: gallery refresh cannot unlock a save still in progress',async()=>{
 const machine=new ArtworkSaveMachine(),prepared=deferred();const saving=machine.run({scope:'local',prepare:()=>prepared.promise,write:async()=>{}});
 machine.rechecked();assert.equal(machine.snapshot().phase,'preparing');prepared.resolve(1);assert.equal(await saving,true);
});

test('playback: old inactivity timers cannot hide newly opened panels or recent activity',()=>{
 let state=play();const activity=state.activity;state=step(state,{type:'settings'});state=step(state,{type:'idle',activity,keyboardFocus:false});assert.equal(state.panel,'settings');assert.equal(state.surface,'controls');
 state=step(state,{type:'close-settings'});state=step(state,{type:'activity',input:'pointer'});assert.equal(step(state,{type:'idle',activity,keyboardFocus:false}).surface,'controls');
 assert.equal(step(state,{type:'idle',activity:state.activity,keyboardFocus:false}).surface,'hidden');
});
test('playback: pause idle cannot become completion and ends immediately on resume/buffering/error',()=>{
 let state=step(play(),{type:'media',media:media({phase:'paused',paused:true})});const activity=state.activity;
 state=step(state,{type:'pause-idle',activity});assert.equal(state.surface,'pause');assert.equal(state.media.phase,'paused');
 for(const update of [media(),media({phase:'buffering'}),media({phase:'failed',error:true}),media({phase:'ended',paused:true})]){
  const changed=step(state,{type:'media',media:update});assert.equal(changed.surface,'controls');assert.equal(step(changed,{type:'pause-idle',activity}).surface,'controls');
 }
});
test('playback: keyboard focus retains controls while pointer-focused controls may idle',()=>{
 let state=step(play(),{type:'activity',input:'keyboard'});
 assert.equal(step(state,{type:'idle',activity:state.activity,keyboardFocus:true}).surface,'controls');
 assert.equal(step(state,{type:'idle',activity:state.activity,keyboardFocus:false}).surface,'hidden');
 state=step(state,{type:'activity',input:'pointer'});assert.equal(step(state,{type:'idle',activity:state.activity,keyboardFocus:true}).surface,'hidden');
});
test('playback: episode browser resumes only its own paused session, never ended, failed or switched media',()=>{
 let state=step(play(),{type:'episodes'});assert.equal(state.resumeSession,'one');assert.equal(state.panel,'episodes');
 state=step(state,{type:'media',media:media({phase:'paused',paused:true})});assert.equal(shouldResumeEpisodeBrowser(state,state.media),true);
 for(const current of [media({phase:'ended',paused:true}),media({phase:'failed',paused:true,error:true}),media({phase:'paused',paused:true,sessionId:'two'}),media({phase:'switching',paused:true})])assert.equal(shouldResumeEpisodeBrowser(state,current),false);
 state=step(state,{type:'close-episodes'});assert.equal(state.resumeSession,undefined);assert.equal(shouldResumeEpisodeBrowser(state,media({phase:'paused',paused:true})),false);
 const alreadyPaused=step(step(play(),{type:'media',media:media({phase:'paused',paused:true})}),{type:'episodes'});assert.equal(alreadyPaused.resumeSession,undefined);
});
test('playback: all phases and panels obey idle visibility invariants',()=>{
 for(const phase of ['idle','negotiating','ready','playing','paused','buffering','seeking','switching','ended','failed','disposed'])for(const paused of [true,false])for(const panel of ['none','settings','episodes'])for(const choosing of [true,false]){
  let state=step(initialPresentation(),{type:'media',media:media({phase,paused,choosing})});if(panel!=='none')state=step(state,{type:panel});
  const hidden=step(state,{type:'idle',activity:state.activity,keyboardFocus:false});assert.equal(hidden.surface==='hidden',canHideControls(state));
  const idle=step(state,{type:'pause-idle',activity:state.activity});assert.equal(idle.surface==='pause',canPauseIdle(state));
 }
});
test('playback: leaving is terminal for late timers and source updates; entry choice stays explicit',()=>{
 let state=step(play(),{type:'entry',entry:'restart'});assert.equal(state.entry,'restart');state=step(state,{type:'leave'});
 for(const event of [{type:'activity'},{type:'episodes'},{type:'settings'},{type:'media',media:media({phase:'ended'})},{type:'idle',activity:state.activity,keyboardFocus:false}])assert.equal(step(state,event),state);
});

test('connection: saved startup is restoring immediately, and storage failure can keep only the live session',()=>{
 const machine=new ConnectionMachine('saved');assert.equal(machine.snapshot().phase,'restoring');
 const operation=machine.begin('restoring'),a=client('A');machine.attach(operation,a);
 machine.accept(a,'A',{saved:null,remembered:false,message:'storage blocked'});
 assert.equal(machine.snapshot().phase,'connected');assert.equal(machine.snapshot().active.session,'A');assert.equal(machine.snapshot().remembered,false);assert.equal(machine.snapshot().saved,null);
});
test('artwork: successful save stays successful through its own artwork revision',async()=>{
 const machine=new ArtworkSaveMachine();await machine.run({scope:'local',prepare:async()=>1,write:async()=>{},message:'saved'});machine.rechecked();assert.equal(machine.snapshot().phase,'saved');assert.equal(machine.snapshot().message,'saved');
});
test('artwork: uncertain writes request fresh reads once but never repeat the write',async()=>{
 const machine=new ArtworkSaveMachine();let refresh=0,writes=0;const job={scope:'shared',prepare:async()=>1,write:async()=>{writes++;throw Error('offline');},unconfirmed:()=>refresh++};await machine.run(job);await machine.run(job);assert.equal(writes,1);assert.equal(refresh,1);
});
test('playback: paused keyboard focus cannot be displaced by idle presentation',()=>{
 let state=step(play(),{type:'media',media:media({phase:'paused',paused:true})});state=step(state,{type:'activity',input:'keyboard'});assert.equal(step(state,{type:'pause-idle',activity:state.activity,keyboardFocus:true}).surface,'controls');assert.equal(step(state,{type:'pause-idle',activity:state.activity,keyboardFocus:false}).surface,'pause');
});

test('connection: probing a replacement server keeps an unavailable previous session unavailable',()=>{
 const machine=new ConnectionMachine(),a=client('A'),b=client('B');connect(machine,a,'A');machine.unavailable(a);
 const operation=machine.begin('connecting');machine.attach(operation,b);assert.equal(connectionUnavailable(machine.snapshot()),true);
 machine.cancel(b);assert.equal(machine.snapshot().phase,'unavailable');assert.equal(machine.snapshot().active.client,a);
 const c=client('C'),next=machine.begin('connecting');machine.attach(next,c);machine.accept(c,'C',memory('C'));assert.equal(connectionUnavailable(machine.snapshot()),false);
});
