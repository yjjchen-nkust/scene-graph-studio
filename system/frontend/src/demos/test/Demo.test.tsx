import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { isValidElement, useContext, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getModule, moduleIds } from '../../content/registry';
import { setLocale } from '../../i18n/useLocale';
import { PartContext } from '../../playgrounds/controls';
import { Demo } from '../Demo';
import { DEMO_ARTEFACTS, DEMO_PARTS, type DemoProps } from '../mounts';

/** Reports what `Demo` handed it, so the mounting is tested apart from any real part. */
function Probe({ part }: DemoProps) {
  const context = useContext(PartContext);
  return <output data-testid="probe">{`${typeof part}:${part}:${context}`}</output>;
}

// DT and DV are registered by Tasks 8 and 9; the table is replaced here so that mounting is
// tested now, and still tested apart from them afterwards. DEMO_PARTS stays the real one.
vi.mock('../mounts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../mounts')>()),
  DEMO_MOUNTS: { DT: Probe },
}));

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

beforeEach(() => setLocale('en'));

describe('Demo', () => {
  it('names the demo it cannot mount, rather than rendering nothing', () => {
    render(<Demo id="DX" part="1" />);
    expect(screen.getByTestId('demo-unknown')).toHaveTextContent(
      'No demonstration is registered under this id: DX part 1',
    );
  });

  it('names a part the demo does not have, rather than guessing one', () => {
    const beyond = render(<Demo id="DT" part="9" />);
    expect(screen.getByTestId('demo-unknown')).toHaveTextContent('This demonstration has no such part: DT part 9');
    beyond.unmount();
    for (const part of ['0', '1.5', 'abc', undefined]) {
      const { unmount } = render(<Demo id="DT" part={part} />);
      expect(screen.getByTestId('demo-unknown'), String(part)).toHaveTextContent('This demonstration has no such part');
      unmount();
    }
  });

  it('mounts a registered demo with its part, as a number, and the part in context', () => {
    render(<Demo id="DT" part="4" />);
    expect(screen.queryByTestId('demo-unknown')).toBeNull();
    expect(screen.getByTestId('probe')).toHaveTextContent('number:4:4');
  });

  it('registers D-T in four parts and D-V in five, each with its recorded artefact', () => {
    expect(DEMO_PARTS).toEqual({ DT: 4, DV: 5 });
    expect(DEMO_ARTEFACTS).toEqual({ DT: 'demos/m0/traditional.json', DV: 'demos/m0/indvissgg.json' });
  });

  it('writes each table one entry to a line, as the content lint reads it', () => {
    // content_lint.mjs reads mounts.tsx as text (Task 7), by this pattern.
    const text = source('../mounts.tsx');
    const table = (name: string) => {
      const body = new RegExp(`export const ${name}[^{]*\\{([^}]*)\\}`).exec(text)?.[1] ?? '';
      return Object.fromEntries(
        [...body.matchAll(/^\s{2}([A-Z]{2}):\s*([^,\n]+)/gm)].map((m) => [m[1], m[2]!.replace(/['"]/g, '').trim()]),
      );
    };
    expect(table('DEMO_PARTS')).toEqual({ DT: '4', DV: '5' });
    expect(table('DEMO_ARTEFACTS')).toEqual(DEMO_ARTEFACTS);
  });

  it('is supplied to every module body through components, so no MDX file imports it', () => {
    for (const id of moduleIds()) {
      for (const locale of ['en', 'zh-TW'] as const) {
        for (const step of getModule(id, locale)!) {
          const node = step.node as ReactElement<{ components: Record<string, unknown> }>;
          expect(isValidElement(node), `${id}.${locale} ${step.id}`).toBe(true);
          expect(node.props.components.Demo, `${id}.${locale} ${step.id}`).toBe(Demo);
        }
        expect(source(`../../content/${id}.${locale}.mdx`), `${id}.${locale}`).not.toMatch(/^\s*import\b.*\bDemo\b/m);
      }
    }
  });
});
