from __future__ import annotations

from app.eval.match import Triplet
from app.schema import MaskPairing


def apply_pairing(ranked: list[Triplet], mode: MaskPairing) -> list[Triplet]:
    """Cap how many predictions one ordered pair of mask instances may contribute.

    Knowledge point E13 states the rule on instances, not on classes:

        SingleMPO: |{m : pi(m) = (s,o)}| = 1
        MultiMPO : |{m : pi(m) = (s,o)}| = d >= 1 permitted

    so the key is the pair of masks and nothing else. Two predictions that agree on the masks and
    disagree on the predicate are two guesses at one relation; two that disagree on the subject
    *name* are two guesses at what one mask depicts. Both are capped, because pi is defined on
    instances. Plan 03 Task 1's snippet also keys on the class names, which would let the second
    kind through -- see DEVIATIONS D36.

    Applied after `rank`, so the survivor at each pair is the highest-scoring one.

    A no-op on graphs that carry no masks: without both masks pi is undefined, and there is
    nothing for the cap to apply to.
    """
    if mode == "multi_mpo":
        return list(ranked)
    seen: set[tuple[str, str]] = set()
    out: list[Triplet] = []
    for p in ranked:
        if p.subject_mask is None or p.object_mask is None:
            out.append(p)
            continue
        key = (p.subject_mask.counts, p.object_mask.counts)
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out
