# Changelog

## [0.1.11](https://github.com/mark-brannan/nav-wright/compare/v0.1.10...v0.1.11) (2026-10-31)


### Added

* **bearing-model:** glow, falloff, rangeGlow, visibility K and haze on the 3D view ([#154](https://github.com/mark-brannan/nav-wright/issues/154)) ([cf7ee7f](https://github.com/mark-brannan/nav-wright/commit/cf7ee7fb4a3530ba8421a882849bce8586cbaf4b))

## [0.1.10](https://github.com/mark-brannan/nav-wright/compare/v0.1.9...v0.1.10) (2026-10-17)


### Added

* **models:** export tracedVessels, the manifest of traced vessels and their meshes ([#140](https://github.com/mark-brannan/nav-wright/issues/140)) ([24d0b73](https://github.com/mark-brannan/nav-wright/commit/24d0b7394097a305d006aa09b447b020d3c31af9))
* **models:** loft the traced sailing vessels into 3D, and a vessels page to show them ([#137](https://github.com/mark-brannan/nav-wright/issues/137)) ([3e82e73](https://github.com/mark-brannan/nav-wright/commit/3e82e73ef1186351edbc2a3d314d050726f64cf3))
* **models:** the mesh catalog, one record per shipped mesh ([#147](https://github.com/mark-brannan/nav-wright/issues/147)) ([#151](https://github.com/mark-brannan/nav-wright/issues/151)) ([ebd336d](https://github.com/mark-brannan/nav-wright/commit/ebd336d5fee68a36005dd6155d38ce68dc87de09))

## [0.1.9](https://github.com/mark-brannan/nav-wright/compare/v0.1.8...v0.1.9) (2026-10-17)


### Added

* **goldens:** commit the render command's scene PNGs, scored by golden-diff ([#130](https://github.com/mark-brannan/nav-wright/issues/130)) ([#136](https://github.com/mark-brannan/nav-wright/issues/136)) ([06f1d2e](https://github.com/mark-brannan/nav-wright/commit/06f1d2e4142e65e5a5250019f2002800c2b9bfc0))
* **playground:** a checked-in list of named scenes as playground URLs ([#134](https://github.com/mark-brannan/nav-wright/issues/134)) ([91dab64](https://github.com/mark-brannan/nav-wright/commit/91dab6474a6837f295e662dd8a65188024324fb3))
* **playground:** copy the current look as BearingModelView / BearingView props ([#124](https://github.com/mark-brannan/nav-wright/issues/124)) ([#133](https://github.com/mark-brannan/nav-wright/issues/133)) ([0b511c4](https://github.com/mark-brannan/nav-wright/commit/0b511c4a8bffee01b0d7e2c8b7d1880fb6a11f88))
* **playground:** every control saved in the URL and restored on load ([#123](https://github.com/mark-brannan/nav-wright/issues/123)) ([#131](https://github.com/mark-brannan/nav-wright/issues/131)) ([385daa2](https://github.com/mark-brannan/nav-wright/commit/385daa288aecd5bc35326733fbe8aaf2da06731a))
* **render:** npm run render, scene list to PNGs and a contact sheet ([#128](https://github.com/mark-brannan/nav-wright/issues/128)) ([#135](https://github.com/mark-brannan/nav-wright/issues/135)) ([ca4d611](https://github.com/mark-brannan/nav-wright/commit/ca4d61188368e32b76b57655dbe2f99bf8738787))

## [0.1.8](https://github.com/mark-brannan/nav-wright/compare/v0.1.7...v0.1.8) (2026-10-17)


### Added

* **bearing:** sector-edge profile, range dropout and yaw on the 3D bearing view ([#118](https://github.com/mark-brannan/nav-wright/issues/118)) ([#121](https://github.com/mark-brannan/nav-wright/issues/121)) ([36cf77e](https://github.com/mark-brannan/nav-wright/commit/36cf77e073907289c3b6a6918a876933b4cee0de))
* **bearing:** tilt below the waterline, sea in 3D, 3D bearing view primary in the playground ([#116](https://github.com/mark-brannan/nav-wright/issues/116)) ([32ebbf9](https://github.com/mark-brannan/nav-wright/commit/32ebbf91d4af250921e6ec2a9e478a1881ab6096))
* **lights:** Annex I section 7 chromaticity for light colours, shared with the 3D view ([#47](https://github.com/mark-brannan/nav-wright/issues/47)) ([#110](https://github.com/mark-brannan/nav-wright/issues/110)) ([2f8faac](https://github.com/mark-brannan/nav-wright/commit/2f8faac30e8f19f6a00492f563f5ac2d2d5cbc9a))
* **playground:** 3D model as the primary view, and a silhouette with three variants ([#120](https://github.com/mark-brannan/nav-wright/issues/120)) ([ed45089](https://github.com/mark-brannan/nav-wright/commit/ed450891a0f4568be4e24d440647d8df1b3a4a57))

## [0.1.7](https://github.com/mark-brannan/nav-wright/compare/v0.1.6...v0.1.7) (2026-10-16)


### Added

* **hulls:** dive-support, wing-in-ground and restricted-ability hulls ([#54](https://github.com/mark-brannan/nav-wright/issues/54)) ([#109](https://github.com/mark-brannan/nav-wright/issues/109)) ([009d451](https://github.com/mark-brannan/nav-wright/commit/009d451c3f4a1c0d1c8e04fbaa43e00f17321a93))
* **hulls:** mine-clearance, fishing-with-gear-out and aground hulls ([#54](https://github.com/mark-brannan/nav-wright/issues/54)) ([#108](https://github.com/mark-brannan/nav-wright/issues/108)) ([9933778](https://github.com/mark-brannan/nav-wright/commit/9933778c1cd62b60f01f4390556ad05b9ec764d1))
* **scene:** optional narrow-channel / traffic-lane backdrop from env keys ([#49](https://github.com/mark-brannan/nav-wright/issues/49)) ([#113](https://github.com/mark-brannan/nav-wright/issues/113)) ([af249bc](https://github.com/mark-brannan/nav-wright/commit/af249bc95afcc026b5f85b11d26fc9f4341704dc))
* **shapes:** day shapes and a day time prop on profile and plan ([#52](https://github.com/mark-brannan/nav-wright/issues/52)) ([#111](https://github.com/mark-brannan/nav-wright/issues/111)) ([1c84534](https://github.com/mark-brannan/nav-wright/commit/1c84534a55a1f73088275b20454fefef7db5b4c1))
* **styles:** hull styles as roster variants, and a gallery of every hull in every style ([#54](https://github.com/mark-brannan/nav-wright/issues/54)) ([#106](https://github.com/mark-brannan/nav-wright/issues/106)) ([747326c](https://github.com/mark-brannan/nav-wright/commit/747326c610dbb28eb50237209d701cef8cd1faf7))
* **tow:** tow and pushed-group scenes, pusher and partly-submerged hulls ([#51](https://github.com/mark-brannan/nav-wright/issues/51)) ([#112](https://github.com/mark-brannan/nav-wright/issues/112)) ([c5b75de](https://github.com/mark-brannan/nav-wright/commit/c5b75de65f28ec1bd95d85c59c86f445f2764618))

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
