# 3D models

## `models/3dbenchy-lowpoly.glb`

3DBenchy — a small motor-cruiser-shaped calibration boat, used as the
stand-in hull for *every* vessel in the "Benchy" scene view, whatever her
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
