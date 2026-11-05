import type { Fetcher } from '../jellyfin/types';
/** Original synthetic TVmaze responses. Fictional identifiers never reach the public API. */
export function createOnlineFixture():Fetcher {return async(input)=>{
  const url=new URL(input);const match=url.pathname.match(/^\/(shows|episodes)\/(\d+)$/);
  const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
  const episodes=url.pathname.match(/^\/shows\/(\d+)\/episodes$/);
  if(episodes)return json(Array.from({length:6},(_,i)=>({id:990001001+i,season:1,number:i+1,name:['A new beginning','The quiet signal','A change of course','The long way back','A light in the distance','The next chapter'][i],summary:'<p>An original episode description for the Frame metadata preview.</p>',airdate:`2025-01-${String(10+i).padStart(2,'0')}`,runtime:30+i,rating:{average:8.2},image:{original:`https://static.tvmaze.com/uploads/images/original_untouched/1/${100+i}.jpg`,medium:`https://static.tvmaze.com/uploads/images/medium_landscape/1/${100+i}.jpg`},_links:{show:{href:`https://api.tvmaze.com/shows/${episodes[1]}`}}})));
  if(!match)return json({},404);
  const episode=match[1]==='episodes', id=Number(match[2]);
  return json({id,image:episode?{original:`https://static.tvmaze.com/uploads/images/original_untouched/1/${100+id-990001001}.jpg`}:undefined,name:episode?['A new beginning','The quiet signal','A change of course'][id-990001001]??'An original chapter':'An original series',summary:'<p>An original fictional description from the simulated free metadata provider.</p>',rating:{average:8.4},runtime:45,premiered:'2025-01-23',airdate:'2025-01-23',externals:{},_embedded:{[episode?'guestcast':'cast']:[{person:{name:'Robin Avery',image:{original:'https://static.tvmaze.com/uploads/images/original_untouched/1/1.jpg'}},character:{name:'The explorer'}}]}});
};}
export function fixtureImageUrl(url:string) {
  // A damaged original proves that the medium-image fallback renders without a user refresh.
  if(url.endsWith('/original_untouched/1/104.jpg'))return 'data:image/svg+xml,invalid-fixture-image';
  const episode=Number(url.match(/\/1\/(10[0-5])\.jpg$/)?.[1]);
  const portrait=url.includes('tvmaze')&&!episode;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${portrait?400:1280}" height="${portrait?600:720}" viewBox="0 0 1600 900"><defs><linearGradient id="a"><stop stop-color="#142e39"/><stop offset="1" stop-color="#858763"/></linearGradient></defs><path fill="url(#a)" d="M0 0h1600v900H0z"/><circle cx="${1200-(episode?episode-100:0)*75}" cy="230" r="190" fill="#e5cb9a"/><path fill="#244b52" d="M0 700 650 350 1600 800v100H0z"/><path fill="#102935" d="M0 800 1000 500 1600 750v150H0z"/><ellipse cx="1150" cy="400" rx="60" ry="85" fill="#ba9b79"/><path d="M1040 760q0-300 110-280t110 280" fill="#19262d"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

