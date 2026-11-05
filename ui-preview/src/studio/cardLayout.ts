/** Fit whole cards to a viewport while treating the chosen size as the target. */
export function fitWidgetCards(width:number,target:number,gap:number){
 const available=Math.max(1,width);
 const spacing=Math.max(0,gap);
 const columns=Math.max(1,Math.floor((available+spacing)/(Math.max(1,target)+spacing)));
 return {columns,width:(available-spacing*(columns-1))/columns};
}
