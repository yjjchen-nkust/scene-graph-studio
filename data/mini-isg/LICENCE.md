# mini-ISG sources

Decision D-18 makes this a **gate, not a record**: no frame is copied into this repository until
the finding below is written. The question is asked once per source and has three possible
answers, of which two mean no.

> *Does this licence permit redistributing individual frames inside a third-party teaching
> repository?* — `YES`, `NO`, or `UNCLEAR — treated as NO`.

| Source | Licence | Statement URL | Checked | Frame redistribution | Consequence |
|---|---|---|---|---|---|
| IndustReal | Apache-2.0 | [4TU record](https://data.4tu.nl/datasets/b008dd74-020d-4ea4-a8ba-7bb60769d224) · [repository README](https://github.com/TimSchoonbeek/IndustReal) | 2026-09-18 | **YES**, with the notice and attribution Apache-2.0 requires | Frames may ride in the class slice bundle once they are cut. |
| MECCANO | **None stated** | [project page](https://iplab.dmi.unict.it/MECCANO/) · [repository](https://github.com/fpv-iplab/MECCANO) | 2026-09-18 | **UNCLEAR — treated as NO** | No frame is copied. Annotations and a manifest of identifiers and SHA-256 hashes only. |

## What was checked, and why it took two pages per source

**IndustReal.** The repository's README says *"IndustReal is released under the Apache 2.0
license."* That is a statement on a code repository, and D13 is this project's record of what
happens when a licence on one artefact is assumed to reach another: PSG's annotations are MIT and
its images are COCO photographs OpenPSG never owned. So the data record was checked separately.
The dataset is hosted at 4TU.ResearchData, its own licence field reads
`Apache-2.0`, and it links the canonical licence text. The licence therefore reaches the frames
and not merely the code, which is the only reason this row says `YES`.

**MECCANO.** The GitHub API reports `license: null` for `fpv-iplab/MECCANO`, and the official
project page at the University of Catania carries download links, a citation request and funding
acknowledgements, but no licence statement, no terms of use and no download agreement. Absence of
a statement is not permission. Under D-18 this is `UNCLEAR`, and `UNCLEAR` is treated as `NO`
without further discussion — there is no fourth answer and no appeal to what is customary.

## What follows from the two answers

Frames are downloaded by the author, as every corpus in this project is (D-08). Where distribution
to the class is permitted, the frames ride in the slice bundle. Where it is not, this directory
commits the annotations and a manifest of frame identifiers and SHA-256 hashes only, and students
work that lab on the placeholder frames.

**The dispositions are not mixed within a frame.** `data/slices/mini-isg/MANIFEST.json` records
one per frame, so a
directory where some frames are present and some are not is legible rather than a bug report
waiting to happen. `system/backend/scripts/bundle_slices.py` adds `mini-isg` to its cleared set
only for the IndustReal frames.

**The annotations are this project's own work** and carry no third party's licence. They are
published with the rest of this repository.

## Status, 2026-09-18

**Cut: 40 frames, all from IndustReal.** `all_rgb_videos.zip` was downloaded from the 4TU record
and verified against its published MD5 (`c5b8901dba179d2eb10e9348f8163c79`); one file of the
eighteen, 4.96 GB of the 77 GB the full record holds, because the other seventeen are training
splits, synthetic data and model weights that forty frames do not need.

`system/backend/scripts/cut_mini_isg.py` selects 20 of the 86 videos by sorting and striding — a
different participant each time rather than the first twenty — and takes two frames from each at
35% and 65% of its duration, away from the ends where an egocentric recording is a hand reaching
for the camera. Deterministic: the same archive gives the same frames, so the manifest's hashes
can be rechecked rather than believed.

**Cut from MECCANO: none, and none will be** until somebody finds a licence statement that does
not exist today.

**Annotated, 2026-09-18.** All forty frames carry a corrected triplet set in
`data/slices/mini-isg/annotations.json`, under `provenance.kind = 'user'`. Those annotations are
this project's own work and carry no third party's licence, so they are committed with the rest of
the repository whatever the frames' disposition turns out to be. `README.md` states who drafted
them, who corrected them, and why the difference between the two is a lower bound rather than a
measurement.

The frames are `data/slices/mini-isg/images/`, which `.gitignore` excludes like every other
slice's images; they travel in the class bundle, which is what `bundle_distribute: YES` buys.
`data/slices/mini-isg/MANIFEST.json` is committed and carries the identifier, source video,
timestamp, SHA-256 and dimensions of each. It sits beside the images rather than in this
directory because that is where `app/datasets/loader.py` looks for it; a manifest anywhere else
is one the application cannot read.
