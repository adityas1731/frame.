import {Select} from './Select';
import {usePreview} from '../state/PreviewContext';
export function EpisodeCardSize(){const {preferences,setPreference}=usePreview();return <div className="episode-size-control"><span>Card Size</span><Select aria-label="Episode card size" value={preferences.episodeSize??'medium'} onValueChange={value=>setPreference('episodeSize',value as 'small'|'medium'|'large')}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></Select></div>;}
