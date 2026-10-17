// The silhouette: the hull flattened to one dark shape, seen from the
// viewer's relative bearing at the waterline's level, so the lights carry
// the picture. Between the lights-only bearing view, which has no hull
// shape, and the side-only profile. Drawn by BearingModelView in the 3D
// scene, so it shares that view's sky, sea, range and hull hint.

/**
 * How the silhouette's shape is made:
 * - `mesh`: her own 3D mesh, drawn in one unlit colour.
 * - `block`: a rough, blocky hull built from her spec — the stations her
 *   lights are placed at — so every light sits on it (see specBlock).
 * - `soft`: the block with feathered edges, so the lights stand out most.
 */
export type SilhouetteVariant = 'mesh' | 'block' | 'soft';

export const SILHOUETTE_VARIANTS: readonly SilhouetteVariant[] = ['mesh', 'block', 'soft'];

/** The silhouette's one colour: the 2D bearing view's hull hint fill. */
export const SILHOUETTE_COLOR = '#3a4a60';

/** The 3D sea: the 2D seascape's near colour. */
export const SEA_COLOR = '#0a1424';
