"""D-04, made enforceable: the pins are measured values, so they must match the measurement.

D-04 reads "dependency versions pinned at measured values". It was true when it was written and
then stopped being true without anything noticing, because nothing compared the file to the
interpreter. Six of the ten pins in `requirements.txt` disagreed with the environment that had
just produced a green CI, and one package was pinned without ever being installed — which reads
as coverage of a tool that was never run, the same shape as the `ruff` finding of D74's
predecessor and as the colour comment of D54.

A pin that does not match anything is worse than no pin. It tells the next reader that this
version was tested, which is the one thing it cannot tell them.

`requirements.txt` is the CI's own environment, so every entry must be present and equal.
`requirements-infer.txt` is optional by design — NFR-1 requires the base install to be torch-free
— so an absent package there is a fact about this machine and not a failure.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.check_pins import Mismatch, compare, installed_versions, parse_pins

BACKEND = Path(__file__).resolve().parents[1]


def test_parse_pins_reads_name_and_version():
    assert parse_pins("fastapi==0.135.1\npytest==9.0.2\n") == {
        "fastapi": "0.135.1",
        "pytest": "9.0.2",
    }


def test_parse_pins_ignores_comments_and_blank_lines():
    text = "# the live-inference extras\n\ntorch==2.10.0\n  # indented comment\n"
    assert parse_pins(text) == {"torch": "2.10.0"}


def test_parse_pins_refuses_a_requirement_that_is_not_pinned():
    # A range is not a measured value. Recording one here would let the environment move while
    # the file went on claiming it had been checked.
    with pytest.raises(ValueError, match="not pinned"):
        parse_pins("fastapi>=0.135\n")


def test_compare_reports_a_version_that_moved():
    assert compare({"fastapi": "0.136.1"}, {"fastapi": "0.135.1"}) == [
        Mismatch(name="fastapi", pinned="0.136.1", found="0.135.1")
    ]


def test_compare_reports_a_package_that_is_not_installed():
    assert compare({"pytest-cov": "6.0.0"}, {}) == [
        Mismatch(name="pytest-cov", pinned="6.0.0", found=None)
    ]


def test_compare_tolerates_absence_when_the_file_is_optional():
    # `requirements-infer.txt` is not installed on a machine that is honouring NFR-1, so its
    # absence is the expected state and not a finding. A version that is present and wrong still
    # is one.
    assert compare({"torch": "2.10.0"}, {}, optional=True) == []
    assert compare({"torch": "2.10.0"}, {"torch": "2.9.0"}, optional=True) == [
        Mismatch(name="torch", pinned="2.10.0", found="2.9.0")
    ]


def test_compare_ignores_a_local_version_segment():
    # `torch==2.10.0` is satisfied by `2.10.0+cpu`: PEP 440 treats the local segment as a build
    # tag, and the CPU wheel is the one D-02's ship target wants. Reporting this as drift would
    # train the reader to ignore the report.
    assert compare({"torch": "2.10.0"}, {"torch": "2.10.0+cpu"}) == []


def test_parse_pins_skips_a_pip_option_line():
    # `requirements-infer.txt` names the CUDA wheel index, because the build it pins is not on
    # PyPI and a file that cannot install itself is a file that will be installed wrongly.
    text = "--extra-index-url https://download.pytorch.org/whl/cu128\ntorch==2.10.0+cu128\n"
    assert parse_pins(text) == {"torch": "2.10.0+cu128"}


def test_compare_enforces_a_local_segment_the_pin_states():
    # The reverse of the rule above, and the reason it is safe: a pin that names the build is a
    # claim about the build, so a CPU wheel does not satisfy `+cu128`. Without this, writing the
    # CUDA tag into the file would decorate it rather than check it.
    assert compare({"torch": "2.10.0+cu128"}, {"torch": "2.10.0+cu128"}) == []
    assert compare({"torch": "2.10.0+cu128"}, {"torch": "2.10.0+cpu"}) == [
        Mismatch(name="torch", pinned="2.10.0+cu128", found="2.10.0+cpu")
    ]
    assert compare({"torch": "2.10.0+cu128"}, {"torch": "2.10.0"}) == [
        Mismatch(name="torch", pinned="2.10.0+cu128", found="2.10.0")
    ]


def test_compare_is_case_and_separator_insensitive_in_the_name():
    # `python-multipart`, `Python_Multipart` and `python_multipart` are one distribution.
    assert compare({"python-multipart": "0.0.22"}, {"python_multipart": "0.0.22"}) == []


def test_the_required_pins_match_this_interpreter():
    """The enforcer. Every pin in `requirements.txt` is present and equal, here, now."""
    pins = parse_pins((BACKEND / "requirements.txt").read_text(encoding="utf-8"))
    drift = compare(pins, installed_versions(pins))
    assert drift == [], "requirements.txt does not describe this interpreter: " + "; ".join(
        f"{m.name} pinned {m.pinned}, found {m.found or 'nothing'}" for m in drift
    )


def test_the_inference_pins_match_this_interpreter_where_they_are_installed():
    """The same, for the optional extras: absent is fine, present and different is not."""
    pins = parse_pins((BACKEND / "requirements-infer.txt").read_text(encoding="utf-8"))
    drift = compare(pins, installed_versions(pins), optional=True)
    assert drift == [], "requirements-infer.txt disagrees with what is installed: " + "; ".join(
        f"{m.name} pinned {m.pinned}, found {m.found or 'nothing'}" for m in drift
    )
