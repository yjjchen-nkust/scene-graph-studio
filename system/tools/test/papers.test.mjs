import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const papers = JSON.parse(readFileSync('../data/content/papers.json', 'utf-8'));
const method = (key) => key.replace(/-\d{4}$/, '');
const keys = new Set(papers.map((p) => p.key));
const methods = new Set(papers.map((p) => method(p.key)));

describe('papers.json', () => {
  it('gives every paper an identifier a reader can chase', () => {
    for (const p of papers) expect(p.doi || p.arxiv, p.key).toBeTruthy();
  });

  it('gives every paper a key of the form method-year', () => {
    for (const p of papers) expect(p.key, p.key).toMatch(/^[a-z0-9-]+-\d{4}$/);
  });

  it('tags every reported number with its protocol, constraint and source table', () => {
    for (const p of papers) {
      for (const r of p.reported) {
        expect(r.protocol, `${p.key}`).toBeTruthy();
        expect(r.constraint, `${p.key}`).toBeTruthy();
        expect(r.source_table, `${p.key}`).toBeTruthy();
      }
    }
  });

  it('names which paper each number was read out of, not only which table', () => {
    // A figure for MOTIFS printed in IndVisSGG's Table 2 is a figure IndVisSGG reports. The
    // distinction is the difference between "MOTIFS scored this" and "this paper says MOTIFS
    // scored this", and cross-method comparability (M11 §9) turns on it.
    for (const p of papers) {
      for (const r of p.reported) {
        expect(keys.has(r.source), `${p.key}: cites '${r.source}', which has no card`).toBe(true);
      }
    }
  });

  it('carries no unverified number anywhere, in either tier', () => {
    // D-21. A number carried over from a survey, a blog post or another paper's prose is not
    // carried at all. Rendering it in a distinct style and hoping is weaker than leaving it out.
    for (const p of papers) {
      for (const r of p.reported) {
        expect(r.verified, `${p.key}: an unverified number is not carried at all`).toBe(true);
      }
    }
  });

  it('puts a paper in tier A exactly when it carries numbers', () => {
    // Tier is a consequence of what has been read, not a list written in advance. Plan 02 Task 9
    // hard-codes twelve tier-A methods, five of which this project has no table for; under D-21
    // the only way to satisfy that list is to carry a number nobody checked. See DEVIATIONS D32.
    for (const p of papers) {
      expect(p.tier, p.key).toBe(p.reported.length > 0 ? 'A' : 'B');
    }
  });

  it('gives every tier-B card the four things G3 needs without numbers', () => {
    // PRD §4 G3: place a paper on the taxonomy, name its predecessor and the defect it fixed.
    for (const p of papers.filter((x) => x.tier === 'B')) {
      for (const field of ['branch', 'year', 'core_idea_en', 'core_idea_zh']) {
        expect(p[field], `${p.key}: no ${field}`).toBeTruthy();
      }
    }
  });

  it('resolves every predecessor to a paper that exists', () => {
    for (const p of papers) {
      if (p.predecessor) expect(keys.has(p.predecessor), `${p.key} → ${p.predecessor}`).toBe(true);
    }
  });

  it('states the defect fixed wherever a predecessor is named', () => {
    for (const p of papers) {
      if (p.predecessor) {
        expect(p.defect_fixed_en, p.key).toBeTruthy();
        expect(p.defect_fixed_zh, p.key).toBeTruthy();
      }
    }
  });

  it('has no predecessor cycle, so the field map can be drawn', () => {
    for (const p of papers) {
      const seen = new Set([p.key]);
      let at = p.predecessor;
      while (at) {
        expect(seen.has(at), `cycle through ${p.key}`).toBe(false);
        seen.add(at);
        at = papers.find((x) => x.key === at)?.predecessor;
      }
    }
  });

  it('covers every method named in the curriculum', () => {
    // PRD §7. This is the assertion that keeps the corpus honest against the syllabus.
    const required = ['imp', 'neural-motifs', 'vctree', 'gps-net', 'tde', 'cogtree', 'dlfe',
      'nice', 'ietrans', 'st-sgg', 'pe-net', 'ra-sgg', 'fcsgg', 'reltr', 'sgtr', 'egtr',
      'dsgg', 'speaq', 'hydra-sgg', 'react', 'psgformer', 'vs3', 'ovsgtr', 'pgsg',
      'sttran', 'tempura', 'oed', 'diffvsgg', 'uno', '3dssg', 'hydra', 'conceptgraphs',
      'clio', 'sayplan', 'indvissgg'];
    for (const r of required) expect(methods.has(r), `missing ${r}`).toBe(true);
  });

  it('covers every source a module claim cites', () => {
    // The content lint checks this from the other side once papers.json exists. Asserting it
    // here too means a card deleted in this file fails here rather than in a module.
    const cited = ['tde-2020', 'kern-2019', 'sttran-2021',
      'psg-fair-ranking-2024', 'flowsg-2026', 'ovsgtr-2024', 'indvissgg-2025'];
    for (const c of cited) expect(keys.has(c), `no card for claim source ${c}`).toBe(true);
  });

  it('gives every card the fields contracts §3.2 names', () => {
    for (const p of papers) {
      for (const field of ['key', 'branch', 'year', 'venue', 'core_idea_en', 'core_idea_zh',
                           'url', 'reported']) {
        expect(p[field], `${p.key}: no ${field}`).not.toBe(undefined);
      }
    }
  });

  it('puts every card on one of the nine branches', () => {
    const BRANCHES = ['foundations', 'two-stage', 'debiasing', 'one-stage', 'panoptic',
      'open-vocabulary', 'llm-vlm', 'video', 'embodied'];
    for (const p of papers) expect(BRANCHES, p.key).toContain(p.branch);
  });

  it('is bilingual everywhere a reader sees prose', () => {
    for (const p of papers) {
      expect(p.core_idea_en, p.key).toBeTruthy();
      expect(p.core_idea_zh, p.key).toBeTruthy();
    }
  });

  it('spells the protocol and the constraint from a closed set', () => {
    // 'unstated' is one of them. IndVisSGG names no protocol and no constraint mode anywhere —
    // the strings SGDet, PredCls, SGCls and 'graph constraint' do not occur in the paper — and
    // eighty-two of this corpus's numbers are read from its Table 2. Tagging them 'sgdet' was
    // an attribution the source does not make, and §5.1.3 contradicts it outright. D34.
    const PROTOCOL = ['predcls', 'sgcls', 'sgdet', 'unstated'];
    const CONSTRAINT = ['graph', 'none', 'semi', 'unstated'];
    for (const p of papers) {
      for (const r of p.reported) {
        expect(PROTOCOL, `${p.key}: protocol '${r.protocol}'`).toContain(r.protocol);
        expect(CONSTRAINT, `${p.key}: constraint '${r.constraint}'`).toContain(r.constraint);
      }
    }
  });

  it('reads no protocol into IndVisSGG, which names none', () => {
    // Named rather than derived, because only a reader of the paper can know this and the corpus
    // has nowhere to record it. Text extraction over the PDF finds no occurrence of 'SGDet',
    // 'PredCls', 'SGCls', 'graph constraint' or 'epoch'; §5.1.3 says "In the VG and PSG
    // experiments, both O and P are predetermined for all methods", which is the opposite of
    // detection. Eighty-two numbers were tagged sgdet/graph on its authority. D34.
    for (const p of papers) {
      for (const r of p.reported.filter((x) => x.source === 'indvissgg-2025')) {
        expect(r.protocol, `${p.key}: IndVisSGG names no protocol`).toBe('unstated');
        expect(r.constraint, `${p.key}: IndVisSGG names no constraint mode`).toBe('unstated');
      }
    }
  });

  it('says in the source’s own words why an unstated tag is unstated', () => {
    // 'unstated' without the sentence that establishes it is just a shrug. The note quotes the
    // passage a reader can check, in both languages, exactly as `source_table` does for a value.
    for (const p of papers) {
      for (const r of p.reported) {
        if (r.protocol !== 'unstated' && r.constraint !== 'unstated') continue;
        expect(r.protocol_note_en, `${p.key}: unstated with no protocol_note_en`).toBeTruthy();
        expect(r.protocol_note_zh, `${p.key}: unstated with no protocol_note_zh`).toBeTruthy();
      }
    }
  });

  it('carries the backbone column on every number, even when it is null', () => {
    // Null is the statement that the source does not name one, and it is what separates the two
    // IndVisSGG rows on ISG: the same method, the same table, two different VLMs.
    for (const p of papers) {
      for (const r of p.reported) {
        expect(Object.hasOwn(r, 'backbone'), `${p.key}: no backbone column`).toBe(true);
        const ok = r.backbone === null || (typeof r.backbone === 'string' && r.backbone !== '');
        expect(ok, `${p.key}: backbone is neither a name nor null`).toBe(true);
      }
    }
  });

  it('never lets a card wear another method’s figure without saying so', () => {
    // The ISG row of IndVisSGG's Table 2 is labelled 'IndVisSGG-Gemini (ours)'. Carried on a card
    // keyed for Gemini-Pro-Vision it asserted that Gemini scored 13.90 R@20, which the paper
    // never claims: it is IndVisSGG running on a different backbone. Whenever the table belongs
    // to a paper other than the card, the row has to say whose measurement it is. D34.
    for (const p of papers) {
      for (const r of p.reported) {
        if (r.source === p.key) continue;
        expect(r.note_en, `${p.key}: a figure from ${r.source} with no note_en`).toBeTruthy();
        expect(r.note_zh, `${p.key}: a figure from ${r.source} with no note_zh`).toBeTruthy();
      }
    }
  });
});
