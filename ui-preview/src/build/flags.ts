/** Native Node tests have no Vite replacement; keep their default internal profile explicit. */
if(typeof __FRAME_DIAGNOSTICS__==='undefined')(globalThis as {__FRAME_DIAGNOSTICS__?:boolean}).__FRAME_DIAGNOSTICS__=true;
export const DIAGNOSTICS_ENABLED=__FRAME_DIAGNOSTICS__;
