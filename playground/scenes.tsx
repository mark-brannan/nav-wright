// Scene views: two vessels, a relative bearing and a range, with optional
// narrow-channel and traffic-lane backdrops. Both vessels wear the picked
// hull's lawful display. The presets are colregs situation fixtures read
// through situationToScene, with the bearing view showing what own ship sees
// of the target.

import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { evaluateSignals, type Situation } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import situationJson from 'colregs/fixtures/situation-fixtures.json' with { type: 'json' };
import {
  BearingView,
  SceneView,
  allHulls,
  bearingTheta,
  defaultSceneLabels,
  placeLights,
  situationPair,
  situationToScene,
} from '../src/index.js';
import '../src/style.css';
import './playground.css';
import { hullFacts } from './hullFacts.js';
import type { HullKey } from './hullFacts.js';

const lightsData = lightsJson as unknown as LightsData;
const geometryData = geometryJson as unknown as GeometryData;
const hullKeys = Object.keys(allHulls) as HullKey[];

// The classic three, as colregs' own situation fixtures state them
const fixtures = (situationJson as unknown as { cases: { name: string; situation: Situation }[] })
  .cases;
const fixture = (prefix: string): Situation =>
  fixtures.find((c) => c.name.startsWith(prefix))!.situation;
const presets = {
  crossing: fixture('crossing: self power-driven'),
  'head-on': fixture('narrow channel: head-on'),
  overtaking: fixture('13 over 12: self overtaking'),
} as const;
type PresetKey = keyof typeof presets;
const presetKeys = Object.keys(presets) as PresetKey[];

function Scenes() {
  const [hullKey, setHullKey] = useState<HullKey>('powerSmall');
  const [bearing, setBearing] = useState(45);
  const [rangeM, setRangeM] = useState(1500);
  const hull = allHulls[hullKey];
  const facts = hullFacts[hullKey];
  const placed = useMemo(() => {
    const display = evaluateSignals(facts).displays[0];
    return display ? placeLights(display.lights, hull.spec, facts, lightsData, geometryData) : [];
  }, [facts, hull]);
  const [preset, setPreset] = useState<PresetKey>('crossing');
  const situation = presets[preset];
  const fromSituation = situationToScene(situation, {
    own: { hull, placed },
    target: { hull, placed },
  });
  const theta = bearingTheta(situationPair(situation));
  const own = { hull, placed, heading: 0, speedMps: 5 };
  const target = { hull, placed, heading: 270, speedMps: 5 };

  return (
    <div className="pg">
      <header>
        <h1>nav-wright scenes</h1>
        <nav className="tabs">
          <a href="./index.html">Playground</a>
          <a href="./gallery.html">Gallery</a>
          <a href="./scenes.html" aria-current="page">
            Scenes
          </a>
          <a href="./vessels.html">Vessels</a>
        </nav>
      </header>
      <section className="controls">
        <fieldset>
          <legend>Scene</legend>
          <label className="field">
            <span>allHulls</span>
            <select value={hullKey} onChange={(e) => setHullKey(e.target.value as HullKey)}>
              {hullKeys.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>relative bearing</span>
            <input
              type="range"
              min={0}
              max={359}
              value={bearing}
              onChange={(e) => setBearing(Number(e.target.value))}
            />
            <output>{bearing}</output>
          </label>
          <label className="field">
            <span>range m</span>
            <input
              type="range"
              min={200}
              max={5000}
              step={100}
              value={rangeM}
              onChange={(e) => setRangeM(Number(e.target.value))}
            />
            <output>{rangeM}</output>
          </label>
        </fieldset>
      </section>
      <section className="controls">
        <fieldset>
          <legend>Situation</legend>
          <label className="field">
            <span>preset</span>
            <select value={preset} onChange={(e) => setPreset(e.target.value as PresetKey)}>
              {presetKeys.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
        </fieldset>
      </section>
      <section className="views">
        <figure>
          <figcaption>situationToScene: {preset}</figcaption>
          <SceneView {...fromSituation} labels={defaultSceneLabels} />
        </figure>
        <figure>
          <figcaption>BearingView: own ship sees the target at θ {theta.toFixed(1)}°</figcaption>
          <BearingView
            hull={hull}
            placed={placed}
            theta={theta}
            onTheta={() => {}}
            hullHint={0.4}
            controls={false}
            labels={defaultSceneLabels}
          />
        </figure>
      </section>
      <section className="views">
        <figure>
          <figcaption>SceneView (crossing: target heading 270°)</figcaption>
          <SceneView
            own={own}
            target={target}
            relativeBearing={bearing}
            rangeM={rangeM}
            cpa={{ cpaM: 0, tcpaS: 212 }}
            labels={defaultSceneLabels}
          />
        </figure>
        <figure>
          <figcaption>SceneView with env: narrow channel and traffic lane</figcaption>
          <SceneView
            own={own}
            target={target}
            relativeBearing={bearing}
            rangeM={rangeM}
            env={{ narrowChannel: true, trafficLane: true }}
            labels={defaultSceneLabels}
          />
        </figure>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Scenes />
  </StrictMode>,
);
