interface SectionBounds {id:string;top:number;bottom:number}
/** Follow the panel at the reading line, independent of how tall its neighbour is. */
export function visibleSettingsSection(sections:SectionBounds[],viewportTop:number,viewportBottom:number){
 const readingLine=viewportTop+Math.min(96,Math.max(0,viewportBottom-viewportTop)*.15);
 return sections.find(section=>section.top<=readingLine&&section.bottom>readingLine)?.id
  ??sections.find(section=>section.top>readingLine)?.id
  ??sections.at(-1)?.id;
}
