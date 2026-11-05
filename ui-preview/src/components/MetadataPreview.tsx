import {Select} from './Select';
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { MediaItem } from '../data/media';
import { assessMetadata, metadataFields, type MetadataSnapshot } from '../metadata/completeness';

/** Local demonstrations only: never diagnostic evidence about a Jellyfin server. */
export function MetadataPreview({ item }: { item: MediaItem }) {
  const [scenario, setScenario] = useState('complete');
  const snapshot: MetadataSnapshot = {
    kind: item.kind === 'show' ? 'series' : 'movie',
    values: { title: item.title, overview: item.overview, poster: 'original-demo-art', backdrop: 'original-demo-art', year: item.year, rating: item.score, genres: item.genres, cast: item.cast, runtime: item.runtime, providerIds: { Demo: item.id } },
    resolved: scenario === 'projection' ? ['title', 'year'] : metadataFields,
    identity: scenario === 'identity' ? 'needs-review' : 'unverified',
  };
  if (scenario === 'incomplete') Object.assign(snapshot.values, { poster: null, backdrop: null, overview: '', rating: null, cast: [] });
  if (scenario === 'error') snapshot.failed = ['cast', 'poster'];
  const result = assessMetadata(snapshot);
  return <section className="metadata-preview" aria-labelledby="metadata-preview-heading">
    <h3 id="metadata-preview-heading">Metadata Coverage · Mock Demo</h3>
    <p>Coverage describes available fields, not whether this is the right film. No server checks or changes are made.</p>
    <Select className="select-control" aria-label="Metadata demo scenario" value={scenario} onValueChange={value=> setScenario(value)}>
      <option value="complete">All sample fields available</option>
      <option value="projection">Fields not requested yet</option>
      <option value="incomplete">Incomplete server details (simulated)</option>
      <option value="error">Loading failed (simulated)</option>
      <option value="identity">Identification needs review (simulated)</option>
    </Select>
    <p role="status">{result.present} available · {result.missing} absent · {result.unknown} not loaded · {result.errors} failed</p>
    <p className="muted">Identity: {result.identity === 'needs-review' ? 'needs review — never automatically accepted' : 'unverified — completeness is not proof of identity'}</p>
    <ul className="metadata-fields">{result.fields.filter(f => f.state !== 'not-applicable').map(f => <li key={f.field}>{f.label}: {f.state === 'unknown' ? 'not loaded' : f.state === 'missing' ? 'not provided' : f.state === 'error' ? 'could not load' : 'available'}</li>)}</ul>
    {scenario === 'incomplete' && <div className="metadata-fallback"><ImageOff size={28} aria-hidden="true"/><div><strong>{item.title}</strong><p>No poster available. Description and cast haven’t been provided.</p></div></div>}
    <p className="muted">Refresh and identification controls are reserved for a future authorized administrator workflow.</p>
  </section>;
}
