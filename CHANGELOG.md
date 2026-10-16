# Changelog

## [0.1.6](https://github.com/mark-brannan/nav-wright/compare/v0.1.5...v0.1.6) (2026-10-16)


### Added

* **lights:** opt-in single lantern, range-scaled glow and declared flash rate ([#47](https://github.com/mark-brannan/nav-wright/issues/47)) ([#100](https://github.com/mark-brannan/nav-wright/issues/100)) ([3165450](https://github.com/mark-brannan/nav-wright/commit/3165450ae586b1ab7722455a086e0537e803b0cf))
* **models:** five Kenney Pirate Kit ships, two for squareRigger ([#44](https://github.com/mark-brannan/nav-wright/issues/44)) ([#104](https://github.com/mark-brannan/nav-wright/issues/104)) ([b72feb7](https://github.com/mark-brannan/nav-wright/commit/b72feb709442066e03ebe22467b849fd619b90b6))

## [0.1.5](https://github.com/mark-brannan/nav-wright/compare/v0.1.4...v0.1.5) (2026-10-16)


### ⚠ BREAKING CHANGES

* **benchy:** BearingView hullHint takes a number, not a boolean.
* **bearing:** BearingView hullHint takes a number, not a boolean.

### Added

* **bearing:** hull hint strength and sky brightness ([#83](https://github.com/mark-brannan/nav-wright/issues/83)) ([5db995d](https://github.com/mark-brannan/nav-wright/commit/5db995de96d5099e5c498ef5ab368ec15dddddaa))
* **benchy:** BearingModelView, the bearing view and the 3D model in one (alt to [#87](https://github.com/mark-brannan/nav-wright/issues/87)) ([#88](https://github.com/mark-brannan/nav-wright/issues/88)) ([ecf02f8](https://github.com/mark-brannan/nav-wright/commit/ecf02f844c6c6bd5fcf4fc37ec49162c3d1d8dd6))
* **dev:** a playground page so nav-wright features are viewable in nav-wright ([#89](https://github.com/mark-brannan/nav-wright/issues/89)) ([18da19e](https://github.com/mark-brannan/nav-wright/commit/18da19e1fcdfbee9050f8e37cd1dd646edfef365))
* **dev:** host the playground on GitHub Pages ([#90](https://github.com/mark-brannan/nav-wright/issues/90)) ([0bc0639](https://github.com/mark-brannan/nav-wright/commit/0bc0639d8933ef0a00c19f7270cba00bd8ac9d16))
* **models:** a lofted 3D mesh for every hull, from its own drawings ([#82](https://github.com/mark-brannan/nav-wright/issues/82)) ([f0e7cde](https://github.com/mark-brannan/nav-wright/commit/f0e7cdec36ed7d7dc46479209b1abd87fa4cc69a))
* **models:** Kenney Watercraft Kit meshes for ten hulls ([#44](https://github.com/mark-brannan/nav-wright/issues/44)) ([#86](https://github.com/mark-brannan/nav-wright/issues/86)) ([039c6d1](https://github.com/mark-brannan/nav-wright/commit/039c6d1ded5778f2e2c5a34e487a9e6fa7d66ad1))
* **models:** three loft variants per hull ([#44](https://github.com/mark-brannan/nav-wright/issues/44)) ([#99](https://github.com/mark-brannan/nav-wright/issues/99)) ([6bb0188](https://github.com/mark-brannan/nav-wright/commit/6bb0188b82165130db337c9c438d19d3f66138c1))
* **placement:** place lights from Annex I geometry.json ([#98](https://github.com/mark-brannan/nav-wright/issues/98)) ([63f9c90](https://github.com/mark-brannan/nav-wright/commit/63f9c90b23dd10bfe20e435d902d678350b1a93c))
* **scene:** bearingTheta derives BearingView θ from the pair geometry ([#49](https://github.com/mark-brannan/nav-wright/issues/49) part 2) ([#102](https://github.com/mark-brannan/nav-wright/issues/102)) ([2546304](https://github.com/mark-brannan/nav-wright/commit/25463041d799900091def7a74ac21ba41a1578da))
* **scene:** course-and-speed vectors and a CPA marker in SceneView ([#49](https://github.com/mark-brannan/nav-wright/issues/49) part 3) ([#103](https://github.com/mark-brannan/nav-wright/issues/103)) ([e1f72f5](https://github.com/mark-brannan/nav-wright/commit/e1f72f546b62b82063dc6c186a94cef707f491dc))
* **scene:** two-vessel SceneView ([#49](https://github.com/mark-brannan/nav-wright/issues/49) part 1) ([#101](https://github.com/mark-brannan/nav-wright/issues/101)) ([c112c02](https://github.com/mark-brannan/nav-wright/commit/c112c0220fb6e10638f0f9d6b80a03b74e56affd))


### Fixed

* **benchy:** light cores over a partly faded hull ([#91](https://github.com/mark-brannan/nav-wright/issues/91)) ([1bb1140](https://github.com/mark-brannan/nav-wright/commit/1bb114002c1167cd70bf80409b03b7b7860e32cf))
* **ci:** hold publish on npm 11, not latest ([#80](https://github.com/mark-brannan/nav-wright/issues/80)) ([13b0b3b](https://github.com/mark-brannan/nav-wright/commit/13b0b3bacdbe73d637e5256489b5a1b4123a7af5))
* **placement:** read DisplayLight.source_entry, not the deprecated sourceEntry ([#71](https://github.com/mark-brannan/nav-wright/issues/71)) ([6f46aa0](https://github.com/mark-brannan/nav-wright/commit/6f46aa0154546d10ddbea6ef28c4809f4652afe0)), closes [#60](https://github.com/mark-brannan/nav-wright/issues/60)

## [0.1.4](https://github.com/mark-brannan/nav-wright/compare/v0.1.3...v0.1.4) (2026-10-11)


### Added

* **bearing:** opt-in night seascape with a range-faded, foreshortening hull hint ([#73](https://github.com/mark-brannan/nav-wright/issues/73)) ([b370a6c](https://github.com/mark-brannan/nav-wright/commit/b370a6cea137325ffc3f9accfbadc3c0be6cb58e)), closes [#48](https://github.com/mark-brannan/nav-wright/issues/48)
* export the station-profile API and scene-to-profile pipeline ([#53](https://github.com/mark-brannan/nav-wright/issues/53)) ([9fc68ad](https://github.com/mark-brannan/nav-wright/commit/9fc68ad8c2f2d4f4a8f97a99116b46812e12c691))


### Fixed

* **benchy:** fit the hull mesh to the spec's bow-to-stern span ([#72](https://github.com/mark-brannan/nav-wright/issues/72)) ([2bd1064](https://github.com/mark-brannan/nav-wright/commit/2bd10645093f186ffbe53228a9f28d975a28891b)), closes [#39](https://github.com/mark-brannan/nav-wright/issues/39)
* put the trawler and tug's after masthead above the forward one ([#43](https://github.com/mark-brannan/nav-wright/issues/43)) ([a3c760f](https://github.com/mark-brannan/nav-wright/commit/a3c760f99b8a4aa5f5975e36962969b3b60cf9bb))
* take colregs-engine from npm (^0.1.7) so publish stops failing EALLOWGIT ([#74](https://github.com/mark-brannan/nav-wright/issues/74)) ([2795f22](https://github.com/mark-brannan/nav-wright/commit/2795f22bf27b90a130bc10c478eb8605250c58ad)), closes [#56](https://github.com/mark-brannan/nav-wright/issues/56)
* tighten MAST_BAND to 0.95 so a deckhouse isn't read as the mast ([#46](https://github.com/mark-brannan/nav-wright/issues/46)) ([812a404](https://github.com/mark-brannan/nav-wright/commit/812a404ff3f2151432dd2a37b07137b109e27cd2)), closes [#36](https://github.com/mark-brannan/nav-wright/issues/36)

## [0.1.3](https://github.com/mark-brannan/nav-wright/compare/v0.1.2...v0.1.3) (2026-09-17)


### Added

* expand the hull roster from 9 to 18 base drawings ([#37](https://github.com/mark-brannan/nav-wright/issues/37)) ([4c0ef54](https://github.com/mark-brannan/nav-wright/commit/4c0ef549432d5f634f77f442beafd000a50e55cc))

## [0.1.2](https://github.com/mark-brannan/nav-wright/compare/v0.1.1...v0.1.2) (2026-09-12)


### Added

* add the 3D Benchy view as a nav-wright/benchy subpath export ([#30](https://github.com/mark-brannan/nav-wright/issues/30)) ([f20771b](https://github.com/mark-brannan/nav-wright/commit/f20771b69dd09b8bc53424da287279294140d800))
