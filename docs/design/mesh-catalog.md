# Mesh catalog

A lightweight design record for [#147](https://github.com/mark-brannan/nav-wright/issues/147),
run as a small curia: the current thinking below is edited in place as it
changes, each ruling gets a dated line under Decisions, and the open
questions stay listed until one closes them. Implementation lands in its own
PRs and never edits this file in the same PR.

## Purpose

nav-wright vends meshes; it must also vend a guide to what it vends. One
record per shipped `.glb` says what the file is, what real-world vessel it
depicts, how true to life it is, and where her lights mount, so a consumer
can pick a mesh for a scene, scale it honestly, light it correctly, and
project its 2D views, without reading file names.

The hull-id "families" (`open`, `power-small`, `tug`, `aground`…) go. They
were COLREGS rule clusters, not vessel types, and four of them (`aground`,
`partly-submerged`, `restricted-ability`, `fishing-gear`) are states. Every
grouping a consumer wants is a filter over the catalog.

## Current thinking

One sidecar per mesh, `models/<stem>.json`, hand-written for kit meshes and
generated for traced and lofted ones. The build folds them into
`models/catalog.json` and a typed `meshCatalog` export; both ship in the
package. File names lose the family prefix: `westsail-32.glb`,
`kenney-ship-pirate-large.glb`, `loft-tug-highside.glb`.

```json
{
  "file": "westsail-32.glb",
  "name": "Westsail 32",
  "kind": "traced",
  "fidelity": "traced",
  "source": {
    "trace": "docs/research/sailboat-lines/westsail-32.json",
    "url": "https://sailboatdata.com/sailboat/westsail-32/",
    "license": "AGPL-3.0"
  },
  "hullForm": "cutter, long keel, transom-hung rudder",
  "rig": "cutter",
  "propulsion": ["sail", "power"],
  "shows": ["sails", "bowsprit"],
  "loaM": 9.75,
  "beamM": 3.35,
  "draftM": 1.52,
  "nominal": false,
  "fitLengthM": [8, 12],
  "proportions": { "lengthBeam": 2.9, "lengthHeight": 0.72 },
  "frame": { "waterlineZ": 0, "hullX": [-1, 1] },
  "lights": { "masthead": [0.18, 0.86], "sidelight": [0.62, 0.21], "stern": [-0.97, 0.12] },
  "aisType": 36
}
```

Field by field:

- `kind`: provenance. `traced` (a real vessel's published drawing), `loft`
  (from this repo's invented 2D drawings), `kit` (a CC0 game kit),
  `calibration` (Benchy).
- `fidelity`: `traced`, `typical`, `stylised`, `calibration`. Four rungs,
  no numeric grade. Measured numbers sit beside it, never inside it.
- `hullForm`: what the hull was built as, in the source's own words. Not a
  taxonomy. Registration class and present activity are scene facts, not
  mesh facts: an old tug cruising as a yacht is a tug hull lit as a
  power-driven vessel.
- `propulsion`: what she can be driven by. `shows`: features visible on the
  mesh (`sails`, `towing-gear`, `trawl-gallows`, `cranes`, `funnel`…). A
  picker prefers a mesh whose features suit the scene's activity and never
  requires it.
- `loaM`, `beamM`, `draftM`: real for `traced`; a chosen nominal for `kit`
  and `loft`, marked `nominal: true`; null for `calibration`.
- `fitLengthM`: the band a scene may scale her to before the UI must say
  "scaled". Beyond it she is still allowed; the record just stops lying.
- `proportions`: measured from the mesh, length over beam and length over
  height above the waterline. A chibi kit mesh shows here as a number, next
  to its class's real ratio.
- `frame`: the mesh's own waterline and hull extent, duplicated into the
  glb extras so the renderer needs no catalog.
- `lights`: where each navigation light mounts on this mesh, in the hull's
  `[fx, z]` frame. Measured from the geometry, or set from the drawing.
- `aisType`: the ITU-R M.1371 ship-type code a real example would most
  likely declare. Optional, informative only; checked against the ITU table
  before use.

2D views are projections of the mesh: profile at any bearing, plan from
above. A script emits `-profile.svg` and `-plan.svg` per mesh; the
hand-drawn outlines in `src/hulls.tsx` retire as projections replace them.

## Open questions

- Which lofts stay as `typical` and which are culled: [#148](https://github.com/mark-brannan/nav-wright/issues/148), one pass, Solace's call per file.
- Whether a kit mesh fits a length by uniform scale or by stretching length only, holding beam real. One experiment.
- What `selectHull` becomes once selection is a catalog query, and where the 26 `HullSpec` station sets go when `lights` is per mesh.
- The `shows` vocabulary: fixed list or free text with a lint.

## Decisions

- 2026-10-17 — File names lose the hull-id prefix; `name` carries the vessel. Ruled by Solace in the #147 design session.
- 2026-10-17 — Kit meshes stay and are offered beside traced meshes, labelled by fidelity; revisit if proportions can't be made to look right. Ruled by Solace.
- 2026-10-17 — The catalog ships in the npm package, as JSON and a typed export. Ruled by Solace.
- 2026-10-17 — No invented type taxonomy; `hullForm` in the source's words, registration and activity stay scene facts. Solace's direction, Fable's shape.
