import {readFile} from 'node:fs/promises';
import {verifyArchive} from './artifact-core.mjs';
const [file,profile='release',sha]=process.argv.slice(2);if(!file)throw Error('Usage: node scripts/verify-artifact.mjs <archive> [release|diagnostics] [approved SHA256]');
console.log(JSON.stringify(verifyArchive(await readFile(file),profile,sha),null,2));
