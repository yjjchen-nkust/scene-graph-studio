"""What an adapter had to drop to make a corpus valid.

Shared by every adapter so the reporting has one shape. A published corpus of ~100k rows always
contains a few rows no schema will accept; dropping them silently would let a corpus that is
mostly broken look like a corpus that is merely small.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Repairs:
    """What had to be dropped to make a corpus valid. Reported, never silent."""

    rows: int = 0
    rows_dropped: int = 0
    objects_dropped: int = 0
    relations_dropped: int = 0
    reasons: dict[str, int] = field(default_factory=dict)

    def note(self, reason: str) -> None:
        self.reasons[reason] = self.reasons.get(reason, 0) + 1
