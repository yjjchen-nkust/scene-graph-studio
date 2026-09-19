"""Author data/content/papers.json.

Two rules govern every row, and both come from decision D-21.

  1. A number is carried only if it was read off the table named beside it. There is no
     unverified tier. A figure quoted in a survey, a blog post or another paper's prose is not
     carried at all.
  2. Every number names the paper whose table it was read from, not only the table. A figure for
     MOTIFS printed in IndVisSGG's Table 2 is a figure IndVisSGG reports for MOTIFS, and the
     difference matters exactly as much as M11 §9 says it does.

So tier A is the set of methods this project has an opened table for, which is smaller than the
list plan 02 Task 9 wrote in advance. See DEVIATIONS.md D32.

**This script does not reproduce its output.** It has no driver: the content it would
need was authored interactively and lives only in the committed artefact. Running it writes
nothing, `npm run ci` does not invoke it, and the committed file is the source of truth.
Keep it as a record of how the rows were shaped, or delete it; do not trust it to rebuild
anything.
"""

from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "data" / "content" / "papers.json"

# ── the tables this project has actually opened ───────────────────────────────────────────────
#
# IndVisSGG Table 2, as transcribed in docs/superpowers/specs/2026-09-16-indvissgg-reading.md,
# which is a primary-source reading. Test conditions are the paper's own: VG-150 sampled one
# image in 26 of the valid test set (about 1018 images); PSG split 3:1 with 2186 test images.
IND = "indvissgg-2025"

VG = {  # method key -> (R@20, mR@20, R@50, mR@50, R@100, mR@100); None where the table has a dash
    "fcsgg-2021": (16.1, 2.7, 21.3, 1.6, 25.1, 4.2),
    "neural-motifs-2018": (21.4, 6.6, 27.2, 8.2, 30.3, 15.3),
    "freq-2018": (20.1, 7.1, 26.2, 8.5, 30.1, 16.0),
    "reltr-2023": (21.2, 6.8, 27.5, 10.8, None, None),
    "vctree-2019": (22.0, 8.0, 27.9, 10.8, 31.3, 19.4),
    IND: (23.29, 12.98, 30.48, 21.39, 32.36, 21.99),
}

PSG = {
    "imp-2017": (17.9, 7.35, 19.5, 7.88, 20.1, 8.02),
    "gps-net-2020": (18.4, 6.52, 20.0, 6.97, 20.6, 7.17),
    "psgformer-2022": (18.0, 14.8, 19.6, 17.0, 20.1, 17.6),
    "neural-motifs-2018": (20.9, 9.60, 22.5, 10.1, 23.1, 10.3),
    "vctree-2019": (21.7, 9.68, 23.3, 10.2, 23.7, 10.3),
    IND: (23.26, 16.25, 29.69, 25.12, 30.34, 25.62),
}

ISG = {
    "gemini-pro-vision-2023": (13.90, 14.24, 16.64, 15.10, 17.02, 15.36),
    IND: (17.68, 14.51, 24.88, 22.53, 28.73, 28.64),
}

CUTOFFS = [20, 50, 100]


def rows(dataset: str, table: dict, key: str, source: str, source_table: str,
         note_en: str = "", note_zh: str = "") -> list[dict]:
    values = table.get(key)
    if values is None:
        return []
    out = []
    for i, k in enumerate(CUTOFFS):
        for metric, value in (("R", values[i * 2]), ("mR", values[i * 2 + 1])):
            if value is None:
                continue
            row = {
                "dataset": dataset,
                "metric": metric,
                "k": k,
                "value": value,
                "protocol": "sgdet",
                "constraint": "graph",
                "source": source,
                "source_table": source_table,
                "verified": True,
            }
            if note_en:
                row["note_en"] = note_en
                row["note_zh"] = note_zh
            out.append(row)
    return out


REIMPL_EN = ("Reported by IndVisSGG from its own re-implementation, not by the original paper. "
             "Detector backbone and epoch budget are not stated, so the columns are not strictly "
             "comparable.")
REIMPL_ZH = ("由 IndVisSGG 依其自行重新實作的版本報告，而非原始論文所報告。偵測器骨幹與訓練輪數"
             "預算均未載明，故各欄並非嚴格可比。")


def ind_rows(key: str, reimplemented: bool = True) -> list[dict]:
    note = (REIMPL_EN, REIMPL_ZH) if reimplemented else ("", "")
    return (
        rows("vg150-sgb", VG, key, IND, "Table 2", *note)
        + rows("psg", PSG, key, IND, "Table 2", *note)
        + rows("mini-isg", ISG, key, IND, "Table 2", *note)
    )


# Tang et al. 2020, Table 1 — checked against arXiv 2002.11949 in this project. VG150 PredCls,
# mean recall at 100. The row is IMP+, not IMP.
TANG = "tde-2020"
TANG_MR100 = {"freq-2018": 16.0, "neural-motifs-2018": 15.3, "imp-plus-2017": 10.5}

# KERN's own Table 1, which gives two of the same three methods different figures. Both are
# carried, because the disagreement is the lesson (M4 step 6).
KERN = "kern-2019"
KERN_MR100 = {"freq-2018": 15.8, "neural-motifs-2018": 14.4}


def predcls_row(value: float, source: str, table: str, note_en: str, note_zh: str) -> dict:
    return {
        "dataset": "vg150-sgb", "metric": "mR", "k": 100, "value": value,
        "protocol": "predcls", "constraint": "graph",
        "source": source, "source_table": table, "verified": True,
        "note_en": note_en, "note_zh": note_zh,
    }


TANG_NOTE = ("Read the row, not the headline: this table's third entry is IMP+, not IMP. "
             "KERN's own Table 1 gives the same two other methods 15.8 and 14.4.")
TANG_NOTE_ZH = ("請讀該列而非標題：本表第三項為 IMP+ 而非 IMP。KERN 自身的 Table 1 將另外兩個"
                "方法記為 15.8 與 14.4。")
KERN_NOTE = ("Two tables, two answers, the same methods. A mean-recall figure quoted without its "
             "table is not yet a fact.")
KERN_NOTE_ZH = "兩張表、兩組答案、同樣的方法。未附出處表格的 mean recall 數值尚不構成事實。"


def card(key, branch, year, venue, idea_en, idea_zh, *, arxiv=None, doi=None,
         predecessor=None, defect_en=None, defect_zh=None, reported=None, modules=None,
         also_en=None, also_zh=None):
    reported = reported or []
    entry = {
        "key": key,
        "branch": branch,
        "year": year,
        "venue": venue,
        "tier": "A" if reported else "B",
        "idea_en": idea_en,
        "idea_zh": idea_zh,
        "modules": modules or [],
        "reported": reported,
    }
    if arxiv:
        entry["arxiv"] = arxiv
    if doi:
        entry["doi"] = doi
    if predecessor:
        entry["predecessor"] = predecessor
        entry["defect_fixed_en"] = defect_en
        entry["defect_fixed_zh"] = defect_zh
    if also_en:
        entry["caveat_en"] = also_en
        entry["caveat_zh"] = also_zh
    return entry
