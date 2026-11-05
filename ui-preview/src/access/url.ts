/** Public navigation address only. Never copy current query strings or player routes. */
export function loopbackHost(hostname:string){
 const host=hostname.toLowerCase().replace(/^\[|\]$/g,'');
 return host==='localhost'||host.endsWith('.localhost')||host==='0.0.0.0'||host==='::'||host==='::1'||/^127\./.test(host)||/^::ffff:(?:127\.|7f[\da-f]{2}:)/.test(host);
}
export function selectedFrameUrl(input:string):{url?:string;error?:string}{
 try{
  const url=new URL(input.trim());
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||!['','#/'].includes(url.hash))return {error:'Use a frame. HTTP(S) address without credentials, query parameters or a page-specific route.'};
  if(!/^(?:\/[^/]+)*\/Frame\/Web\/?$/i.test(url.pathname)||/%(?:00|2f|5c)/i.test(url.pathname))return {error:'Enter the full Jellyfin-hosted frame. address ending in /Frame/Web/.'};
  if(loopbackHost(url.hostname))return {error:'Localhost only reaches this device. Enter the server’s LAN or public frame. address.'};
  if(url.hostname.endsWith('.invalid')||url.hostname.endsWith('.test'))return {error:'Enter a server address reachable from your other device.'};
  url.pathname=url.pathname.replace(/\/?$/,'/');url.hash='/';
  if(url.href.length>1500)return {error:'This address is too long to share as a useful QR code.'};
  return {url:url.href};
 }catch{return {error:'Enter a complete frame. URL, including http:// or https://.'};}
}
/** Accept a pasted frame. URL, server base URL, or a host/IP; selection stays explicit. */
export function frameAddress(input:string,page:string):{url?:string;error?:string}{
 try{
  const current=new URL(page);const text=input.trim();
  if(!text)return {error:'Enter your server’s address.'};
  const explicit=/^[a-z][a-z\d+.-]*:\/\//i.test(text);
  const url=new URL(explicit?text:`${current.protocol}//${text}`);
  if(!explicit&&!url.port){
   if(!/\/Frame\/Web\/?$/i.test(current.pathname))return {error:'Include the server port, for example 192.168.1.20:8096.'};
   if(current.port)url.port=current.port;
  }
  if(!explicit&&url.pathname==='/')url.pathname=current.pathname.match(/^(.*)\/Frame\/Web\/?$/i)?.[1]||'/';
  if(url.username||url.password||url.search||!['','#/'].includes(url.hash))return {error:'Use the server address without sign-in details or a title link.'};
  if(!/\/Frame\/Web\/?$/i.test(url.pathname))url.pathname=url.pathname.replace(/\/$/,'')+'/Frame/Web/';
  return selectedFrameUrl(url.href);
 }catch{return {error:'Enter an IP address or a complete server URL.'};}
}
export function suggestedFrameUrl(page:string,configuredServer?:string):{url:string;note:string}{
 try{
  const current=new URL(page);const match=current.pathname.match(/^(.*)\/Frame\/Web\/?$/i);
  if(match){
   const clean=`${current.origin}${match[1]}/Frame/Web/#/`;
   if(!loopbackHost(current.hostname))return {url:clean,note:'Scan on another device, then sign in.'};
   if(configuredServer){const server=new URL(configuredServer);if(!server.username&&!server.password&&!server.search&&!server.hash&&!loopbackHost(server.hostname))return {url:`${server.origin}${server.pathname.replace(/\/$/,'')}/Frame/Web/#/`,note:'Your server address. Use the same Wi-Fi on your phone.'};}
   return {url:'',note:'Connect your phone to the same network and enter your server’s address below.'};
  }
 }catch{/* Invalid document/configuration addresses are not shared. */}
 return {url:'',note:'Enter your Jellyfin server address to create a QR code for another device.'};
}
