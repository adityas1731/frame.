import './diagnostics.css';
import {useState} from 'react';
import {diagnosticReport,type DiagnosticEvent} from './diagnostics';
export function DiagnosticsPanel({events,close}:{events:readonly DiagnosticEvent[];close:()=>void}){
 const [message,setMessage]=useState('');
 const report=diagnosticReport(events);
 const latest=events.at(-1);
 async function copy(){try{await navigator.clipboard.writeText(report);setMessage('Report copied.');}catch{setMessage('Clipboard unavailable. Select and copy the report below.');}}
 function download(){const url=URL.createObjectURL(new Blob([report],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='frame-playback-diagnostics.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Report downloaded.');}
 return <section className="diagnostics-panel" aria-label="Playback diagnostics" onKeyDown={e=>e.stopPropagation()}>
  <header><h2>Playback Diagnostics</h2><button className="button secondary" onClick={close}>Close</button></header>
  <p>Last stage: <strong>{latest?.stage??'Waiting for player'}</strong>. Logs stay in memory. No tokens, URLs, titles or account identifiers are collected.</p>
  <p>Copy this report when reporting a problem. HTTP 401 indicates an expired session; 403 can indicate denied access; 5xx indicates a server or streaming bridge failure. Status 0 cannot distinguish network, TLS and CORS failures.</p>
  <div className="diagnostic-actions"><button className="button primary" onClick={()=>void copy()}>Copy diagnostic report</button><button className="button secondary" onClick={download}>Download report</button></div>
  <p role="status">{message}</p>
  <ol>{events.map((event,index)=><li key={index}><span>+{(event.elapsedMs/1000).toFixed(2)}s</span> <strong>{event.stage}</strong><code>{Object.entries(event.facts).map(([key,value])=>`${key}: ${value}`).join(' · ')}</code></li>)}</ol>
  <details><summary>Raw report · select to copy manually</summary><textarea readOnly aria-label="Diagnostic report" value={report}/></details>
 </section>;
}
