import { useId } from 'react';
import type { MediaItem } from '../data/media';

/** Original procedural SVG illustrations. No downloaded or extracted imagery. */
export function Artwork({ item, className = '' }: { item: MediaItem; className?: string }) {
  const id = useId().replace(/:/g, '');
  const [dark, mid, light] = item.colors;
  return <svg className={`artwork ${className}`} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-sky`} x2=".3" y2="1">
<stop stopColor={dark}/>
<stop offset="1" stopColor={mid}/>
</linearGradient>
      <linearGradient id={`${id}-earth`} x2="0" y2="1">
<stop stopColor={mid}/>
<stop offset="1" stopColor={dark}/>
</linearGradient>
      <radialGradient id={`${id}-halo`}>
<stop stopColor={light} stopOpacity=".32"/>
<stop offset="1" stopColor={light} stopOpacity="0"/>
</radialGradient>
      <linearGradient id={`${id}-planet`} x1="0" x2="1" y2=".7">
<stop stopColor={light}/>
<stop offset=".5" stopColor={mid}/>
<stop offset="1" stopColor={dark}/>
</linearGradient>
      <filter id={`${id}-grain`}>
<feTurbulence type="fractalNoise" baseFrequency=".63" numOctaves="3" stitchTiles="stitch"/>
<feColorMatrix type="saturate" values="0"/>
<feComponentTransfer>
<feFuncA type="linear" slope=".09"/>
</feComponentTransfer>
<feBlend in="SourceGraphic" mode="soft-light"/>
</filter>
    </defs>
    <g filter={`url(#${id}-grain)`}>
      <path fill={`url(#${id}-sky)`} d="M0 0h1200v800H0z"/>
      <ellipse cx="810" cy="310" rx="470" ry="400" fill={`url(#${id}-halo)`}/>
      {['orbit', 'moon'].includes(item.art) && <>
        {Array.from({ length: 54 }, (_, i) => <circle key={i} cx={(i * 193 + 71) % 1200} cy={(i * 79 + 32) % 440} r={i % 5 === 0 ? 1.5 : .8} fill={light} opacity={.2 + (i % 4) * .15}/>)}
        <circle cx="825" cy={item.art === 'moon' ? 265 : 250} r={item.art === 'moon' ? 145 : 186} fill={`url(#${id}-planet)`}/>
        {item.art === 'orbit' && <ellipse cx="825" cy="250" rx="280" ry="33" transform="rotate(-26 825 250)" fill="none" stroke={light} strokeWidth="1.5" opacity=".4"/>}
        <path d="M0 590 170 544 290 572 475 496 590 525 760 460 950 545 1200 470V800H0Z" fill={dark} opacity=".8"/>
        <path d="M0 681Q220 570 500 642T1200 560V800H0Z" fill={`url(#${id}-earth)`}/>
        <path d="M0 741Q400 620 740 717T1200 653V800H0Z" fill={dark} opacity=".6"/>
        <path d="m829 650 3-26 5-6 5 6 3 26m-8-25v-9" stroke="#e5dfd2" strokeWidth="3" fill="none"/>
      </>}
      {item.art === 'mountain' && <>
        <circle cx="840" cy="238" r="66" fill={light} opacity=".7"/>
        <path d="m0 570 220-320 175 170 210-325 245 300 170-155 180 320v240H0Z" fill={mid}/>
        <path d="m360 401 35 19 210-325 245 300-245-190-88 83-32-20-69 116Z" fill={light} opacity=".7"/>
        <path d="m0 690 280-280 210 220 230-210 180 180 300-169v369H0Z" fill={dark}/>
        <path d="m450 800 245-282 58 27-219 255Z" fill={light} opacity=".14"/>
        {Array.from({ length: 17 }, (_, i) => <path key={i} d={`m${i * 87} 800 32-${110 + i % 3 * 30} 32 ${110 + i % 3 * 30}`} fill={dark}/>)}
      </>}
      {item.art === 'coast' && <>
        <circle cx="790" cy="220" r="94" fill={light} opacity=".75"/>
        <path d="M0 430h1200v370H0z" fill={dark} opacity=".5"/>
        {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M${i % 2 * -100} ${462 + i * 22}q190 -18 350 0t350 0t650 0`} stroke={light} strokeWidth={i % 4 === 0 ? 2 : 1} fill="none" opacity={.09 + i % 3 * .06}/>)}
        <path d="M800 800 765 640 865 537 1050 554 1200 490V800Z" fill={dark}/>
        <path d="m927 548 12-206h36l12 206Z" fill={light}/>
<path d="M932 339h49v-31h-49z" fill={dark}/>
<path d="m927 305 29-23 30 23Z" fill={light}/>
        <path d="M948 320 370 232v170Z" fill={light} opacity=".08"/>
      </>}
      {item.art === 'desert' && <>
        <circle cx="816" cy="220" r="87" fill={light} opacity=".8"/>
        <path d="m0 540 210-30 95-204 105 3 38 221 197 56 137-246 103-10 90 202 225 23V800H0Z" fill={dark} opacity=".7"/>
        <path d="M0 675q290-240 611-88t589-10v223H0Z" fill={mid}/>
        <path d="M0 717q360-145 645 6t555-66v143H0Z" fill={dark} opacity=".65"/>
        <path d="M754 620q-29 45-54 77" stroke={light} strokeWidth="2" opacity=".35"/>
      </>}
      {item.art === 'forest' && <>
        <circle cx="730" cy="250" r="110" fill={light} opacity=".45"/>
        {[0, 1, 2].map(layer => <g key={layer} opacity={.28 + layer * .25}>{Array.from({ length: 14 }, (_, i) => { const x = i * 105 - layer * 30; const top = 230 + ((i * 97 + layer * 43) % 200); return <path key={i} d={`m${x} 800v-${800 - top}m-82 195 82-165 82 165m-105-75-82 174h210l-66-108m-116 122-75 142h290l-85-153`} fill={dark} stroke={dark} strokeWidth={8 + layer * 4}/>; })}</g>)}
        <path d="M0 759q430-90 1200-12v53H0Z" fill={dark}/>
      </>}
      {item.art === 'city' && <>
        <circle cx="823" cy="210" r="100" fill={light} opacity=".35"/>
        {Array.from({ length: 16 }, (_, i) => { const x = i * 85; const h = 190 + i * 73 % 310; return <g key={i}>
<path d={`M${x} ${800 - h}h75v${h}h-75z`} fill={dark}/>{Array.from({ length: 7 }, (_, j) => <path key={j} d={`M${x + 16} ${820 - h + j * 32}h8v11h-8m29 0h8v-11h-8`} fill={light} opacity={(i + j) % 3 === 0 ? .8 : .12}/>)}</g>; })}
        <path d="M555 800 700 390h55l190 410Z" fill={mid} opacity=".6"/>
<path d="m725 800 2-350" stroke={light} opacity=".6" strokeWidth="3" strokeDasharray="35 50"/>
        {Array.from({ length: 30 }, (_, i) => <path key={i} d={`m${i * 43} ${i * 83 % 700} -18 100`} stroke={light} opacity=".12"/>)}
      </>}
      {item.art === 'garden' && <>
        <circle cx="800" cy="200" r="120" fill={light} opacity=".6"/>
        <path d="M650 800V380a150 150 0 0 1 300 0v420" fill={dark}/>
<path d="M680 800V390a120 120 0 0 1 240 0v410" fill={mid}/>
        <path d="M795 800V260m-110 240h225" stroke={dark} strokeWidth="6"/>
        {Array.from({ length: 12 }, (_, i) => <g key={i} transform={`translate(${i * 105} ${570 + i % 3 * 65}) rotate(${i % 2 ? 17 : -18})`}>
<path d="M0 240Q55 50 0-130" stroke={dark} strokeWidth="8" fill="none"/>
<ellipse cx="-20" cy="10" rx="22" ry="65" transform="rotate(-40)" fill={dark}/>
<ellipse cx="25" cy="80" rx="24" ry="72" transform="rotate(35)" fill={dark}/>
</g>)}
      </>}
      <path d="M0 0h1200v800H0z" fill="none" stroke={light} strokeOpacity=".08" strokeWidth="2"/>
    </g>
  </svg>;
}
