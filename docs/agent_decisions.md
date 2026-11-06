# Agent decisions

Append-only. Each entry is a call an agent made in pencil: a default it took
under the one-way-door test, with its undo. Written by `agent-decision`; the
heading is the UTC stamp, so `agent_decisions.md#<stamp>` links one entry.

### 20261016t022902z
- nav-wright B2: install line changed to 'npm install nav-wright'; undo: revert README commit 2b4ea1f (no PR, branch claude/B2-1016)

### 20261016t204444z
- nav-wright#54 slice 3: fact:wig routes to wingInGround after the propulsion checks and before the length bands, so an activity or sail fact outranks it Undo: move the fact:wig line in selectHull above the activity checks (no PR, branch claude/nw54-s3-1016p2)

### 20261016t204450z
- nav-wright#54 slice 3: the generic RAM hull (activity:ram) is drawn as a 60 m buoy tender with a crane over the quarter Undo: redraw restrictedAbility in src/hulls.tsx and rerun npm run models (no PR, branch claude/nw54-s3-1016p2)

### 20261016t204453z
- nav-wright#54 slice 3: the dive-support hull draws no Code A flag, because no hull draws flags yet Undo: draw a flag in the diveSupport profile when flags arrive for the other hulls (no PR, branch claude/nw54-s3-1016p2)

### 20261016t204456z
- nav-wright#54 slice 3 resume: wip commit 6ae3d14 was the styles slice, already merged with more as #106, so slice 3 started fresh from origin/main and did not build on it Undo: cherry-pick 6ae3d14 onto the branch (no PR, branch claude/nw54-s3-1016p2)

### 20261017t034912z
- Silhouette colour is the 2D hull hint fill #3a4a60, readable on a black sky. Undo: change SILHOUETTE_COLOR in src/silhouette.ts ([#120](https://github.com/mark-brannan/nav-wright/pull/120))

### 20261017t034921z
- The 3D view gets an opt-in seascape: a flat sea disc at the waterline in the 2D seascape's near colour #0a1424, driven by the playground's one seascape checkbox. Undo: drop the seascape prop and the Sea mesh from BearingModelView/BenchyModel ([#120](https://github.com/mark-brannan/nav-wright/pull/120))

### 20261017t034925z
- The spec block is built from the spec plus the placed lights: deck raised to the sidelights, a mast per light station and a yard to each outboard light, since the spec alone cannot hold Annex I heights or yard lights. Undo: rework specBlock in src/specBlock.ts ([#120](https://github.com/mark-brannan/nav-wright/pull/120))

### 20261017t034930z
- Silhouette B and C draw lights at their analytic spec positions (lightPosition), not re-seated by anchorLights. Undo: seat block lights with anchorLights in BlockHull's positions memo ([#120](https://github.com/mark-brannan/nav-wright/pull/120))

### 20261017t034934z
- Silhouette C feathers with 8 outward shells reaching 0.08 half-length, the block itself at full hull-hint opacity; no screen-space blur. Undo: change SOFT_LAYERS/SOFT_REACH in src/BenchyModel.tsx, or swap in a blur pass ([#120](https://github.com/mark-brannan/nav-wright/pull/120))

### 20261017t034939z
- The silhouette keeps the 3D view's perspective camera at tilt 0 rather than an orthographic one. Undo: give BenchyModel an orthographic camera when silhouette is set ([#120](https://github.com/mark-brannan/nav-wright/pull/120))

### 20261017t034943z
- Playground defaults the silhouette variant to All three side by side, and puts theta in the URL alongside view and variant. Undo: change initialVariant and drop set('theta', ...) in playground/main.tsx ([#120](https://github.com/mark-brannan/nav-wright/pull/120))

### 20261017t034947z
- Silhouette A uses whichever mesh the playground's 3D model picker holds (the hull's loft by default). Undo: pass a different modelUrl to the mesh silhouette in playground/main.tsx ([#120](https://github.com/mark-brannan/nav-wright/pull/120))

### 20261106t081857z
- nav-wright B5: between §10 bands the vertical fall is linear, from 100% at ±5° to the band's minimum at its edge (a lantern that just meets §10). Undo: change verticalIntensity ([#168](https://github.com/mark-brannan/nav-wright/pull/168))

### 20261106t081908z
- nav-wright B5: past the last §10 band a light falls linearly to nothing over 6.5° (§10(a), gone at 14°) and 15° (§10(b), gone at 40°), the research note's panel 5 end points. Undo: change VERTICAL_TAIL_DEG ([#168](https://github.com/mark-brannan/nav-wright/pull/168))

### 20261106t081919z
- nav-wright B5: every light takes one elevation, from the orbit centre (tilt and heel), not from its own height. Undo: compute elevation per light in lightIntensity ([#168](https://github.com/mark-brannan/nav-wright/pull/168))

### 20261106t081931z
- nav-wright B5: heel is positive to starboard, slider ±45 step 1, tips the whole model; arcs stay judged on theta, not re-projected into the heeled frame. Undo: change heelRotation or MAX_HEEL ([#168](https://github.com/mark-brannan/nav-wright/pull/168))

### 20261106t081941z
- nav-wright B5: §10(b) covers every light of a sailing vessel underway; §10(a) everything else, a sailing vessel at anchor included. Undo: change when/except_when in VERTICAL_SECTORS ([#168](https://github.com/mark-brannan/nav-wright/pull/168))

### 20261106t081953z
- nav-wright B5: §10 figures hand-typed rather than bumping the colregs pin from v0.3.9, which could move goldens. Undo: bump colregs to v0.3.10+ and read sectors.vertical ([#168](https://github.com/mark-brannan/nav-wright/pull/168))

### 20261106t082004z
- nav-wright B5: the vertical-sector fieldset sits last in the playground panel so the 12 renders stay byte-identical. Undo: move the fieldset ([#168](https://github.com/mark-brannan/nav-wright/pull/168))

### 20261106t085214z
- Filament bleed: the share runs linearly across a band centred on the division and the two sides sum to one. Undo: change filamentShare ([#169](https://github.com/mark-brannan/nav-wright/pull/169))

### 20261106t085231z
- Filament bleed: at a division the bleed replaces the Annex I 9(a) edge profile, a hard cut beyond the band; an edge no other member shares keeps the profile. Undo: drop the hard-cut branch in filamentIntensity ([#169](https://github.com/mark-brannan/nav-wright/pull/169))

### 20261106t085254z
- Filament bleed: a fixture is sourceEntry, fx and z, the key mergeLanterns uses. Undo: change fixtureOf ([#169](https://github.com/mark-brannan/nav-wright/pull/169))

### 20261106t085312z
- Filament bleed: the slider runs 0 to 10 degrees in steps of 0.5, with no recommended on value. Undo: change MAX_FILAMENT_BLEED or the step ([#169](https://github.com/mark-brannan/nav-wright/pull/169))

### 20261106t085330z
- Filament bleed: tricolour members keep their placed seats, so close up the bleed reads as two beads under shared halos. Undo: co-locate a fixture's members in placement ([#169](https://github.com/mark-brannan/nav-wright/pull/169))

### 20261106t085343z
- Filament bleed: the new playground fieldset sits last in the panel so renders stay byte-identical. Undo: move the fieldset ([#169](https://github.com/mark-brannan/nav-wright/pull/169))

### 20261106t093526z
- Screen skew moves only the sidelight's bow edge ([#170](https://github.com/mark-brannan/nav-wright/pull/170))

### 20261106t093544z
- Screen skew is one signed knob: one sidelight at a time ([#170](https://github.com/mark-brannan/nav-wright/pull/170))

### 20261106t093602z
- Combined lanterns are not skewed; no screen ([#170](https://github.com/mark-brannan/nav-wright/pull/170))

### 20261106t093620z
- Salt applies to every sidelight incl. combined members ([#170](https://github.com/mark-brannan/nav-wright/pull/170))

### 20261106t093638z
- Tired bulb applies to white lights only ([#170](https://github.com/mark-brannan/nav-wright/pull/170))
