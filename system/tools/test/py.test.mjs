// The interpreter this project runs Python on is a decision, not whatever PATH happens to
// resolve first. `pickPython` is that decision in one pure function, so both the npm scripts
// and start.mjs can make it identically and a test can state what it must be.
//
// Every case runs against BOTH platforms, on whichever machine the suite is on. The first
// version of this file spelled the Windows layout into its assertions and took the platform
// from the host, so all seven tests passed here and all seven failed on the Linux runner --
// three consecutive red pushes for a file that had never been run anywhere but Windows.
// `platform` is an argument to the resolver now, so the runner asserts the Windows branch and
// this machine asserts the POSIX one.
import { describe, expect, it } from 'vitest';

import { pickPython, py12Candidates } from '../py.mjs';

/** An `exists` stub: only the listed paths are on this imagined disk. */
const disk = (...present) => {
  const set = new Set(present.map((p) => p.toLowerCase()));
  return (p) => set.has(String(p).toLowerCase());
};

/**
 * One fixture per platform. Each names a directory and the interpreter that platform puts
 * inside it, so an assertion states the layout rather than recomputing it from the code it is
 * testing.
 */
const PLATFORMS = [
  {
    platform: 'win32',
    // The machine-wide location py12 is actually created at, on both machines of D-02.
    machineWide: {
      dir: 'C:\\Python\\pyVenv\\py12',
      python: 'C:\\Python\\pyVenv\\py12\\Scripts\\python.exe',
    },
    py12Home: { dir: 'D:\\envs\\py12', python: 'D:\\envs\\py12\\Scripts\\python.exe' },
    activated: { dir: 'E:\\somewhere\\py12', python: 'E:\\somewhere\\py12\\Scripts\\python.exe' },
    notPy12: {
      dir: 'C:\\Python\\pyVenv\\env11',
      python: 'C:\\Python\\pyVenv\\env11\\Scripts\\python.exe',
    },
    homeVar: 'USERPROFILE',
    home: { dir: 'C:\\Users\\someone', python: 'C:\\Users\\someone\\pyVenv\\py12\\Scripts\\python.exe' },
    override: 'D:\\other\\python.exe',
    fallback: 'python',
  },
  {
    platform: 'linux',
    machineWide: null, // there is none: see py12Candidates
    py12Home: { dir: '/opt/envs/py12', python: '/opt/envs/py12/bin/python' },
    activated: { dir: '/home/someone/work/py12', python: '/home/someone/work/py12/bin/python' },
    notPy12: {
      dir: '/home/someone/.virtualenvs/env11',
      python: '/home/someone/.virtualenvs/env11/bin/python',
    },
    homeVar: 'HOME',
    home: { dir: '/home/someone', python: '/home/someone/pyVenv/py12/bin/python' },
    override: '/usr/bin/python3.12',
    fallback: 'python3',
  },
];

describe.each(PLATFORMS)('pickPython on $platform', (p) => {
  const pick = (env, exists) => pickPython({ env, exists, platform: p.platform });

  it('honours SGS_PYTHON above everything else', () => {
    const got = pick({ SGS_PYTHON: p.override, PY12_HOME: p.py12Home.dir }, disk(p.py12Home.python));
    expect(got.python).toBe(p.override);
    expect(got.source).toBe('SGS_PYTHON');
    expect(got.warning).toBeNull();
  });

  it('takes py12 from PY12_HOME when it is set', () => {
    const got = pick({ PY12_HOME: p.py12Home.dir }, disk(p.py12Home.python));
    expect(got.python).toBe(p.py12Home.python);
    expect(got.source).toBe('py12');
    expect(got.warning).toBeNull();
  });

  it('uses an activated py12 before searching the known locations', () => {
    const got = pick(
      { VIRTUAL_ENV: p.activated.dir, PY12_HOME: p.py12Home.dir },
      disk(p.activated.python, p.py12Home.python),
    );
    expect(got.python).toBe(p.activated.python);
    expect(got.source).toBe('VIRTUAL_ENV');
  });

  it('ignores an activated environment that is not py12', () => {
    const got = pick(
      { VIRTUAL_ENV: p.notPy12.dir, PY12_HOME: p.py12Home.dir },
      disk(p.notPy12.python, p.py12Home.python),
    );
    expect(got.python).toBe(p.py12Home.python);
    expect(got.source).toBe('py12');
  });

  it('finds py12 under the home directory with no other environment help', () => {
    const got = pick({ [p.homeVar]: p.home.dir }, disk(p.home.python));
    expect(got.python).toBe(p.home.python);
    expect(got.source).toBe('py12');
  });

  it('falls back to the PATH name this platform uses, with a warning', () => {
    const got = pick({}, disk());
    expect(got.python).toBe(p.fallback);
    expect(got.source).toBe('fallback');
    expect(got.warning).toMatch(/py12/);
  });
});

describe.each(PLATFORMS)('py12Candidates on $platform', (p) => {
  const candidates = (env) => py12Candidates(env, { platform: p.platform });

  it('puts PY12_HOME first', () => {
    expect(candidates({ PY12_HOME: p.py12Home.dir })[0]).toBe(p.py12Home.python);
  });

  it('offers a per-user location', () => {
    expect(candidates({ [p.homeVar]: p.home.dir })).toContain(p.home.python);
  });

  it("spells every candidate in this platform's own layout", () => {
    const wrongSeparator = p.platform === 'win32' ? '/' : '\\';
    for (const candidate of candidates({ PY12_HOME: p.py12Home.dir, [p.homeVar]: p.home.dir })) {
      expect(candidate).not.toContain(wrongSeparator);
    }
  });
});

describe('the machine-wide locations', () => {
  it('are offered on Windows, where py12 is actually created', () => {
    const list = py12Candidates({}, { platform: 'win32' });
    expect(list).toContain('C:\\Python\\pyVenv\\py12\\Scripts\\python.exe');
  });

  // A drive-letter string joined POSIX-style is neither layout, so it could never match a file
  // and could not be asserted either. With nothing to offer, a POSIX host reaches the fallback,
  // which is why the CI workflow names its interpreter through SGS_PYTHON instead.
  it('are not offered on a POSIX host, which therefore reaches the fallback', () => {
    expect(py12Candidates({}, { platform: 'linux' })).toEqual([]);
    expect(pickPython({ env: {}, exists: () => false, platform: 'linux' }).source).toBe('fallback');
  });
});
