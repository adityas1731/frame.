import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCatalog, packageUrl} from './catalog.mjs';
import {config} from './frame-core.mjs';

const bytes = Buffer.from('test package');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const expected = {version: config.version, sha256, sourceCommit: 'a'.repeat(40)};
const manifest = {format: 'frame-release-v1', status: 'verified', profile: 'release', internal: false,
  ...expected, sourceDirty: false, targetAbi: config.jellyfinAbi,
  fileName: `frame-jellyfin-${config.version}-release-${sha256.slice(0,12)}.zip`,
  builtAt: '2026-11-04T13:55:03.605Z', tests: {passed: true, failed: 0}};
const url = 'https://catalog.example.test/' + manifest.fileName;

test('catalog keeps plugin identity, ABI, exact URL and Jellyfin MD5', () => {
  const [catalog] = createCatalog(manifest, bytes, url, expected);
  assert.equal(catalog.guid, '1c38ef02-2393-4f54-a18b-fcfcbf394d65');
  assert.equal(catalog.name, 'Frame');
  assert.equal(catalog.versions[0].targetAbi, config.jellyfinAbi);
  assert.equal(catalog.versions[0].sourceUrl, url);
  assert.equal(catalog.versions[0].checksum, createHash('md5').update(bytes).digest('hex'));
});
test('tampered ZIP is rejected', () => assert.throws(() => createCatalog(manifest, Buffer.from('changed'), url, expected), /SHA-256/));
test('wrong approved commit is rejected', () => assert.throws(() => createCatalog(manifest, bytes, url, {...expected, sourceCommit: 'b'.repeat(40)})));
test('diagnostics, dirty and superseded packages are rejected', () => {
  for (const patch of [{profile: 'diagnostics'}, {sourceDirty: true}, {superseded: true}])
    assert.throws(() => createCatalog({...manifest, ...patch}, bytes, url, expected));
});
test('credential-bearing, non-HTTP and mismatched URLs are rejected', () => {
  for (const bad of ['file:///package.zip', 'https://user:pass@host/' + manifest.fileName,
    url + '?token=secret', url + '#fragment', 'https://host/wrong.zip', 'not a URL'])
    assert.throws(() => packageUrl(bad, manifest.fileName));
});
test('explicit LAN path and BaseUrl are preserved', () => {
  const lan = 'http://192.168.1.20:8088/private/catalog/' + manifest.fileName;
  assert.equal(packageUrl(lan, manifest.fileName), lan);
});
test('invalid release date is rejected', () => assert.throws(() => createCatalog({...manifest, builtAt: 'unknown'}, bytes, url, expected)));
