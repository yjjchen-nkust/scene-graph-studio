from __future__ import annotations

import random
import tracemalloc

import pytest

from app.eval.rle import decode, decode_counts, encode_counts, mask_iou
from app.schema import RLEMask


def rle(counts: list[int], h: int, w: int) -> RLEMask:
    return RLEMask(counts=encode_counts(counts), size=(h, w))


def test_empty_mask_decodes_to_all_zero():
    assert sum(decode(rle([16], 4, 4))) == 0


def test_full_mask_decodes_to_all_one():
    assert sum(decode(rle([0, 16], 4, 4))) == 16


def test_counts_alternate_starting_with_background():
    assert decode(rle([2, 3, 11], 4, 4)) == [0, 0, 1, 1, 1] + [0] * 11


def test_identical_masks_have_iou_one():
    m = rle([2, 3, 11], 4, 4)
    assert mask_iou(m, m) == 1.0


def test_disjoint_masks_have_iou_zero():
    assert mask_iou(rle([0, 4, 12], 4, 4), rle([4, 4, 8], 4, 4)) == 0.0


def test_half_overlap():
    assert mask_iou(rle([0, 8, 8], 4, 4), rle([4, 8, 4], 4, 4)) == 4 / 12


def test_empty_against_empty_is_zero_not_nan():
    assert mask_iou(rle([16], 4, 4), rle([16], 4, 4)) == 0.0


def test_mismatched_sizes_are_rejected():
    with pytest.raises(ValueError):
        mask_iou(rle([16], 4, 4), rle([9], 3, 3))


def test_encode_decode_round_trips_a_long_run():
    counts = [0, 100000, 1]
    assert sum(decode(RLEMask(counts=encode_counts(counts), size=(1, 100001)))) == 100000


@pytest.mark.parametrize("counts", [
    [16], [0, 16], [2, 3, 11], [0, 8, 8], [4, 8, 4], [1, 1, 1, 1, 12],
    [0, 100000, 1], [5, 0, 5, 6], [12345, 6789, 100],
])
def test_encode_then_decode_counts_is_identity(counts):
    from app.eval.rle import decode_counts
    assert decode_counts(encode_counts(counts)) == counts


# ── the cost of a mask is its runs, not its pixels (review of 2026-10-01, D120) ───────────────


def _peak_bytes(call) -> int:
    """The most memory Python held at once while `call` ran."""
    tracemalloc.start()
    try:
        call()
        return tracemalloc.get_traced_memory()[1]
    finally:
        tracemalloc.stop()


def _bitmap_as_before(mask: RLEMask) -> list[int]:
    """`decode` as it stood at D120: every run written out, then padded or cut to the mask."""
    height, width = mask.size
    bitmap: list[int] = []
    value = 0
    for run in decode_counts(mask.counts):
        bitmap.extend([value] * run)
        value ^= 1
    expected = height * width
    if len(bitmap) < expected:
        bitmap.extend([0] * (expected - len(bitmap)))
    return bitmap[:expected]


def _iou_as_before(a: RLEMask, b: RLEMask) -> float:
    pa, pb = _bitmap_as_before(a), _bitmap_as_before(b)
    inter = sum(1 for x, y in zip(pa, pb, strict=True) if x and y)
    union = sum(1 for x, y in zip(pa, pb, strict=True) if x or y)
    return inter / union if union else 0.0


def test_mask_iou_never_writes_out_a_bitmap():
    """Both masks were decoded to H×W lists: 92 MiB for a 2000 × 2000 pair, and a request at
    100000 × 100000, which the schema accepted, asked for about 230 GB."""
    side = 2048
    half, quarter = side * side // 2, side * side // 4
    a = rle([0, half, half], side, side)
    b = rle([quarter, half, quarter], side, side)
    assert _peak_bytes(lambda: mask_iou(a, b)) < 2**20
    assert mask_iou(a, b) == 1 / 3


def _unchecked(counts: list[int], h: int, w: int) -> RLEMask:
    """A mask built below the schema, which refuses runs that do not cover the mask exactly. The
    decoder's own behaviour on them is still specified: it is what the TypeScript engine, which
    has no schema in front of it, must agree with."""
    return RLEMask.model_construct(counts=encode_counts(counts), size=(h, w))


def test_a_run_longer_than_its_mask_is_never_written_out():
    """Seven characters of counts encode a run of 2**24, and the decoder wrote all of it before
    cutting it to sixteen pixels: 256 MiB for a 4 × 4 mask, which no bound on `size` reaches."""
    full = _unchecked([0, 2**24], 4, 4)
    half = rle([8, 8], 4, 4)
    assert _peak_bytes(lambda: mask_iou(full, half)) < 2**20
    assert _peak_bytes(lambda: decode(full)) < 2**20
    assert mask_iou(full, half) == 0.5
    assert decode(full) == [1] * 16


def test_decode_and_mask_iou_agree_with_the_bitmap_they_replaced():
    """Short counts, long counts, empty counts and negative runs, which compressed RLE can encode
    and the bitmap read as zero pixels that still flip the colour."""
    rng = random.Random(20261001)
    for _ in range(2000):
        h, w = rng.randint(1, 9), rng.randint(1, 9)
        size = h * w
        masks = []
        for _ in range(2):
            runs = [rng.randint(-3, size) for _ in range(rng.randint(0, 9))]
            assert decode_counts(encode_counts(runs)) == runs
            masks.append(_unchecked(runs, h, w))
        a, b = masks
        assert decode(a) == _bitmap_as_before(a), a
        assert mask_iou(a, b) == _iou_as_before(a, b), (a, b)
