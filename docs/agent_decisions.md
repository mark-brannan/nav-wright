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
