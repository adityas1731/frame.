import {readFile,readdir} from 'node:fs/promises';
import {defineConfig,type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {frameMediaPlugin} from './dev/media-proxy.ts';
import {localDiagnostics} from './config/local.ts';
import {buildProfile} from './config/profiles.ts';
import frame from '../frame.json';
function profileManifest(profile:ReturnType<typeof buildProfile>):Plugin{return{name:'frame-build-profile',async generateBundle(_options,bundle){
 for(const file of ['favicon.svg','frame-stream-policy.js','frame-stream-sw.js','providers/tmdb.svg'])this.emitFile({type:'asset',fileName:file,source:await readFile(new URL('./public/'+file,import.meta.url))});
 this.emitFile({type:'asset',fileName:'THIRD-PARTY-NOTICES.md',source:await readFile(new URL('./THIRD-PARTY-NOTICES.md',import.meta.url))});
 for(const file of await readdir(new URL('./licenses/',import.meta.url)))this.emitFile({type:'asset',fileName:'licenses/'+file,source:await readFile(new URL('./licenses/'+file,import.meta.url))});

 if(!profile.diagnostics)for(const entry of Object.values(bundle))if(entry.type==='chunk')for(const [id,module] of Object.entries(entry.modules))if(module.renderedLength>0&&/(?:playback[\\/]diagnostics\.ts|DiagnosticsPanel\.tsx|src[\\/]diagnostics[\\/])/.test(id))throw Error(`Release includes a diagnostic-only module: ${id} (${module.renderedLength} bytes).`);
 this.emitFile({type:'asset',fileName:'build-info.json',source:JSON.stringify({format:'frame-build-v1',version:frame.version,profile:profile.name,diagnostics:profile.diagnostics},null,2)});
}};}
export default defineConfig(({mode,command})=>{const profile=buildProfile(mode,command,localDiagnostics);return {
 base:'./',plugins:[react(),frameMediaPlugin(),profileManifest(profile)],
 define:{__FRAME_DIAGNOSTICS__:JSON.stringify(profile.diagnostics)},
 publicDir:command==='build'?false:'public',optimizeDeps:{include:['hls.js']},server:{host:'127.0.0.1',port:5173,strictPort:true},
 build:{outDir:profile.outDir,emptyOutDir:true,sourcemap:false,manifest:true},
};});
