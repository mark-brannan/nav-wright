# Security Policy

## Supported versions

This package is extracted and unreleased, not yet published to npm, and
maintained as a single moving line: only `main` gets fixes.

| Version | Supported |
| ------- | --------- |
| `main` | yes |
| a pinned commit | no — update to `main` first |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Report it
privately through GitHub:

1. Go to
   [Security → Report a vulnerability](https://github.com/mark-brannan/nav-wright/security/advisories/new).
2. Describe what you found, which component it's in, and how to reproduce it.

You should get an acknowledgement within a week. This is a spare-time project
maintained by one person, so a fix may take longer than that — you will be told
where it stands rather than left waiting. If a report is valid and you want
credit, you will be named in the advisory.

If you get no response at all within two weeks, open a public issue saying only
that you are waiting on a private report — no details — and it will be picked
up.

## What is in scope

This library renders SVG from caller-supplied data, and its consumers (such
as [searoom](https://github.com/mark-brannan/searoom)) may draw on live or
user-adjustable input rather than a fixed fixture.

- **`placeLights` and the SVG primitives** (`Glow`, `lightFill`, `polar`,
  `sectorPath`, and the scene components built from them). A `facts`,
  `hull`, or `lightsData` value that lets content escape into the page —
  reaching a DOM API, a style string, or an attribute in a way that isn't
  plain SVG geometry — is in scope, as is one that crashes rendering or
  drives unbounded work from a small input.
- **The `labels: SceneLabels` seam.** A caller-supplied label string is
  rendered as-is; anything that turns that into script execution rather than
  text is in scope.
- **The published package**, once it ships to npm — anything in `dist` that
  should not be there, or a discrepancy between npm and this repository at
  the corresponding tag.

## What is out of scope

- **The underlying lawful display.** A wrong set of lights for a fact record
  belongs to
  [colregs-engine](https://github.com/mark-brannan/colregs-engine/security);
  a wrong light definition or arc belongs to
  [colregs](https://github.com/mark-brannan/colregs/security).
- **A scene drawn incorrectly** because of a bug in `bearingInArc` or the hull
  geometry — that's an ordinary bug, not a vulnerability: open a public issue
  with the fact record and bearing that produced it.
- **The projection or styling a consumer supplies.** CSS custom properties and
  the classes this library emits are consumed by the caller's own
  stylesheet; what that stylesheet does is the caller's.
- **Navigational use.** This renders study-tool scenes and must not be used
  to make collision-avoidance decisions at sea.

## Notes on how this package is built

- No dependencies beyond `colregs-engine` (for its types) and a `react` peer
  dependency; it does no network or filesystem I/O.
- `test/labels.test.tsx` renders every scene component with no i18n provider,
  which is also what keeps the labels seam honest and testable in isolation.
- `npm test` runs against fixtures with the network unavailable.
