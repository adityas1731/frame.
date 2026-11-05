export const fontPresets = [
 {id:'system',label:'System sans',family:'system-ui, sans-serif'},
 {id:'humanist',label:'Humanist sans',family:'"Trebuchet MS", sans-serif'},
 {id:'editorial',label:'Classic serif',family:'Georgia, serif'},
 {id:'rounded',label:'Clear sans',family:'Verdana, sans-serif'},
 {id:'mono',label:'Studio mono',family:'Consolas, monospace'},
] as const;

export const fonts = [...fontPresets, {id:'custom',label:'Custom installed font',family:'var(--custom-font), system-ui, sans-serif'}] as const;
export type FontId = typeof fonts[number]['id'];
export function fontFamily(id:FontId){return fonts.find(font=>font.id===id)?.family??fonts[0].family;}
