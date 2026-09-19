from __future__ import annotations

from app.schema import RLEMask

# COCO's compressed RLE. Each run length is written as a sequence of 5-bit groups, low group
# first, offset by 48 so every byte is printable ASCII. Bit 5 (0x20) is the continuation flag,
# and bit 4 (0x10) of the final group is the sign bit. From the fourth run onward the value
# stored is a delta against the run two positions earlier.
#
# Implemented here rather than taken from pycocotools because the TypeScript mirror needs the
# same operation in the browser, where pycocotools does not exist, and NFR-3 requires both
# engines to compute it identically. See decision D-12.


def decode_counts(counts: str) -> list[int]:
    out: list[int] = []
    i, n = 0, len(counts)
    while i < n:
        value, shift, more = 0, 0, True
        while more:
            char = ord(counts[i]) - 48
            i += 1
            value |= (char & 0x1F) << shift
            shift += 5
            more = bool(char & 0x20)
            if not more and (char & 0x10):
                value |= -1 << shift
        if len(out) > 2:
            value += out[-2]
        out.append(value)
    return out


def encode_counts(values: list[int]) -> str:
    """Inverse of decode_counts. Used by fixtures and by the slice adapters."""
    out: list[str] = []
    for index, raw in enumerate(values):
        value = raw - values[index - 2] if index > 2 else raw
        more = True
        while more:
            char = value & 0x1F
            value >>= 5
            if char & 0x10:
                more = value != -1
            else:
                more = value != 0
            if more:
                char |= 0x20
            out.append(chr(char + 48))
    return "".join(out)


def decode(mask: RLEMask) -> list[int]:
    """Return a flat column-major bitmap of length height * width."""
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


def mask_iou(a: RLEMask, b: RLEMask) -> float:
    if a.size != b.size:
        raise ValueError(f"mask sizes differ: {a.size} vs {b.size}")
    pa, pb = decode(a), decode(b)
    inter = sum(1 for x, y in zip(pa, pb, strict=True) if x and y)
    union = sum(1 for x, y in zip(pa, pb, strict=True) if x or y)
    return inter / union if union else 0.0
