# Nav light realism: what the 2026-10-11 write-up touches that we have not captured

Review note, 2026-10-17, Fable session. Read against: the [2026-10-11 write-up](https://github.com/mark-brannan/claude_prompts_scratch/blob/main/state/global/research/2026-10-11-nav-light-reflections-spec.md), nav-wright #47 #93 #117 #118, PRs #100 #110 #116, `src/placement.ts` (`bearingInArc`, inclusive boundaries), `src/svg.tsx` (`glowProfile`, `Glow`), `src/BenchyModel.tsx` (`SceneLight`), `src/lantern.ts`, colregs `data/geometry.json` (`sectors`, `intensity`, `colors`). Mockups: [index.html](index.html) (live, the yaw dot moves), stills `1-aft-limit.png` to `6-shadow-sectors.png` beside it.

Annex I text cited below (§5, §9(a)(ii), §9(b), §10) is from memory of the 1972 Convention as amended; colregs `geometry.json` carries only §9(a)(i), §7 and §8. Verify against the corpus before any of it becomes a requirement.

## A. In the write-up, glossed or dropped on the way to #118

| # | The write-up says | What we captured | What slipped |
|---|---|---|---|
| 1 | Fade edges 111° full → 114° zero: a fade that straddles the limit | "fade width, a tunable between 1° and 3°"; PR 110 stopped on inside-vs-outside | Annex I puts the cut-off *outside* the sector: a dim red is lawfully visible 1° to 3° abaft the limit. Our cull draws nothing past it. The straddle is the write-up's guess; the tail outside is the rule and the real look. |
| 2 | "meet but not structurally overlap in the air" | Centreline blend only on the water (#93) | A 1° to 3° cut-off outside *each* sidelight's sector means a 2° to 6° band dead ahead where both show direct, not only in the reflection. The write-up's own shader cannot produce a centreline at all: it fades on the angle from the bow vector only (a cone), so with it both sidelights are visible across the whole bow. The screen plane is missing; that plane is exactly where real bleed lives. |
| 3 | "flickering" | Not captured as a mechanism | The flicker is yaw: a vessel in a seaway swings 5° to 10° either side of her course, sweeping every sector edge across the observer. Theta is static in every view; nothing animates it. This is the whole difficulty of reading aspect at a sector edge, at the bow and at 112.5°. |
| 4 | "Facet crossing: wave slopes outside the geometric dark zone catch light from the bright zone" | "blurs the sector edge on chop" | The sheen is a bearing integral. Near the observer it carries the direct colour; near the vessel it mixes across the edge, at *every* edge (red+white at the sidelight aft limit, white+white at masthead/sternlight). The mix is strongest at the vessel end of the column. We have it only as "dead ahead, yellow-brown". |
| 5 | Glow sprite opacity follows the same angular fade | Captured | The 3D `SceneLight` has no fade at all and no viewing-angle term; the sprite idea is still only on the flat view's `Glow`. |
| 6 | Atmospheric glow, moisture, spray | "haze sprite" | Haze also sets range (§8 assumes K = 0.8, roughly 13 nm visibility); in mist a 3 nm sidelight is a 1 nm sidelight, and white looms beyond its geometric range while colour does not. No visibility parameter anywhere. |

## B. Lawful profiles we render as hard edges (Annex I, not in geometry.json)

| # | Rule | Today | Realistic rendering |
|---|---|---|---|
| 7 | §9(a)(ii): sternlight, masthead, and the sidelight aft limit: full to 5° inside the limit, may fall to 50% at the limit, cut-off up to 5° outside | `bearingInArc` inclusive both ends: at exactly 112.5° masthead, sidelight and sternlight all draw at full; one degree either way, a hard swap | A 10° crossover band at 112.5° where a dim red, a dimming masthead and a rising sternlight overlap. Mockup panel 1. |
| 8 | §10 vertical sectors: power-driven full within ±5°, 60% at ±7.5°; sailing 50% at ±25° | "Tilt never changes which lights show" (BearingModelView doc). Tilt now runs −90..90 (PR 116) | Intensity falls with elevation. A heeled yacht: lee sidelight bright, weather one dim; a bridge looking down on a boat alongside sees little. Panel 5. |
| 9 | §9(b): an all-round light may be obscured by mast or structure up to 6° | All-rounds draw from every bearing | Shadow notches per light: 6° lawful; a radome, a furled jib or a deckhouse much more. Panel 6. The hull mesh could cast these for real, since lights are drawn with depth test off today. |
| 10 | §5: a combined lantern has "a single vertical filament and a very narrow division" instead of screens | `mergeLanterns` picks one colour; tie at 0° goes to the first listed (green) | The division is filament-width: a tricolour bleeds both colours over several degrees and reads orange-white dead ahead and pink-white at 112.5° (red→white). Panel 2, bottom strip. |

## C. Real degradations the write-up does not reach (candidates for the dirty mode)

| # | Phenomenon | Today | Note |
|---|---|---|---|
| 11 | Range dropout: a light beyond its luminous range is gone | `glowProfile` floors opacity at 0.35 past the reach, so a 1 nm sidelight is drawn at 7 nm | The classic cue: masthead lights only at 5 nm, sidelights appear at 2 to 3 nm. Panel 3. |
| 12 | Colour loss near threshold, and Purkinje: red is nearly invisible to rod vision | Colour is constant with range | Red desaturates to a dim warm point before it vanishes, and vanishes sooner than a green of equal intensity. Warm white (PR 110's `#ffb888`) and yellow are confusable at range; that is a real-world error worth teaching. |
| 13 | Glare scales with 1/d², not with reach | Glow radius scales with the light's Rule 22 reach: a 6 nm masthead at 6 nm is drawn wider than a 1 nm sidelight at 100 m | Close up a sidelight dazzles and blooms, washing its own colour; at range every light is a point and only brightness and colour differ. |
| 14 | Spill onto her own structure | Hull lit by a fixed blue "moonlight" directional | A genoa lit red or green from the pulpit lantern, the sternlight on the transom, deck lights on a trawler: these are aspect cues and they are the real light on the hull. No moon by default; the lights are the only illuminant. |
| 15 | Misaligned screens, salted lens, condensation, a tired bulb | Not modelled | The commonest real defects: a sidelight showing 5° to 10° across the bow, a dim diffuse red, a white masthead gone yellow. Unlawful-mode material (#117 item 5) with a tuning knob each. |
| 16 | Flash character | CSS `steps(1)`, square on/off | Incandescent flashes ramp and afterglow; LED is square. Minor. |
| 17 | Clutter | Black sky, black sea | Shore lights, other traffic, lit buoys, a city loom behind her. Beyond the write-up; the hardest real-world condition. Not for #118. |

## What this means for #118's tuning surface

The surface as drafted exposes five knobs (fade width, glow, reflection, centreline blend, haze). The physics above wants the fade to be a per-edge profile (inside taper, outside tail, in degrees) applied to direct light, sprite and sheen alike; a yaw animation; an elevation profile; a visibility (K) parameter that drives both range dropout and haze; and per-light shadow sectors and defects. Range dropout and glare-by-distance replace `glowProfile`'s reach-based curve rather than tune it. None of this is a ruling; it is the list of what a "dirty" mode would need to reach for, with the write-up's five as a subset.

## Data gap

colregs `geometry.json` `sectors` carries §9(a)(i) only. §9(a)(ii), §9(b) and §10 are the profiles nav-wright would read from; today they would have to be hand-typed. Filed as [colregs#228](https://github.com/mark-brannan/colregs/issues/228).
