# 3D models

## `models/3dbenchy-lowpoly.glb`

3DBenchy — a small motor-cruiser-shaped calibration boat, used as the
stand-in hull for _every_ vessel in the "Benchy" scene view, whatever her
hull, size or mode of propulsion (see
[src/BenchyModel.tsx](src/BenchyModel.tsx)).

- **Source:** [CreativeTools/3DBenchy](https://github.com/CreativeTools/3DBenchy)
  at commit `b542785f9642ab39db8a778a0ccc934b3ebd829a`,
  `Single-part/3DBenchy.stl`.
- **License:** CC0 (public domain), per
  [3dbenchy.com/license](https://www.3dbenchy.com/license/).
- **Conversion:** the source STL (225,706 triangles) was decimated with
  `trimesh` + `fast-simplification` (quadric edge collapse) to 13,487
  triangles / 6,738 vertices and exported to glTF binary (glb) with
  vertex normals. No textures — a single flat PBR material. Millimetre
  units are preserved from the STL; the renderer scales the model to a
  vessel's `fact:length_m` at render time.
- **Shipped in the package**, resolvable as
  `nav-wright/models/3dbenchy-lowpoly.glb`. `BenchyView` takes the URL as a
  prop rather than importing the file, so resolving it stays the
  consumer's job — see the README's "The 3D view".
- **Bow orientation:** confirmed against the source mesh, not assumed. The
  hull's cross-section narrows to a point (±1.6 to 2.6mm half-beam) at the
  local `+X` extreme and stays full-width (±11mm half-beam) at the local
  `-X` extreme — the pointed prow is at `+X`, the flat transom at `-X`.
  `BenchyModel` relies on this: it rotates height (`Z`) onto three.js's
  `Y`-up axis and leaves `X` alone, so the bow ends up on `+X` in the
  rendered scene — the same "bow right" convention the SVG profile view
  uses (see [src/hulls.tsx](src/hulls.tsx)). The scale, rotation and
  waterline-centering arithmetic is in
  [src/modelTransform.ts](src/modelTransform.ts), which has no three.js or
  React in it and is unit-tested against three.js's own bounding-box
  result.

## `models/catalog.json` and `models/<stem>.json`

One record per mesh (the design is [docs/design/mesh-catalog.md](docs/design/mesh-catalog.md)):
what the file is, the vessel it depicts, how true to life, and where her
lights seat. The sidecar `models/<stem>.json` carries the authored fields;
`scripts/mesh-catalog.mjs` measures proportions, frame and lights off the
mesh and folds both into `models/catalog.json` and the package's
`meshCatalog` export, validated by `meshRecordSchema`
([src/meshRecord.ts](src/meshRecord.ts)). `models/mesh-record.schema.json`
is the same schema as JSON Schema.

- **Sidecars:** generated for the traced and lofted meshes by their scripts;
  hand-written for the kit meshes and Benchy, each naming a nominal real
  vessel (`nominal: true`).
- **Regenerate:** `npm run catalog`; `npm run models` does it after the lofts.
  `test/meshCatalog.test.ts` fails when a mesh has no record, a record no
  mesh, or the catalog is stale against a sidecar.

## `models/<vessel-id>.glb`

One mesh per real sailing vessel traced in
[docs/research/sailboat-lines](docs/research/sailboat-lines/README.md),
lofted by [scripts/sailboat-lines.mjs](scripts/sailboat-lines.mjs) from the
hand trace of a published drawing. Unlike the hull lofts above these are to
true aspect, feet all round: the underbody down to the keel, boot-top paint,
deck, coachroof or deckhouses, and the rig as spars and wire. Low-poly and
faceted, five flat materials, no textures.

- **Source:** the trace json; the drawings it was read from are not
  committed, and the json names each one. Where the trace has no body plan
  the sections are an assumed canoe body (the research README's method).
- **License:** the trace's, this package's.
- **Orientation:** the Benchy convention, Z up, bow on local `+X`,
  half-length units. The root node's glTF extras carry `waterlineZ: 0`, the
  model's own waterline, which `placeHullModel` floats her on, and
  `hullX: [-1, 1]`, the hull's own extent, which the fit to a length uses
  instead of the mesh's bounding box, so a bowsprit or boomkin does not
  shorten her. A mesh without them rests its lowest point on the water
  and is fitted by its box, as the lofts above (drawn down to the
  waterline, no spars) want.
- **Regenerate** after changing a trace: `node scripts/sailboat-lines.mjs`.
  Deterministic.
- **Shipped in the package** under `./models/*`, e.g.
  `nav-wright/models/westsail-32.glb`. The playground's vessels page
  shows each one lit as a sailing vessel of her own length.

| File                                | Trace                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `com-pac-16.glb`                    | [com-pac-16.json](docs/research/sailboat-lines/com-pac-16.json)                                       |
| `catalina-30-mkii.glb`              | [catalina-30-mkii.json](docs/research/sailboat-lines/catalina-30-mkii.json)                           |
| `westsail-32.glb`                   | [westsail-32.json](docs/research/sailboat-lines/westsail-32.json)                                     |
| `hans-christian-38t.glb`            | [hans-christian-38t.json](docs/research/sailboat-lines/hans-christian-38t.json)                       |
| `cheoy-lee-clipper-48-schooner.glb` | [cheoy-lee-clipper-48-schooner.json](docs/research/sailboat-lines/cheoy-lee-clipper-48-schooner.json) |
| `wyoming.glb`                       | [wyoming.json](docs/research/sailboat-lines/wyoming.json)                                             |
| `thomas-w-lawson.glb`               | [thomas-w-lawson.json](docs/research/sailboat-lines/thomas-w-lawson.json)                             |

## `models/loft-<hull-id>.glb`

One base mesh per hull in `allHulls`, twenty-four in all (plus three variants each, below), lofted from that hull's
own 2D drawings by [scripts/loft-hulls.mjs](scripts/loft-hulls.mjs) — the
fallback nav-wright#44 names for hulls with no sourced mesh. Low-poly and
faceted: three flat materials (hull, deckhouse, rig), no textures.

- **Source:** this repo's hull drawings in [src/hulls.tsx](src/hulls.tsx).
  The side profile gives each part's keel and deck line at every station;
  the plan outline gives the half-beam. The lowest filled shape is the hull,
  lofted through rounded sections; every other filled shape is a deckhouse,
  a box at 0.82 of the hull's half-beam; rig lines become thin spars.
- **License:** the same as the drawings they come from, this package's.
- **Orientation:** the Benchy convention above, so `BenchyView` and
  `placeHullModel` take them unchanged — Z up, bow on local `+X`,
  half-length units, heights scaled by `LIGHT_Z_TO_X`.
- **Regenerate** after changing a drawing: `npm run models`. The output is
  deterministic; `test/loftModels.test.ts` fails when a hull has no mesh.
- **Shipped in the package** under the `./models/*` export, e.g.
  `nav-wright/models/loft-tug.glb`.
- **Files:** every loft, one row each (`test/modelsListed.test.ts` fails when a file in `models/` is missing from this document).

| File                          | Hull drawing                                           |
| ----------------------------- | ------------------------------------------------------ |
| `loft-aground.glb`            | `aground` in [src/hulls.tsx](src/hulls.tsx)            |
| `loft-barge.glb`              | `barge` in [src/hulls.tsx](src/hulls.tsx)              |
| `loft-bulker.glb`             | `bulker` in [src/hulls.tsx](src/hulls.tsx)             |
| `loft-container-ship.glb`     | `container-ship` in [src/hulls.tsx](src/hulls.tsx)     |
| `loft-cruise-ship.glb`        | `cruise-ship` in [src/hulls.tsx](src/hulls.tsx)        |
| `loft-dive-support.glb`       | `dive-support` in [src/hulls.tsx](src/hulls.tsx)       |
| `loft-dredger.glb`            | `dredger` in [src/hulls.tsx](src/hulls.tsx)            |
| `loft-ferry.glb`              | `ferry` in [src/hulls.tsx](src/hulls.tsx)              |
| `loft-fishing-gear.glb`       | `fishing-gear` in [src/hulls.tsx](src/hulls.tsx)       |
| `loft-mine-clearance.glb`     | `mine-clearance` in [src/hulls.tsx](src/hulls.tsx)     |
| `loft-open.glb`               | `open` in [src/hulls.tsx](src/hulls.tsx)               |
| `loft-partly-submerged.glb`   | `partly-submerged` in [src/hulls.tsx](src/hulls.tsx)   |
| `loft-pilot-boat.glb`         | `pilot-boat` in [src/hulls.tsx](src/hulls.tsx)         |
| `loft-power-large.glb`        | `power-large` in [src/hulls.tsx](src/hulls.tsx)        |
| `loft-power-small.glb`        | `power-small` in [src/hulls.tsx](src/hulls.tsx)        |
| `loft-pusher.glb`             | `pusher` in [src/hulls.tsx](src/hulls.tsx)             |
| `loft-restricted-ability.glb` | `restricted-ability` in [src/hulls.tsx](src/hulls.tsx) |
| `loft-sail-large.glb`         | `sail-large` in [src/hulls.tsx](src/hulls.tsx)         |
| `loft-sail-small.glb`         | `sail-small` in [src/hulls.tsx](src/hulls.tsx)         |
| `loft-seiner.glb`             | `seiner` in [src/hulls.tsx](src/hulls.tsx)             |
| `loft-square-rigger.glb`      | `square-rigger` in [src/hulls.tsx](src/hulls.tsx)      |
| `loft-tanker.glb`             | `tanker` in [src/hulls.tsx](src/hulls.tsx)             |
| `loft-trawler.glb`            | `trawler` in [src/hulls.tsx](src/hulls.tsx)            |
| `loft-tug.glb`                | `tug` in [src/hulls.tsx](src/hulls.tsx)                |
| `loft-warship.glb`            | `warship` in [src/hulls.tsx](src/hulls.tsx)            |
| `loft-wing-in-ground.glb`     | `wing-in-ground` in [src/hulls.tsx](src/hulls.tsx)     |

### Loft variants

`models/loft-<hull-id>-<variant>.glb`: three more meshes per lofted hull,
from the same script with parameters on the drawing (nav-wright#44: several
meshes per hull class; variety is the goal, [docs/decisions.md](docs/decisions.md),
2026-09-16). `beam` scales the half-beam, `sheer` lifts the deck at bow and
stern (fraction of hull height, quadratic from midships), `freeboard` scales
the deck's height above the waterline, `house` scales each deckhouse's
height and rides it up with the deck beneath. Rig spars follow the deck.
`barge` and `open` carry the extras named in their rows because their
drawings fail the mesh check by scaling alone (a square end; no rail line),
so their `base` lofts above still fail it. Same Z-up, bow-on-`+X`
convention and flat materials as the base lofts; no textures.

Mesh check: `test/hullMeshCheck.test.ts` over these files turned Y-up
(`(x, y, z) -> (x, z, -y)`), 3/3 on every row below that gives a score; the
base lofts score 3/3 except `loft-barge` (bow) and `loft-open` (rail).
`pusher` and `partly-submerged` (nav-wright#51) score 2/3 by design: the
push tug's square bow fails the bow test as the barge's does, and the awash
object has no gunwale for the rail test.

| File                                   | Hull class           | Variant  | Parameters (multipliers on the drawing)                                                                               | hullMeshCheck |
| -------------------------------------- | -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- | ------------- |
| `loft-aground-slender.glb`             | `aground`            | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-aground-sheered.glb`             | `aground`            | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-aground-highside.glb`            | `aground`            | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-barge-slender.glb`               | `barge`              | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9; bow tapered 0.7, cargo mound halved in length                        | 3/3           |
| `loft-barge-sheered.glb`               | `barge`              | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1; bow tapered 0.7, cargo mound halved in length                            | 3/3           |
| `loft-barge-highside.glb`              | `barge`              | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3; bow tapered 0.7, cargo mound halved in length                       | 3/3           |
| `loft-bulker-slender.glb`              | `bulker`             | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-bulker-sheered.glb`              | `bulker`             | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-bulker-highside.glb`             | `bulker`             | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-container-ship-slender.glb`      | `container-ship`     | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-container-ship-sheered.glb`      | `container-ship`     | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-container-ship-highside.glb`     | `container-ship`     | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-cruise-ship-slender.glb`         | `cruise-ship`        | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-cruise-ship-sheered.glb`         | `cruise-ship`        | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-cruise-ship-highside.glb`        | `cruise-ship`        | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-dive-support-slender.glb`        | `dive-support`       | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-dive-support-sheered.glb`        | `dive-support`       | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-dive-support-highside.glb`       | `dive-support`       | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-dredger-slender.glb`             | `dredger`            | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-dredger-sheered.glb`             | `dredger`            | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-dredger-highside.glb`            | `dredger`            | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-ferry-slender.glb`               | `ferry`              | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-ferry-sheered.glb`               | `ferry`              | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-ferry-highside.glb`              | `ferry`              | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-fishing-gear-slender.glb`        | `fishing-gear`       | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-fishing-gear-sheered.glb`        | `fishing-gear`       | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-fishing-gear-highside.glb`       | `fishing-gear`       | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-mine-clearance-slender.glb`      | `mine-clearance`     | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-mine-clearance-sheered.glb`      | `mine-clearance`     | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-mine-clearance-highside.glb`     | `mine-clearance`     | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-open-slender.glb`                | `open`               | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9; plus a centre console (0.45 to 0.6 of length, half the hull height)  | 3/3           |
| `loft-open-sheered.glb`                | `open`               | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1; plus a centre console (0.45 to 0.6 of length, half the hull height)      | 3/3           |
| `loft-open-highside.glb`               | `open`               | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3; plus a centre console (0.45 to 0.6 of length, half the hull height) | 3/3           |
| `loft-partly-submerged-slender.glb`    | `partly-submerged`   | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 2/3 (rail)    |
| `loft-partly-submerged-sheered.glb`    | `partly-submerged`   | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 2/3 (rail)    |
| `loft-partly-submerged-highside.glb`   | `partly-submerged`   | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 2/3 (rail)    |
| `loft-pilot-boat-slender.glb`          | `pilot-boat`         | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-pilot-boat-sheered.glb`          | `pilot-boat`         | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-pilot-boat-highside.glb`         | `pilot-boat`         | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-power-large-slender.glb`         | `power-large`        | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-power-large-sheered.glb`         | `power-large`        | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-power-large-highside.glb`        | `power-large`        | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-power-small-slender.glb`         | `power-small`        | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-power-small-sheered.glb`         | `power-small`        | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-power-small-highside.glb`        | `power-small`        | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-pusher-slender.glb`              | `pusher`             | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 2/3 (bow)     |
| `loft-pusher-sheered.glb`              | `pusher`             | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 2/3 (bow)     |
| `loft-pusher-highside.glb`             | `pusher`             | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 2/3 (bow)     |
| `loft-restricted-ability-slender.glb`  | `restricted-ability` | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-restricted-ability-sheered.glb`  | `restricted-ability` | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-restricted-ability-highside.glb` | `restricted-ability` | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-sail-large-slender.glb`          | `sail-large`         | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-sail-large-sheered.glb`          | `sail-large`         | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-sail-large-highside.glb`         | `sail-large`         | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-sail-small-slender.glb`          | `sail-small`         | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-sail-small-sheered.glb`          | `sail-small`         | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-sail-small-highside.glb`         | `sail-small`         | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-seiner-slender.glb`              | `seiner`             | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-seiner-sheered.glb`              | `seiner`             | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-seiner-highside.glb`             | `seiner`             | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-square-rigger-slender.glb`       | `square-rigger`      | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-square-rigger-sheered.glb`       | `square-rigger`      | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-square-rigger-highside.glb`      | `square-rigger`      | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-tanker-slender.glb`              | `tanker`             | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-tanker-sheered.glb`              | `tanker`             | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-tanker-highside.glb`             | `tanker`             | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-trawler-slender.glb`             | `trawler`            | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-trawler-sheered.glb`             | `trawler`            | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-trawler-highside.glb`            | `trawler`            | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-tug-slender.glb`                 | `tug`                | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-tug-sheered.glb`                 | `tug`                | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-tug-highside.glb`                | `tug`                | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-warship-slender.glb`             | `warship`            | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-warship-sheered.glb`             | `warship`            | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-warship-highside.glb`            | `warship`            | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |
| `loft-wing-in-ground-slender.glb`      | `wing-in-ground`     | slender  | beam 0.8, sheer 0.06, freeboard 0.92, house 0.9                                                                       | 3/3           |
| `loft-wing-in-ground-sheered.glb`      | `wing-in-ground`     | sheered  | beam 1.05, sheer 0.22, freeboard 1, house 1                                                                           | 3/3           |
| `loft-wing-in-ground-highside.glb`     | `wing-in-ground`     | highside | beam 1.15, sheer 0.08, freeboard 1.25, house 1.3                                                                      | 3/3           |

- **Known gap:** `anchorLights` reads the lights' seats off the mesh, and
  for these meshes its reading misses the specs' hand-set stations (searoom's
  `hullRegistration.test.ts` records the misses). The drawings and the
  stations disagree; the mesh only makes it visible.

## `models/kenney-<kit-name>.glb`

Meshes from Kenney's [Watercraft Kit](https://kenney.nl/assets/watercraft-kit)
(`kenney_watercraft-pack.zip`, `Models/GLB format/`), one file per kit mesh
per hull it stands in for. Variety is the point: a hull may have several, and
a mesh is never dropped because another hull already has one
([docs/decisions.md](docs/decisions.md), 2026-09-16).

- **License:** CC0 1.0, per the kit's `License.txt`. Attribution is not
  required; it is given here anyway.
- **Rotation:** the kit is glTF Y-up with every hull's bow at `+Z`. Each file
  is baked into the Benchy convention above — Z up, bow on local `+X` — by
  a 120° turn about `(1,1,1)`: kit `+Z` → `+X`, `+Y` → `+Z`, `+X` → `+Y`.
  The turn is in the vertices; every node is left at identity. Scale and
  origin are the kit's (metre-ish units); `placeHullModel` rescales.
- **Bow end, per mesh:** measured, not assumed. "Plan narrows" means the
  hull's half-beam in the end 12% of its length is smaller at `+Z`; where
  the plan is square, the end whose keel rises (a cut-away forefoot) is the
  bow, and the side views were checked by eye where both tie.
- **Texture:** the kit's GLBs point at an external `Textures/colormap.png`;
  each file here embeds it, so a `.glb` stands alone.
- **Mesh check:** `test/hullMeshCheck.test.ts` over the raw kit (it reads
  glTF Y-up, so it runs on the kit's files, not these). Bow is the bow
  shoulder forward of midships, rail is stations-with-rail / rail gap, mast
  is the mast band's span over length; ✓ is inside the test's limits. The
  liners fail mast because they have two masts, not none
  ([docs/research/ship-ocean-liner-masthead.md](docs/research/ship-ocean-liner-masthead.md)).

| File                                | Kit file                                                              | License | Rotation (bow evidence)                                                                | Bow    | Rail      | Mast   | Check   |
| ----------------------------------- | --------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- | ------ | --------- | ------ | ------- |
| `kenney-boat-row-large.glb`         | [boat-row-large.glb](https://kenney.nl/assets/watercraft-kit)         | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.41 | ✓ 3/0.69  | ✓ 0.06 | **3/3** |
| `kenney-boat-row-small.glb`         | [boat-row-small.glb](https://kenney.nl/assets/watercraft-kit)         | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.54 | ✓ 10/0.25 | ✗ 0.46 | **2/3** |
| `kenney-boat-fan.glb`               | [boat-fan.glb](https://kenney.nl/assets/watercraft-kit)               | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.8  | ✓ 12/0.41 | ✓ 0.21 | **3/3** |
| `kenney-boat-speed-a.glb`           | [boat-speed-a.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.92 | ✓ 23/0.47 | ✓ 0.08 | **3/3** |
| `kenney-boat-speed-b.glb`           | [boat-speed-b.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.58 | ✓ 24/0.5  | ✓ 0.05 | **3/3** |
| `kenney-boat-speed-c.glb`           | [boat-speed-c.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.56 | ✓ 24/0.38 | ✗ 0.39 | **2/3** |
| `kenney-boat-speed-d.glb`           | [boat-speed-d.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.83 | ✓ 4/0.17  | ✓ 0.14 | **3/3** |
| `kenney-boat-speed-e.glb`           | [boat-speed-e.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.76 | ✓ 8/0.31  | ✓ 0.03 | **3/3** |
| `kenney-boat-speed-f.glb`           | [boat-speed-f.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.72 | ✓ 5/0.17  | ✗ 0.37 | **2/3** |
| `kenney-boat-speed-g.glb`           | [boat-speed-g.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.64 | ✓ 24/0.38 | ✗ 0.36 | **2/3** |
| `kenney-boat-speed-h.glb`           | [boat-speed-h.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.61 | ✓ 24/0.36 | ✓ 0.04 | **3/3** |
| `kenney-boat-speed-i.glb`           | [boat-speed-i.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.64 | ✓ 24/0.53 | ✓ 0.01 | **3/3** |
| `kenney-boat-speed-j.glb`           | [boat-speed-j.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.68 | ✓ 24/0.35 | ✓ 0.03 | **3/3** |
| `kenney-boat-house-a.glb`           | [boat-house-a.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (forefoot rises to +Z)                                                    | ✗ 0.96 | ✓ 19/0.54 | ✓ 0.33 | **2/3** |
| `kenney-boat-house-b.glb`           | [boat-house-b.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (forefoot rises to +Z; stern drive at −Z)                                 | ✓ 0.9  | ✓ 21/0.53 | ✗ 0.51 | **2/3** |
| `kenney-boat-house-c.glb`           | [boat-house-c.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (forefoot rises to +Z; stern drive at −Z)                                 | ✓ 0.88 | ✓ 21/0.66 | ✓ 0.13 | **3/3** |
| `kenney-boat-house-d.glb`           | [boat-house-d.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (forefoot rises to +Z)                                                    | ✗ 0.96 | ✓ 20/0.71 | ✗ 0.43 | **1/3** |
| `kenney-boat-sail-a.glb`            | [boat-sail-a.glb](https://kenney.nl/assets/watercraft-kit)            | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.65 | ✓ 21/0.79 | ✓ 0.14 | **3/3** |
| `kenney-boat-sail-b.glb`            | [boat-sail-b.glb](https://kenney.nl/assets/watercraft-kit)            | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.66 | ✓ 17/0.82 | ✓ 0.11 | **3/3** |
| `kenney-ship-large.glb`             | [ship-large.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.47 | ✓ 14/0.72 | ✓ 0.1  | **3/3** |
| `kenney-ship-small.glb`             | [ship-small.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.36 | ✓ 17/0.77 | ✓ 0.13 | **3/3** |
| `kenney-ship-small-ghost.glb`       | [ship-small-ghost.glb](https://kenney.nl/assets/watercraft-kit)       | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.36 | ✓ 17/0.75 | ✓ 0.13 | **3/3** |
| `kenney-boat-fishing-small.glb`     | [boat-fishing-small.glb](https://kenney.nl/assets/watercraft-kit)     | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.87 | ✓ 11/0.62 | ✓ 0.02 | **3/3** |
| `kenney-boat-tug-a.glb`             | [boat-tug-a.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.85 | ✓ 20/0.55 | ✓ 0.2  | **3/3** |
| `kenney-boat-tug-b.glb`             | [boat-tug-b.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.81 | ✓ 19/0.55 | ✓ 0.24 | **3/3** |
| `kenney-boat-tug-c.glb`             | [boat-tug-c.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.81 | ✓ 17/0.44 | ✓ 0.14 | **3/3** |
| `kenney-boat-tow-a.glb`             | [boat-tow-a.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan and keel symmetric; stern drive at −Z in side view)                 | ✓ 0.9  | ✓ 18/0.56 | ✗ 0.45 | **2/3** |
| `kenney-boat-tow-b.glb`             | [boat-tow-b.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan and keel symmetric; stern drive at −Z in side view)                 | ✓ 0.89 | ✓ 17/0.53 | ✓ 0.09 | **3/3** |
| `kenney-ship-cargo-a.glb`           | [ship-cargo-a.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.82 | ✓ 20/0.59 | ✓ 0.09 | **3/3** |
| `kenney-ship-cargo-b.glb`           | [ship-cargo-b.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.82 | ✓ 21/0.54 | ✓ 0.09 | **3/3** |
| `kenney-ship-cargo-c.glb`           | [ship-cargo-c.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.82 | ✓ 12/0.47 | ✓ 0.14 | **3/3** |
| `kenney-ship-ocean-liner.glb`       | [ship-ocean-liner.glb](https://kenney.nl/assets/watercraft-kit)       | CC0     | glTF +Z → +X (end bands tie; cut-away forefoot at +Z, funnels rake to −Z in side view) | ✓ 0.75 | ✓ 23/0.57 | ✗ 0.74 | **2/3** |
| `kenney-ship-ocean-liner-small.glb` | [ship-ocean-liner-small.glb](https://kenney.nl/assets/watercraft-kit) | CC0     | glTF +Z → +X (forefoot rises to +Z; funnels rake to −Z)                                | ✓ 0.64 | ✓ 21/0.57 | ✗ 0.63 | **2/3** |

## `models/kenney-<kit-name>.glb` from the Pirate Kit

Five more meshes from Kenney's [Pirate Kit](https://kenney.nl/assets/pirate-kit)
(`kenney_pirate-kit.zip`, `Models/GLB format/`, version 2.1), added under the
same ruling ([docs/decisions.md](docs/decisions.md), 2026-09-16) and baked the
same way as the Watercraft Kit above: Z up, bow on local `+X`, colormap
embedded, every node at identity. The kit's own `ship-large`, `ship-small` and
`boat-row-*` are re-exports of Watercraft Kit hulls already shipped and are not
repeated; `ship-wreck` is a derelict and is left out.

- **License:** CC0 1.0, per the kit's `License.txt`.
- **Bow end:** measured. In the baked file the half-beam in the end 12% of the
  length is 0.21 to 0.39 m at `+X` against 2.20 m at `-X`: the plan narrows to
  `+X`, the same reading as the Watercraft Kit ships.
- **Mesh check:** `test/hullMeshCheck.test.ts` over the raw kit files (glTF
  Y-up), as above; all five pass all three criteria. The galleons stand in for
  `squareRigger`, one of the eight hulls that had no sourced mesh; the medium
  and the ghost join `sailLarge`. The small one is taller than she is long
  (L:H 1:1.13), which overflows the `sailLarge` canvas by 4% in
  `test/viewFrame.test.ts`, so she stands in for `sailSmall` instead.

| File                            | Kit file                                                      | License | Rotation (bow evidence)           | Bow    | Rail      | Mast   | Check   |
| ------------------------------- | ------------------------------------------------------------- | ------- | --------------------------------- | ------ | --------- | ------ | ------- |
| `kenney-ship-pirate-large.glb`  | [ship-pirate-large.glb](https://kenney.nl/assets/pirate-kit)  | CC0     | glTF +Z → +X (plan narrows to +Z) | ✓ 0.47 | ✓ 15/0.72 | ✓ 0.1  | **3/3** |
| `kenney-ship-pirate-medium.glb` | [ship-pirate-medium.glb](https://kenney.nl/assets/pirate-kit) | CC0     | glTF +Z → +X (plan narrows to +Z) | ✓ 0.36 | ✓ 17/0.75 | ✓ 0.13 | **3/3** |
| `kenney-ship-pirate-small.glb`  | [ship-pirate-small.glb](https://kenney.nl/assets/pirate-kit)  | CC0     | glTF +Z → +X (plan narrows to +Z) | ✓ 0.21 | ✓ 17/0.72 | ✓ 0.15 | **3/3** |
| `kenney-ship-medium.glb`        | [ship-medium.glb](https://kenney.nl/assets/pirate-kit)        | CC0     | glTF +Z → +X (plan narrows to +Z) | ✓ 0.36 | ✓ 17/0.77 | ✓ 0.13 | **3/3** |
| `kenney-ship-ghost.glb`         | [ship-ghost.glb](https://kenney.nl/assets/pirate-kit)         | CC0     | glTF +Z → +X (plan narrows to +Z) | ✓ 0.36 | ✓ 17/0.75 | ✓ 0.13 | **3/3** |
