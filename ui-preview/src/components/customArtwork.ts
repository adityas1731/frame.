export type ArtworkKind='banner'|'card';
export const MAX_ARTWORK_BYTES=10*1024*1024;
export function rasterType(bytes:Uint8Array):string|undefined {
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
  if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
}
/** Decode locally, constrain memory/dimensions and re-encode; never retain EXIF or active SVG. */
export async function prepareArtwork(file:Blob,kind:ArtworkKind):Promise<Blob> {
  if(!file.size||file.size>MAX_ARTWORK_BYTES)throw new Error('Choose a JPG, PNG or WebP image under 10 MB.');
  if(!rasterType(new Uint8Array(await file.slice(0,12).arrayBuffer())))throw new Error('Choose a JPG, PNG or WebP image.');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.decoding='async';
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('This image could not be opened. Try another file.'));image.src=url;});
    const {naturalWidth:width,naturalHeight:height}=image;
    if(!width||!height||width>16384||height>16384||width*height>40000000)throw new Error('Choose an image below 40 megapixels and 16,384 pixels per side.');
    const scale=Math.min(1,(kind==='banner'?3840:2000)/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Image processing is unavailable in this browser.');
    context.fillStyle='#101114';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('This image could not be saved. Try another file.')),'image/jpeg',.92));
  } finally { URL.revokeObjectURL(url); }
}
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('frame-custom-artwork',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('images');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>{database=undefined;reject(new Error('Device storage is unavailable.'));};
});}
export async function readCustomArtwork(key:string):Promise<Blob|undefined>{
  const database=await db();return new Promise((resolve,reject)=>{const request=database.transaction('images','readonly').objectStore('images').get(key);request.onsuccess=()=>resolve(request.result instanceof Blob?request.result:undefined);request.onerror=()=>reject(request.error);});
}
export async function writeCustomArtwork(key:string,blob?:Blob):Promise<void>{
  const database=await db();return new Promise((resolve,reject)=>{const transaction=database.transaction('images','readwrite');const store=transaction.objectStore('images');if(blob)store.put(blob,key);else store.delete(key);transaction.oncomplete=()=>resolve();transaction.onabort=transaction.onerror=()=>reject(new Error('Image could not be saved on this device. Storage may be full.'));});
}
