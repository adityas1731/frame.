import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {root} from './frame-core.mjs';
import {sourceFingerprint} from './source-fingerprint.mjs';

test('clean source fingerprints use exact Git blobs across LF and CRLF checkouts', async () => {
  const fixtures = path.join(root, '.local', 'fingerprint-tests');
  await mkdir(fixtures, {recursive: true});
  const repo = await mkdtemp(path.join(fixtures, 'source-'));
  const git = args => execFileSync('git', args, {cwd: repo, encoding: 'utf8'}).trim();
  git(['init', '-q']);
  git(['config', 'user.name', 'Fixture']);
  git(['config', 'user.email', 'fixture@local.invalid']);
  await writeFile(path.join(repo, '.gitattributes'), '* text=auto eol=lf\n*.bin binary\n');
  await writeFile(path.join(repo, '.gitignore'), 'ignored.txt\n');
  await writeFile(path.join(repo, 'text.txt'), 'first\nsecond\n');
  await writeFile(path.join(repo, 'unicode-é.txt'), 'name\n');
  await writeFile(path.join(repo, 'binary.bin'), Buffer.from([0, 13, 10, 255, 10]));
  git(['add', '.']); git(['commit', '-qm', 'fixture']);
  const commit = git(['rev-parse', 'HEAD']);
  const before = await sourceFingerprint(repo, {commit, dirty: false});
  const rawBefore = await sourceFingerprint(repo, {commit, dirty: true});
  await writeFile(path.join(repo, 'text.txt'), 'first\r\nsecond\r\n');
  await writeFile(path.join(repo, 'ignored.txt'), 'not part of source');
  git(['diff', '--exit-code']);
  git(['add', 'text.txt']); // Refresh stat/index normalization without changing the committed content.
  assert.equal(git(['status', '--porcelain']), '');
  assert.deepEqual(await sourceFingerprint(repo, {commit, dirty: false}), before);
  assert.notEqual((await sourceFingerprint(repo, {commit, dirty: true})).value, rawBefore.value,
    'the former raw-working-file approach changes with checkout line endings');
  assert.equal(before.scheme, 'git-blobs-sha256-v1');
  assert.equal(before.fileCount, 5);
  await writeFile(path.join(repo, 'text.txt'), 'changed\n');
  const dirty = await sourceFingerprint(repo, {commit, dirty: true});
  assert.equal(dirty.scheme, 'working-tree-sha256-v1');
  assert.notEqual(dirty.value, before.value);
  git(['add', '.']); git(['commit', '-qm', 'changed text']);
  const changed = await sourceFingerprint(repo, {commit: git(['rev-parse', 'HEAD']), dirty: false});
  assert.notEqual(changed.value, before.value);
  await writeFile(path.join(repo, 'binary.bin'), Buffer.from([0, 10, 255, 10]));
  git(['add', '.']); git(['commit', '-qm', 'changed binary']);
  assert.notEqual((await sourceFingerprint(repo, {commit: git(['rev-parse', 'HEAD']), dirty: false})).value, changed.value);
  await assert.rejects(sourceFingerprint(repo, {commit: 'HEAD;invalid', dirty: false}), /Invalid fingerprint revision/);
});
