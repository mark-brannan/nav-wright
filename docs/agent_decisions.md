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
