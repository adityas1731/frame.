const noise=/(?:press\s+(?:kit|release)|media\s+kit|publicity\s+(?:kit|source)|metadata\s+(?:source|provider))/i;
/** Filter provenance-shaped fields, not legitimate studio names, genres or credits. */
export function cleanFact(label:string,value:unknown){
 if(noise.test(label)||/^(?:source|provider|credit source|attribution)$/i.test(label.trim()))return false;
 if(typeof value==='string'&&/^(?:Disney\+?|Marvel|Netflix|Sony|Universal|HBO|Amazon Prime|Apple TV\+?)\s+(?:press|media|publicity)\s+kit$/i.test(value.trim()))return false;
 if(typeof value==='string'&&!/^(?:original title|title|studio)$/i.test(label)&&noise.test(value)&&value.trim().length<120)return false;
 return true;
}
export function providerFacts(ids:Record<string,string>|undefined){
 return Object.entries(ids??{}).filter(([key,value])=>cleanFact(key,value)&&/^[a-z][a-z\d _-]{0,35}$/i.test(key)&&/^[a-z\d._:-]{1,100}$/i.test(value));
}
