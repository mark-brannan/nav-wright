// The style gallery: every hull in every style, in all three views, lights
// lit from each hull's representative facts. Every style is on the page at
// once; there is nothing to pick.

import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { evaluateDisplay } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import {
  PlanView,
  ProfileView,
  allHulls,
  hullStyleIds,
  hullStyles,
  placeLights,
} from '../src/index.js';
import type { HullStyle } from '../src/index.js';
import { BearingScene } from '../src/BearingView.js';
import '../src/style.css';
import './playground.css';
import { hullFacts } from './hullFacts.js';
import type { HullKey } from './hullFacts.js';

const lightsData = lightsJson as unknown as LightsData;
const geometryData = geometryJson as unknown as GeometryData;
const hullKeys = Object.keys(allHulls) as HullKey[];

/** Rows of each hull's block: the base drawing (what a view draws given no
 *  style), then every shipped style. */
const rows: { key: string; name: string; note: string; style?: HullStyle }[] = [
  { key: 'base', name: 'Base drawing', note: 'No style passed.' },
  ...hullStyleIds.map((id) => ({
    key: id,
    name: hullStyles[id].name,
    note: hullStyles[id].note,
    style: hullStyles[id],
  })),
];

function Row({ hullKey, style }: { hullKey: HullKey; style?: HullStyle }) {
  const hull = allHulls[hullKey];
  const facts = hullFacts[hullKey];
  const [theta, setTheta] = useState(60);
  const placed = useMemo(() => {
    const display = evaluateDisplay(facts).displays[0];
    return display ? placeLights(display.lights, hull.spec, facts, lightsData, geometryData) : [];
  }, [hull, facts]);
  return (
    <div className="gallery-views">
      <ProfileView hull={hull} placed={placed} facts={facts} style={style} />
      <PlanView hull={hull} placed={placed} theta={theta} onTheta={setTheta} style={style} />
      <BearingScene
        hull={hull}
        placed={placed}
        theta={theta}
        onTheta={setTheta}
        hullHint={1}
        seascape
        style={style}
      />
    </div>
  );
}

function Gallery() {
  return (
    <div className="pg gallery">
      <header>
        <h1>nav-wright gallery</h1>
        <span className="muted">
          {hullKeys.length} hulls × {hullStyleIds.length} styles, plus the base drawing. Profile,
          plan, and the bearing view from θ (drag the plan or the bearing view).
        </span>
        <a href="./index.html">Playground</a>
      </header>
      {hullKeys.map((k) => (
        <section key={k} className="gallery-hull" id={allHulls[k].spec.id}>
          <h2>
            {k} <span className="muted">{allHulls[k].spec.id}</span>
          </h2>
          {rows.map((r) => (
            <figure key={r.key} className="gallery-row">
              <figcaption>
                <strong>{r.name}</strong> <span className="muted">{r.note}</span>
              </figcaption>
              <Row hullKey={k} style={r.style} />
            </figure>
          ))}
        </section>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
