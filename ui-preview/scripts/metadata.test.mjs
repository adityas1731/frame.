import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessMetadata, metadataFields } from '../src/metadata/completeness.ts';
const base = { kind: 'movie', values: {}, resolved: [], identity: 'unverified' };
test('omitted projections remain unknown, not missing', () => {
  const result = assessMetadata({ ...base, values: { title: 'A story' }, resolved: ['title'] });
  assert.equal(result.missing, 0); assert.equal(result.unknown, 9); assert.equal(result.present, 1);
});
test('authoritative empty fields are absent; nonapplicable episode fields are excluded', () => {
  const result = assessMetadata({ ...base, resolved: metadataFields });
  assert.equal(result.missing, 10); assert.equal(result.fields.find(f => f.field === 'season').state, 'not-applicable');
});
test('zero rating and season zero are valid; NaN, negative runtime and blank IDs are absent', () => {
  const result = assessMetadata({ ...base, kind: 'episode', resolved: metadataFields, values: { rating: 0, season: 0, episode: 1, year: NaN, runtime: -1, providerIds: { Tmdb: ' ' } } });
  for (const field of ['rating', 'season', 'episode']) assert.equal(result.fields.find(f => f.field === field).state, 'present');
  for (const field of ['year', 'runtime', 'providerIds']) assert.equal(result.fields.find(f => f.field === field).state, 'missing');
});
test('failed requests are errors, and identity review is independent of completeness', () => {
  const result = assessMetadata({ ...base, resolved: ['title'], values: { title: 'Wrong film' }, failed: ['poster'], identity: 'needs-review' });
  assert.equal(result.errors, 1); assert.equal(result.missing, 0); assert.equal(result.identity, 'needs-review');
});
