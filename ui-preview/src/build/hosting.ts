/** Resolve assets from the document base, including a Jellyfin reverse-proxy prefix. */
export function hosting(baseURI:string){
 const app=new URL('.',baseURI);
 if(!['http:','https:'].includes(app.protocol)||app.username||app.password)throw Error('Invalid frame. hosting URL.');
 const match=app.pathname.match(/^(.*)\/Frame\/Web\/$/i);
 return {appUrl:app.href,scope:app.pathname,serverUrl:match?app.origin+match[1]:undefined};
}
export function assetUrl(relative:string,baseURI=document.baseURI){return new URL(relative,hosting(baseURI).appUrl).href;}
