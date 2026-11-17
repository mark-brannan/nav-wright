// Unlawful displays (#117 item 5): a vessel showing a set of lights no rule
// calls for, as presets of data rather than hand toggles. Each preset is
// applied to the placed lights a rule calls for, so every view draws it.
// Pure; placement and the rules are untouched.

import type { PlacedLight } from './placement.js';

export interface UnlawfulPreset {
  id: string;
  label: string;
  /** A light's colour by its light id, for a lantern fitted in another's place. */
  recolor?: Readonly<Record<string, string>>;
  /** Of each kind (light id and colour) drawn more than once, only the highest shows. */
  oneOfAKind?: boolean;
}

export const UNLAWFUL_PRESETS: readonly UnlawfulPreset[] = [
  { id: 'none', label: 'as the rule calls for' },
  {
    id: 'reversed-sidelights',
    label: 'sidelights reversed (red to starboard, green to port)',
    recolor: { 'light:sidelight_starboard': 'red', 'light:sidelight_port': 'green' },
  },
  {
    id: 'one-of-a-kind',
    label: 'one light of each kind, the others out',
    oneOfAKind: true,
  },
];

/** The preset with this id, or undefined. */
export const unlawfulPreset = (id: string): UnlawfulPreset | undefined =>
  UNLAWFUL_PRESETS.find((p) => p.id === id);

const kindOf = (l: PlacedLight) => `${l.lightId}|${l.color}`;

/** The lights `placed` shows under the preset. The same array when the
 *  preset is unknown or changes nothing, so `!==` says it made her unlawful. */
export function applyUnlawful(placed: PlacedLight[], presetId: string): PlacedLight[] {
  const preset = unlawfulPreset(presetId);
  if (!preset) return placed;
  let out = placed;
  if (preset.oneOfAKind) {
    const top = new Map<string, PlacedLight>();
    for (const l of out) {
      const k = kindOf(l);
      const held = top.get(k);
      if (!held || l.z > held.z) top.set(k, l);
    }
    const kept = out.filter((l) => top.get(kindOf(l)) === l);
    if (kept.length !== out.length) out = kept;
  }
  const recolor = preset.recolor;
  if (recolor && out.some((l) => l.lightId in recolor && recolor[l.lightId] !== l.color)) {
    out = out.map((l) =>
      l.lightId in recolor && recolor[l.lightId] !== l.color
        ? { ...l, color: recolor[l.lightId]! }
        : l,
    );
  }
  return out;
}
