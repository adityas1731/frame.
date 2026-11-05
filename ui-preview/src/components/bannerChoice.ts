/** Device-local display preference. Never an image upload or a Jellyfin metadata edit. */
export function bannerChoiceKey(server:string,user:string,item:string,provider:string) {
  return `frame:banner:v1:${JSON.stringify([server,user,item,provider])}`;
}
export function safeBannerUrl(value:unknown):string|undefined {
  if(typeof value!=='string')return;
  try { const url=new URL(value);if(url.origin==='https://image.tmdb.org'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/t\/p\/original\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(url.pathname))return url.href; }catch{/* Invalid stored preference is ignored. */}
}
