// The halo round each light on the 3D views: its size, its brightness and
// how it falls off towards its edge, for the 3D bearing view's tuning surface
// (#118). Leaving it off draws the original halo: one flat sphere,
// HALO_RADIUS bead radii across, at HALO_OPACITY.
//
// Falloff draws the halo as nested shells, each a little smaller, that sum
// to the flat halo's opacity at the centre and thin out towards the edge.
// Haze widens the halo and softens it together.

import type { PlacedLight } from './placement.js';
import type { GlowProfile } from './svg.js';
import { FLAT_GLOW } from './svg.js';

/** The flat halo's radius, in bead radii (lightRadius). */
export const HALO_RADIUS = 2.6;
/** The flat halo's opacity, before the light's intensity. */
export const HALO_OPACITY = 0.35;
/** How much wider haze 1 draws the halo: 1 + HAZE_WIDEN times. */
export const HAZE_WIDEN = 2;
/** Shells in a halo with any falloff. */
export const HALO_SHELLS = 8;

/** One light's halo: a radius and opacity multiplier on the flat halo, and a
 *  falloff 0 (flat) .. 1 (fading from the centre). */
export interface HaloProfile {
  scale: number;
  opacity: number;
  falloff: number;
}

export const FLAT_HALO: HaloProfile = { scale: 1, opacity: 1, falloff: 0 };

/** The halo for each light; see haloProfile. */
export type LightGlow = (light: PlacedLight) => HaloProfile;

const unit = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** One light's halo from the view's knobs. `glow` is the range-scaled glow
 *  (glowProfile), or the flat original. */
export function haloProfile({
  glowSize = 1,
  glowFalloff = 0,
  haze = 0,
  glow = FLAT_GLOW,
}: {
  glowSize?: number;
  glowFalloff?: number;
  haze?: number;
  glow?: GlowProfile;
}): HaloProfile {
  const h = unit(haze);
  const size = Number.isFinite(glowSize) ? Math.max(0, glowSize) : 1;
  return {
    scale: size * glow.scale * (1 + HAZE_WIDEN * h),
    opacity: glow.opacity,
    falloff: 1 - (1 - unit(glowFalloff)) * (1 - h),
  };
}

/** The spheres that draw a halo, outermost first: radius in bead radii and
 *  opacity before the light's intensity. Falloff 0 is the one flat sphere;
 *  otherwise HALO_SHELLS shells, each `falloff / HALO_SHELLS` of the full
 *  radius smaller than the last, summing to the flat opacity where all
 *  overlap. */
export function haloShells(p: HaloProfile): { radius: number; opacity: number }[] {
  const radius = HALO_RADIUS * p.scale;
  const opacity = HALO_OPACITY * p.opacity;
  const f = unit(p.falloff);
  if (f === 0) return [{ radius, opacity }];
  return Array.from({ length: HALO_SHELLS }, (_, k) => ({
    radius: radius * (1 - (f * k) / HALO_SHELLS),
    opacity: opacity / HALO_SHELLS,
  }));
}
