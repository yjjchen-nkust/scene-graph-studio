// The harvest: what the frozen knowledge map hands to the module corpus.
//
// Paths are relative to system/, where vitest runs. data/ stayed at the track root in the
// 2026-09-16 reorganisation, so it is one level up.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const kp = JSON.parse(readFileSync('../data/content/kp.json', 'utf-8'));
const math = JSON.parse(readFileSync('../data/content/math.json', 'utf-8'));
const deriv = JSON.parse(readFileSync('../data/content/deriv.json', 'utf-8'));

describe('harvest', () => {
  it('carries all 93 knowledge points across 12 clusters', () => {
    expect(kp.length).toBe(93);
    expect(new Set(kp.map((k) => k.cluster)).size).toBe(12);
  });

  it('gives every point both languages and a control surface', () => {
    for (const k of kp) {
      expect(k.title_en, k.id).toBeTruthy();
      expect(k.title_zh, k.id).toBeTruthy();
      expect(k.knobs, k.id).toBeTruthy();
      expect(['live', 'spec']).toContain(k.status);
    }
  });

  it('keys every formula to a knowledge point that exists', () => {
    const ids = new Set(kp.map((k) => k.id));
    for (const id of [...Object.keys(math), ...Object.keys(deriv)]) {
      expect(ids.has(id), `${id} has a formula but no knowledge point`).toBe(true);
    }
  });

  it('leaves no display math with a stray line break outside an alignment', () => {
    // The failure audit.js exists to catch: \\ inside \[ ... \] renders as a red MathJax error.
    for (const [id, tex] of Object.entries({ ...math, ...deriv })) {
      const bare = tex.replace(
        /\\begin\{(aligned|gathered|array|cases)\}[\s\S]*?\\end\{\1\}/g,
        '',
      );
      expect(bare.includes('\\\\'), `${id} has \\\\ outside an alignment`).toBe(false);
    }
  });

  it('did not harvest the teaching-toy evaluator', () => {
    // D-14. Promoting pg.js evaluate() would ship something plausible and wrong that the
    // parity check could not detect, because both engines would be wrong together.
    const all = JSON.stringify({ kp, math, deriv });
    expect(all.includes('function evaluate')).toBe(false);
    expect(all.includes('var PRED=')).toBe(false);
  });

  it('agrees with the frozen page on what is live', () => {
    // tools/check.js asserts these against the page itself; if the two ever disagree, the
    // harvest has drifted from its source.
    expect(kp.filter((k) => k.status === 'live').length).toBe(27);
    expect(Object.keys(math).length).toBe(26);
    expect(Object.keys(deriv).length).toBe(23);
  });

  it('carries the formula onto the knowledge point it belongs to', () => {
    const byId = Object.fromEntries(kp.map((k) => [k.id, k]));
    for (const id of Object.keys(math)) expect(byId[id].math, id).toBe(math[id]);
    for (const id of Object.keys(deriv)) expect(byId[id].deriv, id).toBe(deriv[id]);
  });

  it('keeps the cluster label in both languages on every point', () => {
    for (const k of kp) {
      expect(k.cluster_en, k.id).toBeTruthy();
      expect(k.cluster_zh, k.id).toBeTruthy();
    }
  });
});
