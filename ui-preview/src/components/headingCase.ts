/** Interface headings only; never apply to movie, episode or person names. */
export function headingCase(value:string):string {
  return value.replace(/[\p{L}\p{N}][\p{L}\p{N}’']*/gu,word=>word[0].toLocaleUpperCase('en')+word.slice(1)).replace(/\bFrame\./g,'frame.');
}
