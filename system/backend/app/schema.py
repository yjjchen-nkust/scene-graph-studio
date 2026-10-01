from __future__ import annotations

from collections import Counter
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

DatasetId = Literal["vrd", "vg150-sgb", "psg", "indoorvg", "haystack", "mini-isg", "placeholder"]
Protocol = Literal["predcls", "sgcls", "sgdet"]
Constraint = Literal["graph", "none", "semi"]
MaskPairing = Literal["single_mpo", "multi_mpo"]
Fidelity = Literal["measured", "reconstructed", "published"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class BBox(Strict):
    x: float
    y: float
    w: float = Field(gt=0)
    h: float = Field(gt=0)


class RLEMask(Strict):
    counts: str
    size: tuple[int, int]

    @field_validator("counts")
    @classmethod
    def _counts_are_compressed_rle(cls, v: str) -> str:
        """Every character one 6-bit group (`0` to `o`), and the last one closes its run. A group
        that promises a next one and is the last was an `IndexError` in the decoder, a 500."""
        if any(not 48 <= ord(c) <= 111 for c in v):
            raise ValueError("mask counts must be compressed RLE: characters '0' to 'o' only")
        if v and (ord(v[-1]) - 48) & 0x20:
            raise ValueError(
                "mask counts end inside a run: the last group carries the continuation flag"
            )
        return v


class SGObject(Strict):
    object_id: int
    names: list[str] = Field(min_length=1)
    bbox: BBox
    mask: RLEMask | None = None
    attributes: list[str] = Field(default_factory=list)
    synsets: list[str] = Field(default_factory=list)

    @property
    def name(self) -> str:
        return self.names[0]


class SGRelationship(Strict):
    relationship_id: int
    subject_id: int
    object_id: int
    predicate: str
    score: float | None = None


class Provenance(Strict):
    kind: Literal["ground_truth", "model", "vlm", "user"]
    fidelity: Fidelity
    model: str | None = None
    vlm: str | None = None
    generated_at: str | None = None
    note: str | None = None

    @model_validator(mode="after")
    def _note_required_when_not_measured(self) -> Provenance:
        if self.fidelity != "measured" and not self.note:
            raise ValueError(f"provenance.note is required when fidelity is {self.fidelity!r}")
        return self


class SceneGraph(Strict):
    image_id: str
    dataset: DatasetId
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    objects: list[SGObject]
    relationships: list[SGRelationship]
    provenance: Provenance

    @model_validator(mode="after")
    def _ids_resolve(self) -> SceneGraph:
        """Each id names one object (D99's key is the ordered id pair; the first-match lookup below
        and the TypeScript engine's map would resolve a repeated id differently), and each
        relationship names objects present. One validator reports both: a second would not run
        after the first raised, and the dangling reference carries its own code (D102)."""
        problems: list[str] = []
        repeated = sorted(i for i, n in Counter(o.object_id for o in self.objects).items() if n > 1)
        if repeated:
            problems.append(f"object_ids {repeated} appear more than once in this graph")
        known = {o.object_id for o in self.objects}
        dangling = [
            r.relationship_id
            for r in self.relationships
            if r.subject_id not in known or r.object_id not in known
        ]
        if dangling:
            missing = sorted(
                {r.subject_id for r in self.relationships if r.subject_id not in known}
                | {r.object_id for r in self.relationships if r.object_id not in known}
            )
            problems.append(
                f"relationships {dangling} reference object_ids not present in this graph: "
                f"{missing}"
            )
        if problems:
            raise ValueError("; ".join(problems))
        return self

    def object_by_id(self, object_id: int) -> SGObject:
        for o in self.objects:
            if o.object_id == object_id:
                return o
        raise KeyError(object_id)
