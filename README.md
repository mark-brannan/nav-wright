# nav-wright

Renderer for vessels, navigation lights, and rules-of-the-road scenes:
profile, bearing (lights-only, seen from a relative bearing θ) and plan
(arc sector) views in SVG, plus an optional 3D view of the vessel as an
orbitable model. Sibling of
[coast-wright](https://github.com/mark-brannan/coast-wright) and
[wire-wright](https://github.com/mark-brannan/wire-wright).

**Status: extracted, unreleased.** The renderer was built inside
[searoom](https://github.com/mark-brannan/searoom) and moved here by
[searoom#18](https://github.com/mark-brannan/searoom/issues/18); searoom
becomes its first consumer once that issue's step 4 lands. Design:
[searoom/docs/design.md](https://github.com/mark-brannan/searoom/blob/main/docs/design.md).

## Install

```sh
npm install github:mark-brannan/nav-wright#<sha>
```

Not on npm. `react` is a peer dependency; `colregs-engine` comes along as a
dependency, for the `FactRecord` / `LightsData` / `Arc` types the renderer
is written against.

`three`, `@react-three/fiber` and `@react-three/drei` are **optional** peer
dependencies, needed only by `nav-wright/benchy` (below). Nothing in the
main entry point imports them, so a consumer who only renders the SVG views
installs none of them.

## What it exports

| Export | What it is |
| --- | --- |
| `selectHull(facts)`, `allHulls`, `Hull`, `HullSpec`, `PX`, `PZ` | the curated base-drawing set, and the profile-view coordinate mapping |
| `placeLights(displayLights, hull, facts, lightsData)` → `PlacedLight[]` | a lawful display turned into lights positioned on a hull |
| `bearingInArc(bearing, arc)` | is a light visible from this relative bearing — the exam-faithful part; arcs come verbatim from the data, not from geometry invented here |
| `ProfileView`, `PlanView`, `BearingView`, `bearingLabel` | the three scene components |
| `Glow`, `lightFill`, `LIGHT_COLORS`, `polar`, `sectorPath` | the SVG primitives the views are built from |
| `SceneLabels`, `defaultSceneLabels`, `Aspect` | the label interface |
| `ThetaControl` | the relative-bearing slider, shared with the 3D view |

`placeLights` takes its light data as an argument rather than importing it,
so nothing here depends on a particular app's copy of the COLREGS data.

## The 3D view

`nav-wright/benchy` is a separate entry point, so that importing
`nav-wright` never pulls three.js into a bundle that has no use for it.
`test/entrypoints.test.ts` walks the import graph and fails if it ever
does.

```jsx
import { BenchyView } from 'nav-wright/benchy';
import modelUrl from 'nav-wright/models/3dbenchy-lowpoly.glb?url'; // Vite

<BenchyView modelUrl={modelUrl} hull={hull} placed={placed} facts={facts}
            theta={theta} onTheta={setTheta} tilt={tilt} onTilt={setTilt} />
```

| Export | What it is |
| --- | --- |
| `BenchyView` | the vessel as an orbitable 3D model, with her lights seated on the mesh |
| `DEFAULT_TILT`, `MAX_TILT` | the camera-elevation range, for clamping app state against |
| `TiltControl` | the camera-elevation slider |
| `ModelErrorBoundary` | degrades a failed model load to a fallback rather than a blank pane |
| `preloadBenchyModel(url)` | warms the model cache; loads three.js on call, not on import |
| `BenchyLabels`, `defaultBenchyLabels` | `SceneLabels` plus the 3D view's own labels |

**The model URL is a prop, not a built-in.** The package ships the mesh at
`nav-wright/models/3dbenchy-lowpoly.glb` (CC0 — see
[MODELS.md](MODELS.md) for provenance and the bow-orientation check the
renderer depends on), but a library cannot know how a consumer's bundler
turns an asset into a URL, so resolving it is the consumer's job. Copy it
into your own static assets and pass that path if you would rather not
resolve it through a bundler.

A failed model load — offline, a blocked CDN, no WebGL context — falls back
to `ProfileView`, on the reasoning that the lights are the subject and
losing them is worse than losing the hull rendering.

## Labels

The scene components carry no i18n framework. Each takes an optional
`labels: SceneLabels` prop and falls back to `defaultSceneLabels`, which is
English. A consumer with a real catalog builds a `SceneLabels` from it and
passes it down — that is how searoom wires its `react-intl` messages in.
`test/labels.test.tsx` renders all three components with no provider around
them, which is what keeps this seam honest.

## Styling

The components emit their own class names and read colors from CSS custom
properties; they ship no stylesheet. A consumer must define:

- properties: `--hull-fill`, `--hull-stroke`, `--rig-stroke`, `--sea-night`,
  `--sea-below`, `--waterline`, `--grid-line`, `--accent-soft`
- classes: `scene-svg`, `scene-svg-black`, `plan-svg`, `bearing-view`,
  `bearing-empty`, `theta-control`, `theta-readout`, and `light-flash` for
  the flashing-light animation; `nav-wright/benchy` additionally uses
  `model-view`, `scene-3d` and `scene-3d-stack`

The lights themselves are literal colors, not properties, so they are
correct whatever the consumer does. Everything else — hull, sea, rigging,
grid — is undefined until these are set. Whether nav-wright should ship a
default stylesheet is an open question, not a decision.

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm run build` is what emits `dist/` with types; it also runs on install
from a git ref via `prepare`, which is how the `github:` pin above works.
