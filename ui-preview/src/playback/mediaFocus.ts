/** A page has one audible media owner. A late play event cannot reclaim focus. */
export class MediaFocus {
 private active?:{owner:object;interrupt:()=>void};
 private listeners=new Set<()=>void>();
 snapshot=()=>this.active?.owner;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private changed(){this.listeners.forEach(listener=>listener());}
 claim(owner:object,interrupt:()=>void){const old=this.active;this.active={owner,interrupt};if(old&&old.owner!==owner)old.interrupt();if(old?.owner!==owner)this.changed();}
 owns(owner:object){return this.active?.owner===owner;}
 release(owner:object){if(this.owns(owner)){this.active=undefined;this.changed();}}
}
export const mediaFocus=new MediaFocus();
