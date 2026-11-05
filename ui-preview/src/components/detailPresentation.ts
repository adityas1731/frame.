/** Display formatting only. Never written back to Jellyfin or metadata providers. */
export function personName(value: string | undefined): string | undefined {
  return value?.trim().replace(/(^|[\s\-'’])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase('en'));
}

export function premiereDate(value: string | undefined): string | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return undefined;
  const n = Number(day);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'} as Record<number,string>)[n % 10] ?? 'th';
  return `${n}${suffix} ${date.toLocaleString('en-GB', {month:'long', timeZone:'UTC'})} ${year}`;
}

/** Preserve exact server genre labels, including combined labels and punctuation. */
export function genreDestination(genre: string): string {
  return `/library?${new URLSearchParams({genre})}`;
}
