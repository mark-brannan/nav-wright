// Real defects in a vessel's lights (#117 item 5, gap 15 of the realism
// note): the commonest ways a fitted light stops looking like Annex I. Each
// is a knob from 0, today's picture, to the worst a viewer is likely to meet.
//
// - A misaligned screen: a sidelight's inboard screen bent or set wrong, so
//   the light shows across the bow. The bow edge of its arc moves that many
//   degrees past dead ahead; the aft edge stays. Positive skews the
//   starboard (green) light across to port, negative the port (red) light
//   across to starboard. Only a sidelight in its own lantern has a screen;
//   a combined lantern divides at a filament (filament.ts).
// - A salted lens: spray dried on a sidelight's lens. The light dims, and
//   the crust scatters it, so its halo is wider and softer.
// - A tired bulb: an incandescent run down, or on low voltage. Every white
//   light dims and goes yellow.
//
// These are looks, not Annex I: the figures below are judgement, picked to
// read at the playground's scale. Pure; placement is untouched.

import type { Arc } from 'colregs-engine/schema';
import type { PlacedLight } from './placement.js';
import type { HaloProfile } from './halo.js';
import { LIGHT_COLORS } from './svg.js';

/** The playground slider's reach, degrees across the bow either way. */
export const MAX_SCREEN_SKEW = 10;
/** How much of a sidelight's brightness a fully salted lens loses. */
export const SALT_DIM = 0.6;
/** How much wider a fully salted lens draws the halo: 1 + SALT_SPREAD times. */
export const SALT_SPREAD = 1.5;
/** How much of a white light's brightness a fully tired bulb loses. */
export const TIRED_DIM = 0.6;
/** The colour a white light reaches with a fully tired bulb. */
export const TIRED_WHITE = '#ffb000';

const STARBOARD = 'light:sidelight_starboard';
const PORT = 'light:sidelight_port';

const unit = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const skewOf = (n: number) =>
  Number.isFinite(n) ? Math.min(MAX_SCREEN_SKEW, Math.max(-MAX_SCREEN_SKEW, n)) : 0;

/** True for a sidelight, in its own lantern or a combined one. */
export const isSidelight = (light: PlacedLight) =>
  light.lightId === STARBOARD || light.lightId === PORT;

/** The light's arc with its screen skewed `skewDeg` across the bow: the
 *  starboard sidelight's from edge for positive, the port sidelight's to edge
 *  for negative. Every other light, a combined one, or 0, keeps its arc. */
export function screenArc(light: PlacedLight, skewDeg: number): Arc | null {
  const skew = skewOf(skewDeg);
  const arc = light.arc;
  if (!arc || skew === 0 || light.combined) return arc;
  if (skew > 0 && light.lightId === STARBOARD)
    return { ...arc, from_deg: (((arc.from_deg - skew) % 360) + 360) % 360 };
  if (skew < 0 && light.lightId === PORT)
    return { ...arc, to_deg: (((arc.to_deg - skew) % 360) + 360) % 360 };
  return arc;
}

/** The brightness 0..1 the defects leave a light: a salted sidelight and a
 *  tired white light dim; anything else stays at 1. */
export function defectIntensity(light: PlacedLight, salt: number, bulb: number): number {
  const s = isSidelight(light) ? unit(salt) : 0;
  const b = light.color === 'white' ? unit(bulb) : 0;
  return (1 - SALT_DIM * s) * (1 - TIRED_DIM * b);
}

/** The halo the defects leave a light: a salted sidelight's wider and
 *  softer, a tired white light's yellower. The halo it is handed otherwise. */
export function defectHalo(
  light: PlacedLight,
  halo: HaloProfile,
  salt: number,
  bulb: number,
): HaloProfile {
  const s = isSidelight(light) ? unit(salt) : 0;
  const b = light.color === 'white' ? unit(bulb) : 0;
  if (s === 0 && b === 0) return halo;
  return {
    ...halo,
    scale: halo.scale * (1 + SALT_SPREAD * s),
    falloff: 1 - (1 - halo.falloff) * (1 - s),
    ...(b > 0 ? { color: mixHex(LIGHT_COLORS.white!, TIRED_WHITE, b) } : {}),
  };
}

/** `a` to `b` by `t`, channel by channel, as #rrggbb. */
export function mixHex(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  const k = unit(t);
  return (
    '#' +
    [0, 1, 2]
      .map((i) =>
        Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
