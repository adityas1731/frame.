import {useSyncExternalStore} from 'react';
import {Link,useNavigate} from 'react-router';
import {DiagnosticsPanel} from '../playback/DiagnosticsPanel';
import {clearDiagnostics,latestDiagnostics,subscribeDiagnostics} from '../playback/diagnostics';
export default function DiagnosticsPage(){
 const events=useSyncExternalStore(subscribeDiagnostics,latestDiagnostics);const navigate=useNavigate();
 const last=(key:string)=>[...events].reverse().find(e=>e.facts[key]!==undefined)?.facts[key];
 const width=last('width'),height=last('height');
 return <div className="content-page diagnostics-page"><header className="page-heading"><Link className="text-link" to="/settings">Settings / Advanced</Link><h1>Diagnostics</h1><p>Internal build · sanitized playback history held only in this tab’s memory.</p></header>
 <div className="studio-actions"><button className="button secondary" onClick={clearDiagnostics} disabled={!events.length}>Clear diagnostic history</button></div>
 {!events.length&&<p className="studio-footnote">No playback recorded yet. Play a title, then return here to inspect its negotiation and session cleanup.</p>}
 <dl className="diagnostics-summary">{Object.entries({'Last stage':events.at(-1)?.stage??'Waiting','Streaming mode':last('mode')??'Not negotiated','Source resolution':width&&height?`${width} × ${height}`:'Not reported','Video codec':last('videoCodec')??'Not reported','Audio codec':last('audioCodec')??'Not reported','HLS engine':last('mseHls')===true?'Available':last('mseHls')===false?'Unavailable':'Not probed','Media authorization':last('authorized')===true?'Granted':'Not reported','HTTP status':last('status')??'Not reported'}).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>
 <DiagnosticsPanel events={events} close={()=>navigate('/settings')}/></div>;
}
