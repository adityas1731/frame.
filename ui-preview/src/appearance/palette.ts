/** Original, dependency-free dark palette generation. Input colors are tints, not raw UI surfaces. */
export const isHex=(value:unknown):value is string=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
export function mixColor(a:string,b:string,amount:number){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-amount)+parseInt(b.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');}
function light(hex:string){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
export function colorContrast(a:string,b:string){const x=light(a),y=light(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
/** Keep the chosen hue; lift only as far as necessary for small accent text and controls. */
export function readableAccent(seed:string,background:string,surface:string){
 const color=isHex(seed)?seed:'#a8c9f0';
 for(let step=0;step<=100;step++){const candidate=mixColor(color,'#ffffff',step/100);if(Math.min(colorContrast(candidate,background),colorContrast(candidate,surface))>=4.5)return candidate;}
 return '#ffffff';
}
export function atmosphereFromSeed(seed:string){
 const tint=isHex(seed)?seed:'#546475';
 const background=mixColor('#080a0f',tint,.12),surface=mixColor('#161a22',tint,.18);
 return {background,surface,text:'#f5f4f0',secondary:readableAccent('#b6bab8',background,surface)};
}
