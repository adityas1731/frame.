import {cleanFact} from './metadataPresentation';
import type { ReactNode } from 'react';
export interface DetailFact { label: string; value?: ReactNode }
/** Only supplied facts are presented as values; unavailable metadata is never invented. */
export function DetailFacts({ facts }: { facts: DetailFact[] }) {
  const available = facts.filter(f => f.value !== undefined && f.value !== null && f.value !== '' && cleanFact(f.label,f.value));
  const details = available.filter(f => !f.label.endsWith(' ID'));
  const providers = available.filter(f => f.label.endsWith(' ID'));
  const grid = (values: DetailFact[]) => <dl>{values.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>;
  return <section className="detail-facts" aria-label="Title information"><header><h2>Title Information</h2></header>{grid(details)}{providers.length > 0 && <details className="provider-identifiers"><summary>Provider IDs</summary>{grid(providers)}</details>}</section>;
}
