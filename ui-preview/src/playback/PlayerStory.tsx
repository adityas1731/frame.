import type {ReactNode} from 'react';
/** Shared title/context hierarchy for idle playback and the pre-play resume choice. */
export function PlayerStory({title,context,metadata,description,children}:{title:string;context?:string;metadata?:string;description?:string|null;children?:ReactNode}){
 return <div className="pause-screen-copy">{context&&<p className="pause-screen-series">{context}</p>}<h2>{title}</h2>{metadata&&<p className="pause-screen-meta">{metadata}</p>}{description?.trim()&&<p className="pause-screen-description">{description.trim()}</p>}{children}</div>;
}
