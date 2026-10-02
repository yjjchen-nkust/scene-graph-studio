// The CI fixture, fixtures/data: which files it holds, whether they still equal the NAS's, and
// copying the NAS's over them (D125).
//
//   node tools/fixture.mjs            list every fixture file that differs from data/, exit 1 if any
//   node tools/fixture.mjs --refresh  copy data/'s version of every fixture file into the fixture
//
// The fixture holds a fixed set of files, the ones `npm run ci` reads; refreshing never adds one.
// A file the gate comes to need is copied in by hand, and the drift test then holds it.
import { copyFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FIXTURE = resolve(import.meta.dirname, '../../fixtures/data');

/** Every file of the fixture, as a path relative to it with forward slashes, sorted. */
export function fixtureFiles(root = FIXTURE) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else out.push(relative(root, path).split('\\').join('/'));
    }
  };
  walk(root);
  return out.sort();
}

/** The fixture files whose bytes differ from `dataDir`'s file of the same path, or that it lacks. */
export function driftFrom(dataDir, root = FIXTURE) {
  return fixtureFiles(root).filter((file) => {
    const source = join(dataDir, file);
    try {
      if (!statSync(source).isFile()) return true;
    } catch {
      return true;
    }
    return !readFileSync(source).equals(readFileSync(join(root, file)));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const data = resolve(import.meta.dirname, '../../data');
  const drift = driftFrom(data);
  if (process.argv.includes('--refresh')) {
    for (const file of drift) copyFileSync(join(data, file), join(FIXTURE, file));
    process.stdout.write(`fixture: ${drift.length} file(s) refreshed from data/\n`);
  } else {
    for (const file of drift) process.stdout.write(`differs from data/: ${file}\n`);
    process.stdout.write(`fixture: ${fixtureFiles().length} files, ${drift.length} differ from data/\n`);
    process.exitCode = drift.length > 0 ? 1 : 0;
  }
}
