from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    def _no_dangling_references(self) -> SceneGraph:
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
            raise ValueError(
                f"relationships {dangling} reference object_ids not present in this graph: "
                f"{missing}"
            )
        return self

    def object_by_id(self, object_id: int) -> SGObject:
        for o in self.objects:
            if o.object_id == object_id:
                return o
        raise KeyError(object_id)
