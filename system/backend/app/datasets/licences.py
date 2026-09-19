"""The two licence gates of decision D-08, read from data/LICENCES.md.

Downloading a corpus for one's own use and distributing images to a class are different acts.
`annotations_commit` gates what may enter this repository; `bundle_distribute` gates what may
enter the slice bundle the course hands out. Both default to closed, and anything that is not
an explicit YES is closed -- UNCLEAR counts as NO.

The markdown table is the source of truth rather than a JSON sidecar because a human fills it
in by reading licence statements, and a human should be able to read what they filled in.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from app.settings import DATA_DIR


@dataclass(frozen=True)
class Gates:
    dataset: str
    licence: str
    statement_url: str
    checked: str
    annotations_commit: bool
    bundle_distribute: bool


CLOSED = Gates("", "", "", "", False, False)


def _cell(value: str) -> bool:
    return value.strip().upper() == "YES"


@lru_cache(maxsize=1)
def read_gates() -> dict[str, Gates]:
    path = DATA_DIR / "LICENCES.md"
    if not path.is_file():
        return {}
    out: dict[str, Gates] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 6:
            continue
        name = cells[0]
        if name in ("Dataset", "") or set(name) <= set("-: "):
            continue
        out[name] = Gates(
            dataset=name,
            licence=cells[1],
            statement_url=cells[2],
            checked=cells[3],
            annotations_commit=_cell(cells[4]),
            bundle_distribute=_cell(cells[5]),
        )
    return out


def gates_for(dataset: str) -> Gates:
    return read_gates().get(dataset, CLOSED)


def require_annotations_commit(dataset: str) -> None:
    if not gates_for(dataset).annotations_commit:
        raise SystemExit(
            f"refusing to write annotations for {dataset!r}: data/LICENCES.md does not clear "
            f"annotations_commit. Read the source's own licence statement, fill the row "
            f"(licence, statement URL, date checked) and set the cell to YES. "
            f"UNCLEAR counts as NO."
        )


def require_bundle_distribute(dataset: str) -> None:
    if not gates_for(dataset).bundle_distribute:
        raise SystemExit(
            f"refusing to bundle {dataset!r}: data/LICENCES.md does not clear "
            f"bundle_distribute. Establish whether the licence permits distributing individual "
            f"images to enrolled students, fill the row and set the cell to YES. "
            f"UNCLEAR counts as NO."
        )
