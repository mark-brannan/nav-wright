# AGENTS.md

Guidance for AI coding agents working in this repository.

## Stage: pre-consumer

Published on npm at 0.1.x. The only consumer is searoom, a private app Solace
owns and can fix in the same afternoon. Until Solace says otherwise that is a
fact, not an estimate, and not an agent's to re-evaluate. The family stanza in
colregs `AGENTS.md` is the long form; this is what it means here.

**Breaking changes need no ceremony.** Rename or drop a prop, change a component's
shape, restructure the exports, move or rename a model or a stylesheet, change
what `./style.css` contains — no deprecation window, no alias, no compatibility
shim, no paragraph weighing who might be hurt. Update searoom when it breaks.
`git revert` is the migration path.

**Stub as the safe default.** A component or export named in a design note gets
its export the same day, even if it renders nothing or throws. Withholding is the
failure mode, not the caution.

**Where the rigour goes instead.** The scene and model correctness — geometry,
units, orientation, what a viewer is actually being shown. That is the part
someone will eventually trust; the API around it is disposable.

**No hedging.** No disclaimers, no "may change", no sentence closing an option on
risk grounds. Risk is Solace's call, however small the decision looks. Write the
card; don't narrow the work.
