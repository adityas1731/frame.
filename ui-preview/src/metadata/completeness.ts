/** Original, transport-independent model. Coverage must come from the future adapter. */
export type FieldState = 'present' | 'missing' | 'unknown' | 'error' | 'not-applicable';
export type MetadataField = 'title' | 'overview' | 'poster' | 'backdrop' | 'year' | 'rating' | 'genres' | 'cast' | 'runtime' | 'providerIds' | 'season' | 'episode';
export interface MetadataSnapshot {
  kind: 'movie' | 'series' | 'season' | 'episode';
  values: Partial<Record<MetadataField, unknown>>;
  /** Only fields authoritatively resolved by a successful, supported request. */
  resolved: MetadataField[];
  failed?: MetadataField[];
  identity: 'unverified' | 'confirmed' | 'needs-review';
}
export const fieldLabels: Record<MetadataField, string> = {
  title: 'Title', overview: 'Description', poster: 'Poster', backdrop: 'Backdrop', year: 'Release year',
  rating: 'Audience rating', genres: 'Genres', cast: 'Cast', runtime: 'Runtime', providerIds: 'Provider IDs', season: 'Season number', episode: 'Episode number',
};
export const metadataFields = Object.keys(fieldLabels) as MetadataField[];
function meaningful(field: MetadataField, value: unknown): boolean {
  if (['year', 'runtime', 'rating', 'season', 'episode'].includes(field)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (field === 'rating') return value >= 0 && value <= 10;
    if (field === 'season' || field === 'episode') return Number.isInteger(value) && value >= 0;
    return field === 'year' ? Number.isInteger(value) && value > 0 : value > 0;
  }
  if (field === 'genres' || field === 'cast') return Array.isArray(value) && value.some(v => typeof v === 'string' && v.trim().length > 0);
  if (field === 'providerIds') return !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).some(v => typeof v === 'string' && v.trim().length > 0);
  return typeof value === 'string' && value.trim().length > 0;
}
export function assessMetadata(snapshot: MetadataSnapshot) {
  const fields = metadataFields.map(field => {
    let state: FieldState;
    if ((field === 'episode' && snapshot.kind !== 'episode') || (field === 'season' && !['episode','season'].includes(snapshot.kind))) state = 'not-applicable';
    else if (snapshot.failed?.includes(field)) state = 'error';
    else if (!snapshot.resolved.includes(field)) state = 'unknown';
    else state = meaningful(field, snapshot.values[field]) ? 'present' : 'missing';
    return { field, label: fieldLabels[field], state };
  });
  const count = (state: FieldState) => fields.filter(f => f.state === state).length;
  return { fields, present: count('present'), missing: count('missing'), unknown: count('unknown'), errors: count('error'), identity: snapshot.identity };
}
