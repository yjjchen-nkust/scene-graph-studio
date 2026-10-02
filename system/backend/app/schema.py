from __future__ import annotations

from collections import Counter
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

DatasetId = Literal["vrd", "vg150-sgb", "psg", "indoorvg", "haystack", "mini-isg", "placeholder"]
Protocol = Literal["predcls", "sgcls", "sgdet"]
Constraint = Literal["graph", "none", "semi"]
MaskPairing = Literal["single_mpo", "multi_mpo"]
Fidelity = Literal["measured", "reconstructed", "published"]

#: The most pixels a mask may cover: a 4096 × 4096 frame, 2.02 times a 4K UHD one. The largest
#: mask on the NAS is 640 × 633 and the widest slice frame 1280 × 1024. The bound is on the area
#: because that is what a bitmap of the mask costs, so a 1 × 100001 strip is admitted (D120's
#: review).
MASK_PIXELS_MAX = 4096 * 4096


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

    @field_validator("size")
    @classmethod
    def _size_is_a_frame(cls, v: tuple[int, int]) -> tuple[int, int]:
        """Positive sides and at most `MASK_PIXELS_MAX` pixels. Unbounded, a request at
        100000 × 100000 asked the decoder for about 230 GB; `(-2, -2)` was a mask of four pixels."""
        height, width = v
        if height < 1 or width < 1:
            raise ValueError(f"mask size must be positive on both sides; got {list(v)}")
        if height * width > MASK_PIXELS_MAX:
            raise ValueError(
                f"mask size {list(v)} covers {height * width} pixels; at most "
                f"{MASK_PIXELS_MAX} (4096 × 4096) are accepted"
            )
        return v

    @model_validator(mode="after")
    def _runs_cover_the_mask(self) -> RLEMask:
        """Every run non-negative and the runs summing to `height * width`, as a COCO mask's do
        and every one of the 648 masks on the NAS does. Anything else the engines read by rules
        of their own: `0PPPPPP2`, a run of 2**31 on sixteen pixels, was a full mask in Python and
        an empty one in the 32-bit TypeScript (D120's review). It also bounds every run by
        `MASK_PIXELS_MAX`. A model validator, because the rule needs both fields."""
        from app.eval.rle import decode_counts  # noqa: PLC0415 - rle imports this module

        runs = decode_counts(self.counts)
        negative = [i for i, run in enumerate(runs) if run < 0]
        if negative:
            raise ValueError(f"mask counts hold a negative run at positions {negative}")
        height, width = self.size
        if sum(runs) != height * width:
            raise ValueError(
                f"mask counts must cover the mask exactly: the runs sum to {sum(runs)} pixels "
                f"and size {list(self.size)} has {height * width}"
            )
        return self


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
