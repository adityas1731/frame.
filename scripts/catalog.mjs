/** Prepare catalog files locally. Never hosts, uploads or installs anything. */
import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateRelease} from './frame-core.mjs';

export function packageUrl(value, fileName) {
  let url;
  try { url = new URL(value); } catch { throw Error('Enter an absolute HTTP(S) ZIP URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw Error('ZIP URL must use HTTP(S) without credentials, queries or fragments');
  if (decodeURIComponent(url.pathname.split('/').at(-1)) !== fileName)
    throw Error('ZIP URL must end with the exact release filename');
  return url.href;
}

export function createCatalog(manifest, bytes, sourceUrl, expected) {
  validateRelease(manifest, expected);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== manifest.sha256) throw Error('ZIP SHA-256 mismatch');
  const url = packageUrl(sourceUrl, manifest.fileName);
  if (!Number.isFinite(Date.parse(manifest.builtAt))) throw Error('Missing release timestamp');
  return [{
    category: 'General', guid: '1c38ef02-2393-4f54-a18b-fcfcbf394d65',
    name: 'Frame', owner: 'Frame project',
    overview: 'frame. cinema client at /Frame/Web/',
    description: 'Customizable Jellyfin browser client. Keeps original Jellyfin Web intact. Sign in normally at /Frame/Web/.',
    versions: [{version: manifest.version, targetAbi: manifest.targetAbi,
      changelog: `frame. ${manifest.version}. See the reviewed release notes and verification receipt.`,
      timestamp: new Date(manifest.builtAt).toISOString(), sourceUrl: url,
      // Jellyfin uses MD5 for catalog download integrity. SHA-256 remains our release approval identity.
      checksum: createHash('md5').update(bytes).digest('hex')}]
  }];
}

async function main() {
  const [manifestPath, sourceUrl, output, expectedSha, expectedCommit] = process.argv.slice(2);
  if (!manifestPath || !sourceUrl || !output || !expectedSha || !expectedCommit)
    throw Error('Usage: node scripts/catalog.mjs <release.manifest.json> <exact ZIP URL> <new output directory> <approved SHA-256> <approved commit>');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const archive = path.join(path.dirname(path.resolve(manifestPath)), manifest.fileName);
  const bytes = await readFile(archive);
  const catalog = createCatalog(manifest, bytes, sourceUrl,
    {version: manifest.version, sha256: expectedSha, sourceCommit: expectedCommit});
  const destination = path.resolve(output);
  // A new directory prevents silently replacing an earlier catalog or approved package.
  await mkdir(destination);
  await copyFile(archive, path.join(destination, manifest.fileName));
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(catalog, null, 2) + '\n', {flag: 'wx'});
  await writeFile(path.join(destination, 'catalog-receipt.json'), JSON.stringify({
    version: manifest.version, sourceCommit: manifest.sourceCommit, sha256: expectedSha,
    catalogChecksumAlgorithm: 'MD5', checksum: catalog[0].versions[0].checksum,
    sourceUrl: catalog[0].versions[0].sourceUrl,
    hostingVerified: false, catalogInstallTested: false,
    note: 'Local preparation only. Verify download bytes from the Jellyfin server before adding the repository.'
  }, null, 2) + '\n', {flag: 'wx'});
  console.log('Prepared catalog, unchanged ZIP and receipt. Hosting and catalog installation remain unverified.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
