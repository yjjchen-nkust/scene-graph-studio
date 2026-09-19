"""Compare the requirement files to the interpreter that is about to run the tests.

D-04 says the pins are measured values. This is what makes that checkable: a pin that no longer
matches the environment is a claim the file cannot support, and the reader it misleads is the one
trying to reproduce a result.

Run standalone to print the comparison:

    python backend/scripts/check_pins.py

`backend/tests/test_pins.py` runs the same two comparisons as assertions, so CI carries it
without a separate step.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as installed_version
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Mismatch:
    name: str
    pinned: str
    found: str | None


def canonical(name: str) -> str:
    """PEP 503 name normalisation, which is what makes `python-multipart` one package."""
    out = []
    for ch in name.strip().lower():
        out.append("-" if ch in "-_." else ch)
    while "--" in (joined := "".join(out)):
        out = list(joined.replace("--", "-"))
    return "".join(out)


def parse_pins(text: str) -> dict[str, str]:
    """`name==version` lines only. Anything looser is refused rather than skipped.

    Skipping would be the quiet failure: a range would pass through unexamined and the file would
    keep its air of having been measured.
    """
    pins: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        if line.startswith("-"):
            # A pip option, not a requirement: `--extra-index-url` is how the inference file
            # reaches the CUDA wheels, which PyPI does not carry. Refusing it would make the
            # file unable to say where its own packages come from.
            continue
        if "==" not in line:
            raise ValueError(f"requirement is not pinned: {line!r}")
        name, _, version = line.partition("==")
        pins[canonical(name)] = version.strip()
    return pins


def base_version(version: str) -> str:
    """Drop PEP 440's local segment: `2.10.0+cpu` is `2.10.0` with a build tag."""
    return version.split("+", 1)[0]


def agrees(pinned: str, actual: str) -> bool:
    """Whether an installed version satisfies a pin.

    A pin that states no local segment accepts any build: `torch==2.10.0` is met by `2.10.0+cpu`,
    because the release is what was being pinned. A pin that *does* state one is a claim about
    the build itself — `torch==2.10.0+cu128` says this project was measured on the CUDA 12.8
    wheel — and a CPU wheel does not satisfy it. Without this asymmetry the tag would be
    decoration: the file could name a GPU build while the interpreter ran a CPU one, and the
    check that exists to catch exactly that would pass.
    """
    if "+" in pinned:
        return actual == pinned
    return base_version(actual) == base_version(pinned)


def installed_versions(pins: dict[str, str]) -> dict[str, str]:
    found: dict[str, str] = {}
    for name in pins:
        try:
            found[name] = installed_version(name)
        except PackageNotFoundError:
            continue
    return found


def compare(
    pins: dict[str, str], found: dict[str, str], *, optional: bool = False
) -> list[Mismatch]:
    """Every pin, against what is installed.

    `optional` is for `requirements-infer.txt`: NFR-1 requires the base install to work without
    any of it, so absence there is the expected state. Absence in `requirements.txt` is not.
    """
    normalised = {canonical(k): v for k, v in found.items()}
    out: list[Mismatch] = []
    for name, pinned in pins.items():
        actual = normalised.get(canonical(name))
        if actual is None:
            if not optional:
                out.append(Mismatch(name=name, pinned=pinned, found=None))
        elif not agrees(pinned, actual):
            out.append(Mismatch(name=name, pinned=pinned, found=actual))
    return out


def main() -> int:
    status = 0
    for filename, optional in (("requirements.txt", False), ("requirements-infer.txt", True)):
        pins = parse_pins((BACKEND / filename).read_text(encoding="utf-8"))
        drift = compare(pins, installed_versions(pins), optional=optional)
        label = "optional" if optional else "required"
        if drift:
            status = 1
            print(f"{filename} ({label}): {len(drift)} of {len(pins)} disagree")
            for m in drift:
                print(f"  {m.name:<20} pinned {m.pinned:<12} found {m.found or 'nothing'}")
        else:
            found = installed_versions(pins)
            absent = [n for n in pins if canonical(n) not in {canonical(k) for k in found}]
            note = f", {len(absent)} not installed here ({', '.join(absent)})" if absent else ""
            print(
                f"{filename} ({label}): {len(pins) - len(absent)} of {len(pins)} pins agree "
                f"with this interpreter{note}"
            )
    return status


if __name__ == "__main__":
    sys.exit(main())
