// The style gallery: every hull in every style, in all three views, lights
// lit from each hull's representative facts. Every style is on the page at
// once; there is nothing to pick.

import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { evaluateSignals } from 'colregs-engine';
import type { FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import shapesJson from 'colregs/data/shapes.json' with { type: 'json' };
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import applicabilityJson from 'colregs/data/applicability.json' with { type: 'json' };
import {
  PlanView,
  ProfileView,
  TowPlanView,
  TowProfileView,
  towGroupFromRecords,
  towThreshold,
  allHulls,
  hullStyleIds,
  hullStyles,
  placeLights,
  placeShapes,
} from '../src/index.js';
import type { HullStyle, ShapesData } from '../src/index.js';
import { BearingScene } from '../src/BearingView.js';
import '../src/style.css';
import './playground.css';
import { hullFacts } from './hullFacts.js';
import type { HullKey } from './hullFacts.js';

const lightsData = lightsJson as unknown as LightsData;
const geometryData = geometryJson as unknown as GeometryData;
const shapesData = shapesJson as unknown as ShapesData;
const hullKeys = Object.keys(allHulls) as HullKey[];
const threshold = towThreshold(applicabilityJson as unknown as { entries: unknown[] });

/** Rule 24 groups, each vessel lit from her own record. A pushed group that
 *  is not a composite unit is left out: its barge needs fact:tow_rigidity
 *  (24(f)), which the engine's fact vocabulary does not have yet. */
const underwayFacts = { 'fact:position': 'position:underway', 'fact:making_way': true };
interface TowCase {
  id: string;
  name: string;
  /** what the data leaves out, said under the name */
  note?: string;
  lead: object;
  /** the lead's own drawn length, where her record's is the unit's */
  leadLengthM?: number;
  members: object[];
}
const tows: TowCase[] = [150, 250]
  .map(
    (towM): TowCase => ({
      id: `tow-${towM}`,
      name: `Tug and barge, ${towM} m tow`,
      lead: {
        ...underwayFacts,
        'fact:propulsion': 'propulsion:power',
        'fact:activity': 'activity:towing',
        'fact:length_m': 30,
        'fact:tow_length_m': towM,
      },
      members: [
        {
          ...underwayFacts,
          'fact:activity': 'activity:being_towed',
          'fact:length_m': 40,
          'fact:tow_length_m': towM,
        },
      ],
    }),
  )
  .concat([
    {
      id: 'tow-composite',
      name: 'Composite unit, lit as one power-driven vessel (24(b))',
      lead: {
        ...underwayFacts,
        'fact:propulsion': 'propulsion:power',
        'fact:activity': 'activity:pushing',
        'fact:composite_unit': true,
        // the unit's length: 24(b) lights it as one 100 m vessel
        'fact:length_m': 100,
      },
      leadLengthM: 30,
      members: [{ ...underwayFacts, 'fact:activity': 'activity:being_towed', 'fact:length_m': 70 }],
    },
    {
      id: 'tow-partly-submerged',
      name: 'Tug and a partly submerged object (24(g)), 180 m tow',
      note: "the object is unlit: colregs has no text for 24(g)(i)'s lights yet",
      lead: {
        ...underwayFacts,
        'fact:propulsion': 'propulsion:power',
        'fact:activity': 'activity:towing',
        'fact:length_m': 30,
        'fact:tow_length_m': 180,
      },
      members: [
        {
          ...underwayFacts,
          'fact:inconspicuous_partly_submerged_tow': true,
          'fact:length_m': 60,
        },
      ],
    },
  ]);

function TowRow({ tow, time }: { tow: TowCase; time: 'day' | 'night' }) {
  const group = useMemo(() => {
    const rec = (f: object) => {
      const facts = (time === 'day' ? { ...f, 'fact:time': 'time:day' } : f) as FactRecord;
      return { facts, display: evaluateSignals(facts).displays[0]! };
    };
    return towGroupFromRecords(
      { ...rec(tow.lead), lengthM: tow.leadLengthM },
      tow.members.map(rec),
      {
        lights: lightsData,
        geometry: geometryData,
        shapes: shapesData,
      },
    );
  }, [tow, time]);
  return (
    <div className="gallery-views gallery-tow">
      <TowProfileView group={group} threshold={threshold} time={time} />
      <TowPlanView group={group} threshold={threshold} />
    </div>
  );
}

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

function Row({
  hullKey,
  style,
  time,
}: {
  hullKey: HullKey;
  style?: HullStyle;
  time: 'day' | 'night';
}) {
  const hull = allHulls[hullKey];
  const base = hullFacts[hullKey];
  // Day states fact:time, which is what makes the engine return shapes.
  const facts = useMemo(
    () => (time === 'day' ? ({ ...base, 'fact:time': 'time:day' } as FactRecord) : base),
    [base, time],
  );
  const [theta, setTheta] = useState(60);
  const { placed, shapes } = useMemo(() => {
    const display = evaluateSignals(facts).displays[0];
    return {
      placed: display
        ? placeLights(display.lights, hull.spec, facts, lightsData, geometryData)
        : [],
      shapes: display
        ? placeShapes(display.shapes, hull.spec, facts, shapesData, geometryData)
        : [],
    };
  }, [hull, facts]);
  return (
    <div className="gallery-views">
      <ProfileView
        hull={hull}
        placed={placed}
        facts={facts}
        style={style}
        time={time}
        shapes={shapes}
      />
      <PlanView
        hull={hull}
        placed={placed}
        theta={theta}
        onTheta={setTheta}
        style={style}
        time={time}
        shapes={shapes}
      />
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
  // ?day opens in daylight, so a day view has a link
  const [day, setDay] = useState(() => new URLSearchParams(location.search).has('day'));
  return (
    <div className="pg gallery">
      <header>
        <h1>nav-wright gallery</h1>
        <nav className="tabs">
          <a href="./index.html">Playground</a>
          <a href="./gallery.html" aria-current="page">
            Gallery
          </a>
          <a href="./scenes.html">Scenes</a>
          <a href="./vessels.html">Vessels</a>
        </nav>
        <span className="muted">
          {hullKeys.length} hulls × {hullStyleIds.length} styles, plus the base drawing. Profile,
          plan, and the bearing view from θ (drag the plan or the bearing view).
        </span>
        <label>
          <input type="checkbox" checked={day} onChange={(e) => setDay(e.target.checked)} /> Day
        </label>
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
              <Row hullKey={k} style={r.style} time={day ? 'day' : 'night'} />
            </figure>
          ))}
        </section>
      ))}
      <section className="gallery-hull" id="tows">
        <h2>
          Tows and pushed groups <span className="muted">Rule 24</span>
        </h2>
        {tows.map((t) => (
          <figure key={t.id} className="gallery-row" id={t.id}>
            <figcaption>
              <strong>{t.name}</strong>
              {t.note && <span className="muted"> {t.note}</span>}
            </figcaption>
            <TowRow tow={t} time={day ? 'day' : 'night'} />
          </figure>
        ))}
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
