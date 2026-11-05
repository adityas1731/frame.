interface SectionBounds {id:string;top:number;bottom:number}
/** Follow the panel occupying the most readable viewport space, not a passed heading. */
export function visibleSettingsSection(sections:SectionBounds[],viewportTop:number,viewportBottom:number){
 let active=sections[0]?.id;
 let largest=0;
 for(const section of sections){
  const visible=Math.max(0,Math.min(section.bottom,viewportBottom)-Math.max(section.top,viewportTop));
  if(visible>largest){largest=visible;active=section.id;}
 }
 if(largest===0&&sections.length){
  active=[...sections].sort((a,b)=>Math.abs(a.top-viewportTop)-Math.abs(b.top-viewportTop))[0].id;
 }
 return active;
}
