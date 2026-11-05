const enumLabels=new Set(['small','medium','large','comfortable','compact','expanded','row','grid','carousel','poster','backdrop','landscape','square','portrait','circle','pill','minimal','artwork','overlay','below','hidden']);
/** Label display only: preserve stored enum values and user/library names. */
export function optionLabel(label:string,value:string){return label===value&&enumLabels.has(value)?label.charAt(0).toUpperCase()+label.slice(1):label;}
