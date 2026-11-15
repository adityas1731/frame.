export type ArtworkSaveState=
 | {phase:'idle'}
 | {phase:'preparing'|'saving'|'settling';operation:number;scope:'local'|'shared'}
 | {phase:'saved';message:string}
 | {phase:'failed'|'uncertain';message:string};
interface SaveJob<T>{
 scope:'local'|'shared';prepare:()=>Promise<T>;
 write:(value:T,current:()=>boolean)=>Promise<void>;
 commit?:(current:()=>boolean)=>Promise<void>;
 applied?:()=>void;unconfirmed?:()=>void;message?:string;
}
export function artworkSaveBusy(state:ArtworkSaveState){return ['preparing','saving','settling'].includes(state.phase);}
/** One mutation owner per mounted title/kind/account. Invalidated work cannot start another step. */
export class ArtworkSaveMachine {
 private operation=0;private state:ArtworkSaveState={phase:'idle'};private listeners=new Set<()=>void>();
 snapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(state:ArtworkSaveState){this.state=state;this.listeners.forEach(listener=>listener());}
 cancel(){++this.operation;this.publish({phase:'idle'});}
 rechecked(){if(this.state.phase==='uncertain'||this.state.phase==='failed')this.cancel();}
 async run<T>(job:SaveJob<T>){
  if(artworkSaveBusy(this.state)||this.state.phase==='uncertain')return false;
  const operation=++this.operation;const current=()=>this.operation===operation;
  let stage:'preparing'|'saving'|'settling'='preparing';let written=false;
  this.publish({phase:stage,operation,scope:job.scope});
  try{
   const value=await job.prepare();if(!current())return false;
   stage='saving';this.publish({phase:stage,operation,scope:job.scope});
   await job.write(value,current);written=true;if(!current())return false;
   stage='settling';this.publish({phase:stage,operation,scope:job.scope});
   await job.commit?.(current);if(!current())return false;
   this.publish({phase:'saved',message:job.message??''});job.applied?.();return true;
  }catch(error){
   if(!current())return false;
   const status=error&&typeof error==='object'&&'status' in error?Number(error.status):undefined;
   const uncertain=job.scope==='shared'&&(written||stage==='saving'&&!(status!==undefined&&status>=400&&status<500));
   const message=uncertain?(written?'Artwork was saved to Jellyfin, but this device could not finish updating. Refresh this title before choosing again.':'Jellyfin did not confirm the artwork save. Refresh this title before trying again.'):(error instanceof Error?error.message:'Artwork could not be updated.');
   this.publish({phase:uncertain?'uncertain':'failed',message});if(uncertain)job.unconfirmed?.();return false;
  }
 }
}
