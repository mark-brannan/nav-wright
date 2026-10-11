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

## `models/<hull-id>-loft.glb`

One mesh per hull in `allHulls`, eighteen in all, lofted from that hull's
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
  `nav-wright/models/tug-loft.glb`.
- **Known gap:** `anchorLights` reads the lights' seats off the mesh, and
  for these meshes its reading misses the specs' hand-set stations (searoom's
  `hullRegistration.test.ts` records the misses). The drawings and the
  stations disagree; the mesh only makes it visible.

## `models/<hull-id>-kenney-<kit-name>.glb`

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

| File                                      | Kit file                                                              | License | Rotation (bow evidence)                                                                | Bow    | Rail      | Mast   | Check   |
| ----------------------------------------- | --------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- | ------ | --------- | ------ | ------- |
| `open-kenney-boat-row-large.glb`          | [boat-row-large.glb](https://kenney.nl/assets/watercraft-kit)         | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.41 | ✓ 3/0.69  | ✓ 0.06 | **3/3** |
| `open-kenney-boat-row-small.glb`          | [boat-row-small.glb](https://kenney.nl/assets/watercraft-kit)         | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.54 | ✓ 10/0.25 | ✗ 0.46 | **2/3** |
| `open-kenney-boat-fan.glb`                | [boat-fan.glb](https://kenney.nl/assets/watercraft-kit)               | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.8  | ✓ 12/0.41 | ✓ 0.21 | **3/3** |
| `power-small-kenney-boat-speed-a.glb`     | [boat-speed-a.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.92 | ✓ 23/0.47 | ✓ 0.08 | **3/3** |
| `power-small-kenney-boat-speed-b.glb`     | [boat-speed-b.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.58 | ✓ 24/0.5  | ✓ 0.05 | **3/3** |
| `power-small-kenney-boat-speed-c.glb`     | [boat-speed-c.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.56 | ✓ 24/0.38 | ✗ 0.39 | **2/3** |
| `power-small-kenney-boat-speed-d.glb`     | [boat-speed-d.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.83 | ✓ 4/0.17  | ✓ 0.14 | **3/3** |
| `power-small-kenney-boat-speed-e.glb`     | [boat-speed-e.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.76 | ✓ 8/0.31  | ✓ 0.03 | **3/3** |
| `power-small-kenney-boat-speed-f.glb`     | [boat-speed-f.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.72 | ✓ 5/0.17  | ✗ 0.37 | **2/3** |
| `power-small-kenney-boat-speed-g.glb`     | [boat-speed-g.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.64 | ✓ 24/0.38 | ✗ 0.36 | **2/3** |
| `power-small-kenney-boat-speed-h.glb`     | [boat-speed-h.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.61 | ✓ 24/0.36 | ✓ 0.04 | **3/3** |
| `power-small-kenney-boat-speed-i.glb`     | [boat-speed-i.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.64 | ✓ 24/0.53 | ✓ 0.01 | **3/3** |
| `power-small-kenney-boat-speed-j.glb`     | [boat-speed-j.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.68 | ✓ 24/0.35 | ✓ 0.03 | **3/3** |
| `power-large-kenney-boat-house-a.glb`     | [boat-house-a.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (forefoot rises to +Z)                                                    | ✗ 0.96 | ✓ 19/0.54 | ✓ 0.33 | **2/3** |
| `power-large-kenney-boat-house-b.glb`     | [boat-house-b.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (forefoot rises to +Z; stern drive at −Z)                                 | ✓ 0.9  | ✓ 21/0.53 | ✗ 0.51 | **2/3** |
| `power-large-kenney-boat-house-c.glb`     | [boat-house-c.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (forefoot rises to +Z; stern drive at −Z)                                 | ✓ 0.88 | ✓ 21/0.66 | ✓ 0.13 | **3/3** |
| `power-large-kenney-boat-house-d.glb`     | [boat-house-d.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (forefoot rises to +Z)                                                    | ✗ 0.96 | ✓ 20/0.71 | ✗ 0.43 | **1/3** |
| `sail-small-kenney-boat-sail-a.glb`       | [boat-sail-a.glb](https://kenney.nl/assets/watercraft-kit)            | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.65 | ✓ 21/0.79 | ✓ 0.14 | **3/3** |
| `sail-small-kenney-boat-sail-b.glb`       | [boat-sail-b.glb](https://kenney.nl/assets/watercraft-kit)            | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.66 | ✓ 17/0.82 | ✓ 0.11 | **3/3** |
| `sail-large-kenney-ship-large.glb`        | [ship-large.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.47 | ✓ 14/0.72 | ✓ 0.1  | **3/3** |
| `sail-large-kenney-ship-small.glb`        | [ship-small.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.36 | ✓ 17/0.77 | ✓ 0.13 | **3/3** |
| `sail-large-kenney-ship-small-ghost.glb`  | [ship-small-ghost.glb](https://kenney.nl/assets/watercraft-kit)       | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.36 | ✓ 17/0.75 | ✓ 0.13 | **3/3** |
| `trawler-kenney-boat-fishing-small.glb`   | [boat-fishing-small.glb](https://kenney.nl/assets/watercraft-kit)     | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.87 | ✓ 11/0.62 | ✓ 0.02 | **3/3** |
| `tug-kenney-boat-tug-a.glb`               | [boat-tug-a.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.85 | ✓ 20/0.55 | ✓ 0.2  | **3/3** |
| `tug-kenney-boat-tug-b.glb`               | [boat-tug-b.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.81 | ✓ 19/0.55 | ✓ 0.24 | **3/3** |
| `tug-kenney-boat-tug-c.glb`               | [boat-tug-c.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.81 | ✓ 17/0.44 | ✓ 0.14 | **3/3** |
| `tug-kenney-boat-tow-a.glb`               | [boat-tow-a.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan and keel symmetric; stern drive at −Z in side view)                 | ✓ 0.9  | ✓ 18/0.56 | ✗ 0.45 | **2/3** |
| `tug-kenney-boat-tow-b.glb`               | [boat-tow-b.glb](https://kenney.nl/assets/watercraft-kit)             | CC0     | glTF +Z → +X (plan and keel symmetric; stern drive at −Z in side view)                 | ✓ 0.89 | ✓ 17/0.53 | ✓ 0.09 | **3/3** |
| `container-ship-kenney-ship-cargo-a.glb`  | [ship-cargo-a.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.82 | ✓ 20/0.59 | ✓ 0.09 | **3/3** |
| `container-ship-kenney-ship-cargo-b.glb`  | [ship-cargo-b.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.82 | ✓ 21/0.54 | ✓ 0.09 | **3/3** |
| `container-ship-kenney-ship-cargo-c.glb`  | [ship-cargo-c.glb](https://kenney.nl/assets/watercraft-kit)           | CC0     | glTF +Z → +X (plan narrows to +Z)                                                      | ✓ 0.82 | ✓ 12/0.47 | ✓ 0.14 | **3/3** |
| `cruise-ship-kenney-ship-ocean-liner.glb` | [ship-ocean-liner.glb](https://kenney.nl/assets/watercraft-kit)       | CC0     | glTF +Z → +X (end bands tie; cut-away forefoot at +Z, funnels rake to −Z in side view) | ✓ 0.75 | ✓ 23/0.57 | ✗ 0.74 | **2/3** |
| `ferry-kenney-ship-ocean-liner-small.glb` | [ship-ocean-liner-small.glb](https://kenney.nl/assets/watercraft-kit) | CC0     | glTF +Z → +X (forefoot rises to +Z; funnels rake to −Z)                                | ✓ 0.64 | ✓ 21/0.57 | ✗ 0.63 | **2/3** |
