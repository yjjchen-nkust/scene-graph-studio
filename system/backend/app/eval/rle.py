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


def foreground(mask: RLEMask) -> list[tuple[int, int]]:
    """The mask's set pixels as half-open intervals of the flat column-major index, in order.

    Read exactly as the bitmap was: runs alternate from background, a negative run covers no
    pixel but still flips the colour, counts short of `height * width` leave the rest background,
    and counts beyond it are cut. A run is clipped before it is used, so seven characters encoding
    a run of 2**24 on a 4 × 4 mask cost an interval, not 256 MiB (D120's review).
    """
    height, width = mask.size
    area = height * width
    out: list[tuple[int, int]] = []
    start, value = 0, 0
    for run in decode_counts(mask.counts):
        if start >= area:
            break
        end = min(start + max(run, 0), area)
        if value and end > start:
            out.append((start, end))
        start, value = end, value ^ 1
    return out


def decode(mask: RLEMask) -> list[int]:
    """Return a flat column-major bitmap of length height * width."""
    height, width = mask.size
    bitmap = [0] * (height * width)
    for start, end in foreground(mask):
        bitmap[start:end] = [1] * (end - start)
    return bitmap


def mask_iou(a: RLEMask, b: RLEMask) -> float:
    """Counted over the two interval lists rather than two bitmaps, so the cost follows the runs
    and not `height * width`; the counts, and so the quotient, are the bitmap's exactly."""
    if a.size != b.size:
        raise ValueError(f"mask sizes differ: {a.size} vs {b.size}")
    fa, fb = foreground(a), foreground(b)
    inter, i, j = 0, 0, 0
    while i < len(fa) and j < len(fb):
        inter += max(0, min(fa[i][1], fb[j][1]) - max(fa[i][0], fb[j][0]))
        # Advance whichever interval ends first; the other may still overlap the next one.
        if fa[i][1] <= fb[j][1]:
            i += 1
        else:
            j += 1
    union = sum(e - s for s, e in fa) + sum(e - s for s, e in fb) - inter
    return inter / union if union else 0.0
