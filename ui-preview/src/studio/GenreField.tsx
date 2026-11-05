import {useTitleTags} from '../state/TitleTags';

import {tagSelection,selectedTag} from '../state/tagSelection';

import {independentGenreChoices} from '../providers/genres';

import {Field} from '../components/SettingsSection';

import {SettingsSelect} from '../components/Select';

import {useConnection} from '../jellyfin/useConnection';

import {useRemote} from '../jellyfin/hooks';

import {media} from '../data/media';



/** Discover all scoped genres, rather than guessing from the first page of titles. */

export function GenreField({value,onChange,library='',mediaType='all'}:{value:string;onChange:(value:string)=>void;library?:string;mediaType?:'all'|'Movie'|'Series'}){

 const {session,client}=useConnection();const {tags}=useTitleTags();

 const customTags=[...new Map(Object.values(tags).flat().map(name=>[name.toLocaleLowerCase(),name])).values()].sort((a,b)=>a.localeCompare(b));

 const result=useRemote(`studio-genres:${library}:${mediaType}`,()=>session?client!.genres(session.user.Id,library,mediaType==='all'?undefined:mediaType):Promise.resolve([...new Set(media.filter(item=>mediaType==='all'||item.kind===(mediaType==='Movie'?'movie':'show')).flatMap(item=>item.genres))].sort()),false);

 const genres=independentGenreChoices(result.data??[]);const unavailable=!!value&&!genres.includes(value)&&!customTags.some(name=>tagSelection(name)===value);

 return <div className="genre-setting"><Field label="Genre" hint="Choose a library genre or one of your custom tags."><SettingsSelect value={value} disabled={(result.loading||!!result.error)&&!customTags.length} onValueChange={onChange} aria-label="Section Genre"><option value="">{result.loading?'Loading Genres…':result.error?'Genres Unavailable':genres.length||customTags.length?'Choose A Genre Or Tag':'No Genres Available'}</option>{unavailable&&<option value={value} disabled>{selectedTag(value)??value} · Choose A Genre Or Tag</option>}{customTags.map(name=><option key={tagSelection(name)} value={tagSelection(name)}>Custom Tag · {name}</option>)}{genres.map(genre=><option key={genre} value={genre}>{genre}</option>)}</SettingsSelect></Field>{result.error&&<p role="alert">Genres could not load. <button type="button" className="text-link" onClick={result.retry}>Retry</button></p>}{unavailable&&!result.loading&&!result.error&&<p className="studio-footnote">Choose an available genre or custom tag.</p>}</div>;

}

