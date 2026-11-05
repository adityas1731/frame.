export function sameMediaItem(left:unknown,right:unknown):boolean;
export function mediaPathAllowed(path:string,itemId:string):boolean;
export function cleanMediaUrl(raw:string,base:string,itemId:string):string;
export function gatewayPath(nonce:string,relative:string,scope?:string):string;
export function rewritePlaylist(text:string,upstream:string,base:string,itemId:string,nonce:string,scope?:string):string;
