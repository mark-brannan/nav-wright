// A representative fact record per hull, shared by the playground and the
// gallery.

import type { FactRecord } from 'colregs-engine';
import { allHulls } from '../src/index.js';

export type HullKey = keyof typeof allHulls;

// A fact record that shows each hull's kind of vessel, so picking a hull
// also gives it lights that belong on it. cruiseShip has no facts of its own
// (selectHull never picks it); it borrows a large fast power vessel's.
const underway = { 'fact:position': 'position:underway', 'fact:making_way': true } as const;
const power = { 'fact:propulsion': 'propulsion:power', 'fact:activity': 'activity:none' } as const;
export const hullFacts: Record<HullKey, FactRecord> = {
  openBoat: { ...power, ...underway, 'fact:propulsion': 'propulsion:oars', 'fact:length_m': 5 },
  powerSmall: { ...power, ...underway, 'fact:length_m': 12 },
  powerLarge: { ...power, ...underway, 'fact:length_m': 35 },
  sailSmall: { ...power, ...underway, 'fact:propulsion': 'propulsion:sail', 'fact:length_m': 12 },
  sailLarge: { ...power, ...underway, 'fact:propulsion': 'propulsion:sail', 'fact:length_m': 30 },
  squareRigger: {
    ...power,
    ...underway,
    'fact:propulsion': 'propulsion:sail',
    'fact:length_m': 60,
  },
  trawler: { ...power, ...underway, 'fact:activity': 'activity:trawling', 'fact:length_m': 30 },
  seiner: { ...power, ...underway, 'fact:activity': 'activity:fishing', 'fact:length_m': 30 },
  tug: {
    ...power,
    ...underway,
    'fact:activity': 'activity:towing',
    'fact:length_m': 30,
    'fact:tow_length_m': 150,
  },
  barge: { ...power, ...underway, 'fact:activity': 'activity:being_towed', 'fact:length_m': 40 },
  pilotBoat: { ...power, ...underway, 'fact:activity': 'activity:pilot', 'fact:length_m': 18 },
  ferry: { ...power, ...underway, 'fact:length_m': 90 },
  containerShip: { ...power, ...underway, 'fact:length_m': 250, 'fact:max_speed_kn': 22 },
  tanker: { ...power, ...underway, 'fact:activity': 'activity:cbd', 'fact:length_m': 200 },
  bulker: { ...power, ...underway, 'fact:length_m': 200, 'fact:max_speed_kn': 14 },
  cruiseShip: { ...power, ...underway, 'fact:length_m': 250, 'fact:max_speed_kn': 22 },
  warship: { ...power, ...underway, 'fact:activity': 'activity:mine', 'fact:length_m': 100 },
  dredger: {
    ...power,
    ...underway,
    'fact:activity': 'activity:ram_underwater',
    'fact:length_m': 60,
  },
};
