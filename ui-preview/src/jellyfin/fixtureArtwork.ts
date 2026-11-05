/** Original geometric artwork for framing tests; no downloaded reference pixels. */
import { media } from '../data/media.ts';
export function fixtureArtwork(path: string): string {
  const index = Number(path.match(/fixture-(\d+)/)?.[1] ?? 0);
  const colors = media[index % media.length].colors;
  const backdrop = path.includes('/Backdrop');
  if (path.includes('/Logo')) return '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="130"><text x="20" y="90" fill="#ead8b7" font-family="Georgia" font-size="65">FRAME STUDY</text></svg>';
  const width = backdrop ? 1600 : 640, height = backdrop ? 900 : 960;
  const group = index % 3 === 0;
  const people = Array.from({ length: group ? 3 : 1 }, (_, i) => `<g transform="translate(${group ? 740 + i * 270 : width * .72},40)"><path d="M-130 630q5-320 130-320t130 320" fill="${colors[0]}"/><ellipse cy="180" rx="76" ry="96" fill="${colors[1]}"/><path d="M-80 170q0-140 95-90 75 0 66 100-100-20-161-10" fill="#20252a"/><path d="m-25 190 8 0m35 0 8 0" stroke="#292a2b" stroke-width="7"/><path d="M-20 232q20 15 40 0" fill="none" stroke="#55504b" stroke-width="5"/></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[2]}"/></linearGradient></defs><path fill="url(#a)" d="M0 0h${width}v${height}H0z"/><circle cx="${width * .73}" cy="${height * .3}" r="${height * .32}" fill="${colors[1]}" opacity=".55"/>${backdrop ? people : ''}<path d="M0 ${height * .8} ${width * .4} ${height * .63} ${width} ${height * .91}v${height}H0z" fill="${colors[0]}" opacity=".9"/>${!backdrop ? `<text x="${width / 2}" y="${height * .72}" fill="#f4ebd7" text-anchor="middle" font-family="Georgia" font-size="45">${media[index % media.length].title.replaceAll('&','&amp;')}</text>` : ''}</svg>`;
}
