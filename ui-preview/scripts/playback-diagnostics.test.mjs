import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackDiagnostics,diagnosticReport,latestDiagnostics,clearDiagnostics,subscribeDiagnostics} from '../src/playback/diagnostics.ts';
test('diagnostics allowlist rejects credentials, raw errors, URLs and hostile enum values',()=>{
 const log=new PlaybackDiagnostics();
 log.add('source',{token:'secret',url:'http://private/?api_key=secret',error:new Error('secret'),name:'Private title',sourceNumber:1,directPlay:false,container:'secret',videoCodec:'h264',status:NaN,protocol:'http'});
 const events=log.snapshot();assert.deepEqual(events[0].facts,{sourceNumber:1,directPlay:false,container:'unknown',videoCodec:'h264',protocol:'http'});
 assert.doesNotMatch(diagnosticReport(events),/secret|Private title|api_key/);
 events[0].facts.sourceNumber=99;assert.equal(log.snapshot()[0].facts.sourceNumber,1);
});
test('diagnostic history is bounded and retains the latest failure',()=>{
 const log=new PlaybackDiagnostics();for(let i=0;i<200;i++)log.add('attempt',{attempt:i});log.add('failed',{status:403,category:'api'});
 const events=log.snapshot();assert.equal(events.length,160);assert.equal(events.at(-1).facts.status,403);assert.equal(JSON.parse(diagnosticReport(events)).format,'frame-playback-diagnostics-v1');
});

test('Settings history is sanitized, stable, clearable and ignores older session cleanup',()=>{
 let notifications=0;const stop=subscribeDiagnostics(()=>notifications++);const older=new PlaybackDiagnostics();older.add('plan',{mode:'direct'});const current=new PlaybackDiagnostics();current.add('plan',{mode:'transcode',token:'secret'});const snapshot=latestDiagnostics();assert.equal(latestDiagnostics(),snapshot);assert.ok(Object.isFrozen(snapshot));older.add('cleanup');assert.equal(latestDiagnostics(),snapshot);assert.doesNotMatch(JSON.stringify(snapshot),/secret/);clearDiagnostics();assert.equal(latestDiagnostics().length,0);assert.ok(notifications>0);stop();
});
test('export re-sanitizes caller facts and rejects hostile stage names',()=>{const report=diagnosticReport([{elapsedMs:0,stage:'token=secret',facts:{}},{elapsedMs:0,stage:'source',facts:{url:'http://secret',token:'secret',videoCodec:'private title'}}]);assert.doesNotMatch(report,/secret|private title/);});
