from __future__ import annotations

import pytest

from app.eval.rle import decode, encode_counts, mask_iou
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
