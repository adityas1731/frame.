export function buildProfile(mode:string,command:'serve'|'build',localDiagnostics:boolean){
 if(mode==='release'||command==='build'&&mode==='production')return {name:'release',diagnostics:false,outDir:'dist/release'} as const;
 if(mode==='diagnostics')return {name:'diagnostics',diagnostics:true,outDir:'dist/diagnostics'} as const;
 return {name:'local',diagnostics:localDiagnostics,outDir:'dist/local'} as const;
}
