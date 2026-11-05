import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const compareNames = ([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b));
function fingerprint(files) {
  return hash(Buffer.concat([...files].sort(compareNames).flatMap(([name, data]) =>
    [Buffer.from(name + '\0'), Buffer.from(hash(data) + '\n')])));
}

// A clean package describes committed bytes, not checkout-dependent line endings.
// Object IDs are sent to cat-file instead of paths, so unusual filenames cannot
// become commands or alter the batch protocol. Binary blobs remain unchanged.
export async function sourceFingerprint(repository, identity) {
  const git = args => execFileSync('git', args, {cwd: repository, maxBuffer: 128 * 1024 * 1024});
  if (identity.commit && !identity.dirty) {
    if (!/^[a-f0-9]{40}$/.test(identity.commit)) throw Error('Invalid fingerprint revision');
    const entries = git(['ls-tree', '-r', '-z', '--full-tree', identity.commit]).toString('utf8')
      .split('\0').filter(Boolean).map(record => {
        const split = record.indexOf('\t');
        const [mode, type, object] = record.slice(0, split).split(' ');
        if (split < 0 || type !== 'blob' || !/^[a-f0-9]{40}$/.test(object))
          throw Error('Unsupported source tree entry');
        return {name: record.slice(split + 1), object, mode};
      });
    const batch = execFileSync('git', ['cat-file', '--batch'], {
      cwd: repository, input: entries.map(entry => entry.object + '\n').join(''),
      maxBuffer: 128 * 1024 * 1024
    });
    let offset = 0;
    const files = new Map();
    for (const entry of entries) {
      const end = batch.indexOf(10, offset);
      if (end < 0) throw Error('Incomplete source blob header');
      const [object, type, length] = batch.subarray(offset, end).toString('ascii').split(' ');
      const size = Number(length);
      if (object !== entry.object || type !== 'blob' || !/^\d+$/.test(length ?? '') ||
          !Number.isSafeInteger(size) || end + size + 1 >= batch.length)
        throw Error('Invalid source blob response');
      offset = end + 1;
      files.set(entry.name, batch.subarray(offset, offset + size));
      offset += size;
      if (batch[offset++] !== 10) throw Error('Invalid source blob boundary');
    }
    if (offset !== batch.length) throw Error('Unexpected source blob data');
    return {value: fingerprint(files), scheme: 'git-blobs-sha256-v1', fileCount: files.size};
  }

  // Dirty development builds are explicitly labelled and cannot be approved as
  // releases. Keep their fingerprint sensitive to actual working-file changes.
  const names = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .toString('utf8').split('\0').filter(Boolean))];
  const files = new Map();
  for (const name of names) {
    if (name.startsWith('/') || name.split('/').includes('..')) throw Error('Unsafe source path');
    files.set(name, await readFile(path.join(repository, name)));
  }
  return {value: fingerprint(files), scheme: 'working-tree-sha256-v1', fileCount: files.size};
}
