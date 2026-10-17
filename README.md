# nav-wright

Renderer for vessels, navigation lights, and rules-of-the-road scenes:
profile, bearing (lights-only, seen from a relative bearing θ) and plan
(arc sector) views in SVG, plus an optional 3D view of the vessel as an
orbitable model.

Try the playground! <https://mark-brannan.github.io/nav-wright/>.

Consumed by [searoom](https://github.com/mark-brannan/searoom):

- [searoom/docs/design.md](https://github.com/mark-brannan/searoom/blob/main/docs/design.md)
- **Live demo: <https://mark-brannan.github.io/searoom/>**

Sibling of:

- [coast-wright](https://github.com/mark-brannan/coast-wright)
- [wire-wright](https://github.com/mark-brannan/wire-wright)

## Install

```sh
npm install nav-wright
```

`react` is a peer dependency; `colregs-engine` comes along as a
dependency, for the `FactRecord` / `LightsData` / `Arc` types the renderer
is written against.

`three`, `@react-three/fiber` and `@react-three/drei` are **optional** peer
dependencies, needed only by `nav-wright/benchy` (below). Nothing in the
main entry point imports them, so a consumer who only renders the SVG views
installs none of them.

## What it exports

| Export                                                                                          | What it is                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectHull(facts)`, `allHulls`, `Hull`, `HullSpec`, `PX`, `PZ`                                 | the curated base-drawing set, and the profile-view coordinate mapping                                                                         |
| `placeLights(displayLights, hull, facts, lightsData, geometry?)` → `PlacedLight[]`              | a lawful display turned into lights positioned on a hull                                                                                      |
| `bearingInArc(bearing, arc)`                                                                    | is a light visible from this relative bearing — the exam-faithful part; arcs come verbatim from the data, not from geometry invented here     |
| `ProfileView`, `PlanView`, `BearingView`, `bearingLabel`                                        | the three scene components                                                                                                                    |
| `TowPlanView`, `TowProfileView`, `towGroupFromRecords`, `TowGroup`, `towThreshold`, `layoutTow` | a tow or pushed group (Rule 24) as one composition: every vessel with her own display (see [Tows and pushed groups](#tows-and-pushed-groups)) |
| `Glow`, `lightFill`, `LIGHT_COLORS`, `polar`, `sectorPath`                                      | the SVG primitives the views are built from                                                                                                   |
| `SceneLabels`, `defaultSceneLabels`, `Aspect`                                                   | the label interface                                                                                                                           |
| `ThetaControl`                                                                                  | the relative-bearing slider, shared with the 3D view                                                                                          |
| `hullStyles`, `hullStyleIds`, `HullStyle`, `HullStyleId`, `Fill`, `Hatch`, `Paint`              | the hull styles: ways to paint every hull (see [Hull styles](#hull-styles))                                                                   |

`placeLights` takes its light data as an argument rather than importing it,
so nothing here depends on a particular app's copy of the COLREGS data.
Give it colregs' `geometry.json` as the fifth argument and, for a vessel with
a `fact:length_m`, light heights and vertical separations follow Annex I
(masthead height by length band, the after masthead 4.5 m higher, sidelights
under three quarters of the masthead, vertical lights 2 m or 1 m apart). Each
light it places that way carries `heightM` and `basis` (the Annex I paragraphs,
e.g. `AnxI.2(a)(i)`) so a consumer can label it; anywhere the geometry is silent
the hull's hand anchors stand.

## The 3D view

`nav-wright/benchy` is a separate entry point, so that importing
`nav-wright` never pulls three.js into a bundle that has no use for it.
`test/entrypoints.test.ts` walks the import graph and fails if it ever
does.

```jsx
import { BenchyView } from 'nav-wright/benchy';
import modelUrl from 'nav-wright/models/3dbenchy-lowpoly.glb?url'; // Vite

<BenchyView
  modelUrl={modelUrl}
  hull={hull}
  placed={placed}
  facts={facts}
  theta={theta}
  onTheta={setTheta}
  tilt={tilt}
  onTilt={setTilt}
/>;
```

| Export                                | What it is                                                              |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `BenchyView`                          | the vessel as an orbitable 3D model, with her lights seated on the mesh |
| `DEFAULT_TILT`, `MAX_TILT`            | the camera-elevation range, for clamping app state against              |
| `TiltControl`                         | the camera-elevation slider                                             |
| `ModelErrorBoundary`                  | degrades a failed model load to a fallback rather than a blank pane     |
| `preloadBenchyModel(url)`             | warms the model cache; loads three.js on call, not on import            |
| `BenchyLabels`, `defaultBenchyLabels` | `SceneLabels` plus the 3D view's own labels                             |

**The model URL is a prop, not a built-in.** The package ships the mesh at
`nav-wright/models/3dbenchy-lowpoly.glb` (CC0 — see
[MODELS.md](MODELS.md) for provenance and the bow-orientation check the
renderer depends on), but a library cannot know how a consumer's bundler
turns an asset into a URL, so resolving it is the consumer's job. Copy it
into your own static assets and pass that path if you would rather not
resolve it through a bundler.

**The mesh is fitted to the hull's own span.** `hull` carries the spec's
`sternX` and `bowX`; the mesh is scaled so its length runs from one to the
other, not across the full length, so its stern, bow and heights share the
frame the spec's light stations are drawn in. Without a `hull` it is fitted
to the full length and centred.

A failed model load — offline, a blocked CDN, no WebGL context — falls back
to `ProfileView`, on the reasoning that the lights are the subject and
losing them is worse than losing the hull rendering.

## Tows and pushed groups

A `TowGroup` is a lead vessel and the hulls she tows or pushes, each a
`SceneVessel` with her own placed lights, so every vessel of the group keeps
her own lawful display. `towGroupFromRecords(lead, members, data)` builds one
from each vessel's fact record and the display the engine evaluated for it,
running `selectHull` and `placeLights` (and `placeShapes`, given shapes and
geometry data) per record. A member's tie comes from her `fact:tow_rigidity`
(24(f)), else from the lead: astern on a line, alongside, or pushed ahead.
With the lead's `fact:composite_unit`, the group is 24(b)'s one power-driven
vessel and only the lead's display is drawn. Her record then describes the
unit: `fact:length_m` is the whole unit's, so 23(a) is evaluated for that
length, and her own drawn length goes in the record's `lengthM`.

`TowPlanView` draws the group from above with each hull's arc rings, the tow
line or push contact, and the tow length against Rule 24(a)(i)'s threshold;
`TowProfileView` stands the hulls end to end on one waterline, lights by
night and day shapes by day. Neither hardcodes the threshold: pass
`towThreshold(applicabilityJson)`, which reads it, and the masthead counts on
either side of it, from colregs' towing entries.

colregs-engine 0.1.9 does not yet accept `fact:tow_rigidity` or
`fact:partly_submerged`, which colregs' 24(f) and 24(g) entries read, so
those vessels' displays cannot come from the engine until it does.

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

`BearingView`'s opt-in `seascape` presentation also reads `--bearing-sea-near`,
`--bearing-sea-far` and `--bearing-horizon`; each has a built-in fallback, so
defining them is optional.

The lights themselves are literal colors, not properties, so they are
correct whatever the consumer does. Everything else — hull, sea, rigging,
grid — is undefined until these are set. Whether nav-wright should ship a
default stylesheet is an open question, not a decision.

## Hull styles

A style is a set of variants for the whole roster, not a candidate in a
contest: every style ships, and each one paints all of `allHulls`. Pass one
to any view, and the same class can be drawn differently from one screen or
setting to the next:

```tsx
import { ProfileView, hullStyles } from 'nav-wright';

<ProfileView hull={hull} placed={placed} facts={facts} style={hullStyles.moonlit} />;
```

| Style     | Look                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `painted` | soft gradient fills on hull and sails, a dusk sky, the hull mirrored in sea |
| `plate`   | clean flat fills, engraved hatching, crisp ink lines: the pilot-book look   |
| `moonlit` | near-silhouette: dark forms, a cold rim of moonlight, the lights dominate   |

`ProfileView`, `PlanView` and `BearingView` take the optional `style`; given
none, a view draws the base drawing exactly as before. A style is a paint
layer over the base drawing, not a redrawing: it scopes `--hull-fill`,
`--hull-stroke`, `--rig-stroke` and the sea properties to one `<svg>`, points
them at its own gradients and patterns, and adds what the line drawings leave
out (sails, set only while the vessel is underway; a reflection) in the
drawing's own coordinates. No `HullSpec`
changes, so the lights land in the same place in every style, and the light
colours stay literal. In the bearing view a style paints only the hull hint
and the seascape; the sky and the lights are the exam view's.

The playground's gallery page (`npm run dev`, then `/gallery.html`; also on
the published playground) shows every hull in every style in all three views.

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm run build` is what emits `dist/` with types; it also runs on install
from a git ref via `prepare`, which is how the `github:` pin above works.

`npm run dev` opens the playground: every hull in every view, with each prop as a control.
The latest `main` is hosted at <https://mark-brannan.github.io/nav-wright/>.

`npm run render` builds the playground and photographs every scene in
`playground/namedScenes.json` in headless Chromium, WebGL included: one PNG
per scene in `renders/` (gitignored) plus `renders/contact-sheet.png`. The
first run needs a browser: `npx playwright install chromium`. CI runs it on
every pull request and uploads `renders/` as an artifact.
