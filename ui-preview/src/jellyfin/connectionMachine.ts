/** Owns session transitions synchronously, including work between React renders. */
export interface DisposableClient {dispose:()=>void}
export interface ConnectionMemory<S> {saved:S|null;remembered:boolean;message:string}
type Active<C,S>={client:C;session:S};
export type ConnectionSnapshot<C,S>=ConnectionMemory<S>&(
 | {phase:'signed-out';active:null}
 | {phase:'connected';active:Active<C,S>}
 | {phase:'unavailable';active:Active<C,S>|null}
 | {phase:'restoring'|'connecting';active:Active<C,S>|null;operation:number;pending:C|null;origin:'signed-out'|'connected'|'unavailable'}
);
export class ConnectionMachine<C extends DisposableClient,S>{
 private epoch=0;
 private listeners=new Set<()=>void>();
 private state:ConnectionSnapshot<C,S>;
 constructor(saved:S|null=null){this.state=saved?{phase:'restoring',active:null,saved,remembered:true,message:'',operation:0,pending:null,origin:'signed-out'}:{phase:'signed-out',active:null,saved:null,remembered:false,message:''};}
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(state:ConnectionSnapshot<C,S>){this.state=state;this.listeners.forEach(listener=>listener());}
 private cancelPending(){if(this.state.phase==='restoring'||this.state.phase==='connecting')this.state.pending?.dispose();}
 current(operation:number){return (this.state.phase==='restoring'||this.state.phase==='connecting')&&this.state.operation===operation;}
 begin(phase:'restoring'|'connecting'){
  this.cancelPending();const operation=++this.epoch;
  const origin=this.state.phase==='restoring'||this.state.phase==='connecting'?this.state.origin:this.state.phase;
  const {active,saved,remembered}=this.state;
  this.publish({phase,active,saved,remembered,message:'',operation,pending:null,origin});return operation;
 }
 attach(operation:number,client:C){
  if(!this.current(operation)){client.dispose();return false;}
  const state=this.state as Extract<ConnectionSnapshot<C,S>,{phase:'restoring'|'connecting'}>;
  if(state.pending&&state.pending!==client)state.pending.dispose();
  this.publish({...state,pending:client});return true;
 }
 owns(client:C){return (this.state.phase==='restoring'||this.state.phase==='connecting')&&this.state.pending===client;}
 accept(client:C,session:S,memory:ConnectionMemory<S>){
  if(!this.owns(client)){client.dispose();return false;}
  const previous=this.state.active;if(previous&&previous.client!==client)previous.client.dispose();
  ++this.epoch;this.publish({phase:'connected',active:{client,session},...memory});return true;
 }
 reject(operation:number,invalid:boolean,message:string){
  if(!this.current(operation))return false;
  this.cancelPending();++this.epoch;
  if(invalid){this.state.active?.client.dispose();this.publish({phase:'signed-out',active:null,saved:null,remembered:false,message});}
  else {const {active,saved,remembered}=this.state;this.publish({phase:'unavailable',active,saved,remembered,message});}
  return true;
 }
 cancel(client?:C){
  if(client&&!this.owns(client))return;
  this.cancelPending();++this.epoch;
  const offline=connectionUnavailable(this.state);const {active,saved,remembered}=this.state;
  this.publish(offline?{phase:'unavailable',active,saved,remembered,message:''}:active?{phase:'connected',active,saved,remembered,message:''}:{phase:'signed-out',active:null,saved,remembered,message:''});
 }
 remember(memory:ConnectionMemory<S>){if(this.state.active)this.publish({...this.state,...memory});}
 forget(){
  this.cancel();const active=this.state.active;const offline=connectionUnavailable(this.state);
  this.publish(active?{phase:offline?'unavailable':'connected',active,saved:null,remembered:false,message:''}:{phase:'signed-out',active:null,saved:null,remembered:false,message:''});
 }
 unavailable(source:C){
  if(this.state.active?.client!==source)return;
  if(this.state.phase==='restoring'||this.state.phase==='connecting')this.publish({...this.state,origin:'unavailable'});
  else this.publish({...this.state,phase:'unavailable'});
 }
 expire(source:C,message:string){
  if(this.state.active?.client!==source)return false;
  this.signOut(message);source.dispose();return true;
 }
 signOut(message=''){
  this.cancelPending();const old=this.state.active;++this.epoch;
  this.publish({phase:'signed-out',active:null,saved:null,remembered:false,message});
  return {old,operation:this.epoch};
 }
 logoutFailed(operation:number,message:string){
  if(this.epoch===operation&&this.state.phase==='signed-out')this.publish({...this.state,message});
 }
}

export function connectionUnavailable<C,S>(state:ConnectionSnapshot<C,S>){return state.phase==='unavailable'||(state.phase==='connecting'||state.phase==='restoring')&&state.origin==='unavailable';}
