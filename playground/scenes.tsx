// Scene views: two vessels, a relative bearing and a range, with optional
// narrow-channel and traffic-lane backdrops. Both vessels wear the picked
// hull's lawful display.

import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { evaluateDisplay } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import { SceneView, allHulls, defaultSceneLabels, placeLights } from '../src/index.js';
import '../src/style.css';
import './playground.css';
import { hullFacts } from './hullFacts.js';
import type { HullKey } from './hullFacts.js';

const lightsData = lightsJson as unknown as LightsData;
const geometryData = geometryJson as unknown as GeometryData;
const hullKeys = Object.keys(allHulls) as HullKey[];

function Scenes() {
  const [hullKey, setHullKey] = useState<HullKey>('powerSmall');
  const [bearing, setBearing] = useState(45);
  const [rangeM, setRangeM] = useState(1500);
  const hull = allHulls[hullKey];
  const facts = hullFacts[hullKey];
  const placed = useMemo(() => {
    const display = evaluateDisplay(facts).displays[0];
    return display ? placeLights(display.lights, hull.spec, facts, lightsData, geometryData) : [];
  }, [facts, hull]);
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
