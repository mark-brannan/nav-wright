// nav-wright's own page: every hull, every view, every prop as a plain
// control, fed by colregs-engine directly. Imports ../src, not dist.

import { StrictMode, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { evaluateDisplay } from 'colregs-engine';
import type { DisplayEvaluation, FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import {
  BearingView,
  PlanView,
  ProfileView,
  allHulls,
  defaultSceneLabels,
  placeLights,
  selectHull,
} from '../src/index.js';
import { BenchyView, DEFAULT_TILT, defaultBenchyLabels } from '../src/benchy.js';
import '../src/style.css';
import './playground.css';

const lightsData = lightsJson as unknown as LightsData;
const geometryData = geometryJson as unknown as GeometryData;

type HullKey = keyof typeof allHulls;
const hullKeys = Object.keys(allHulls) as HullKey[];

// Every .glb the package ships, by file name.
const modelUrls = import.meta.glob<string>('../models/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});
const models = Object.fromEntries(
  Object.entries(modelUrls).map(([path, url]) => [path.split('/').pop()!, url]),
);
const modelNames = Object.keys(models).sort();

function defaultModel(hullId: string): string {
  const loft = `${hullId}-loft.glb`;
  return loft in models ? loft : '3dbenchy-lowpoly.glb';
}

// A fact record that shows each hull's kind of vessel, so picking a hull
// also gives it lights that belong on it. cruiseShip has no facts of its own
// (selectHull never picks it); it borrows a large fast power vessel's.
const underway = { 'fact:position': 'position:underway', 'fact:making_way': true } as const;
const power = { 'fact:propulsion': 'propulsion:power', 'fact:activity': 'activity:none' } as const;
const hullFacts: Record<HullKey, FactRecord> = {
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

const PROPULSIONS = ['propulsion:power', 'propulsion:sail', 'propulsion:oars'];
const ACTIVITIES = [
  'activity:none',
  'activity:fishing',
  'activity:trawling',
  'activity:towing',
  'activity:pushing',
  'activity:being_towed',
  'activity:nuc',
  'activity:ram',
  'activity:ram_underwater',
  'activity:cbd',
  'activity:mine',
  'activity:pilot',
  'activity:diving',
];
const POSITIONS = ['position:underway', 'position:anchored', 'position:aground', 'position:moored'];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Range({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <span className="range">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>{value}</output>
    </span>
  );
}

function Playground() {
  const [hullKey, setHullKey] = useState<HullKey>('powerSmall');
  const [facts, setFacts] = useState<FactRecord>(hullFacts.powerSmall);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [additionsOn, setAdditionsOn] = useState<string[]>([]);
  const [model, setModel] = useState(defaultModel(allHulls.powerSmall.spec.id));
  const [theta, setTheta] = useState(45);
  const [tilt, setTilt] = useState(DEFAULT_TILT);
  const [hullHint, setHullHint] = useState(0.5);
  const [rangeOn, setRangeOn] = useState(false);
  const [range, setRange] = useState(1);
  const [sky, setSky] = useState(0);
  const [seascape, setSeascape] = useState(false);
  const [labelsOn, setLabelsOn] = useState(true);

  const hull = allHulls[hullKey];

  const pickHull = (k: HullKey) => {
    setHullKey(k);
    setFacts(hullFacts[k]);
    setDisplayIndex(0);
    setAdditionsOn([]);
    setModel(defaultModel(allHulls[k].spec.id));
  };

  const patchFacts = (p: Partial<Record<string, string | number | boolean | undefined>>) => {
    const next: Record<string, unknown> = { ...facts, ...p };
    // making_way refines position:underway; the engine refuses it otherwise
    if (next['fact:position'] !== 'position:underway') delete next['fact:making_way'];
    else if (next['fact:making_way'] === undefined) next['fact:making_way'] = true;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    setFacts(next as FactRecord);
    setDisplayIndex(0);
    setAdditionsOn([]);
  };

  const evaln = useMemo((): { ok?: DisplayEvaluation; err?: string } => {
    try {
      return { ok: evaluateDisplay(facts) };
    } catch (e) {
      return { err: String(e) };
    }
  }, [facts]);

  const displays = evaln.ok?.displays ?? [];
  const additions = evaln.ok?.optionalAdditions ?? [];
  const current = Math.min(displayIndex, Math.max(0, displays.length - 1));
  const display = displays[current];

  const placed = useMemo(() => {
    if (!display) return [];
    const extra = additions.filter((a) => additionsOn.includes(a.id)).flatMap((a) => a.lights);
    return placeLights([...display.lights, ...extra], hull.spec, facts, lightsData, geometryData);
  }, [display, additions, additionsOn, hull, facts]);

  // "Labels off" blanks every label string, to see the views without text.
  const labels = useMemo(() => {
    if (labelsOn) return defaultBenchyLabels;
    const blank = Object.fromEntries(
      Object.entries(defaultBenchyLabels).map(([k, v]) => [
        k,
        typeof v === 'function' ? () => '' : typeof v === 'string' ? '' : v,
      ]),
    );
    return {
      ...blank,
      aspect: Object.fromEntries(Object.keys(defaultSceneLabels.aspect).map((a) => [a, ''])),
    } as typeof defaultBenchyLabels;
  }, [labelsOn]);

  const num = (k: string) =>
    typeof facts[k as keyof FactRecord] === 'number'
      ? (facts[k as keyof FactRecord] as number)
      : '';

  return (
    <div className="pg">
      <header>
        <h1>nav-wright playground</h1>
        <span className="muted">selectHull(facts) → {selectHull(facts).spec.id}</span>
      </header>

      <section className="controls">
        <fieldset>
          <legend>Hull</legend>
          <Field label="allHulls">
            <Select value={hullKey} options={hullKeys} onChange={(v) => pickHull(v as HullKey)} />
          </Field>
          <Field label="3D model">
            <Select value={model} options={modelNames} onChange={setModel} />
          </Field>
        </fieldset>

        <fieldset>
          <legend>Facts</legend>
          <Field label="propulsion">
            <Select
              value={String(facts['fact:propulsion'])}
              options={PROPULSIONS}
              onChange={(v) => patchFacts({ 'fact:propulsion': v })}
            />
          </Field>
          <Field label="activity">
            <Select
              value={String(facts['fact:activity'])}
              options={ACTIVITIES}
              onChange={(v) => patchFacts({ 'fact:activity': v })}
            />
          </Field>
          <Field label="position">
            <Select
              value={String(facts['fact:position'])}
              options={POSITIONS}
              onChange={(v) => patchFacts({ 'fact:position': v })}
            />
          </Field>
          {facts['fact:position'] === 'position:underway' && (
            <Field label="making way">
              <input
                type="checkbox"
                checked={facts['fact:making_way'] === true}
                onChange={(e) => patchFacts({ 'fact:making_way': e.target.checked })}
              />
            </Field>
          )}
          {(['fact:length_m', 'fact:tow_length_m', 'fact:max_speed_kn'] as const).map((k) => (
            <Field key={k} label={k.replace('fact:', '')}>
              <input
                type="number"
                value={num(k)}
                onChange={(e) =>
                  patchFacts({
                    [k]: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
          ))}
        </fieldset>

        <fieldset>
          <legend>Display</legend>
          {evaln.err && <p className="err">{evaln.err}</p>}
          {displays.length > 1 && (
            <Field label="lawful display">
              <Select
                value={String(current)}
                options={displays.map((_, i) => String(i))}
                onChange={(v) => setDisplayIndex(Number(v))}
              />
            </Field>
          )}
          {display && (
            <p className="muted">
              {display.entries.join(', ')}
              {display.chosen.length > 0 && ` (${display.chosen.join(', ')})`}
            </p>
          )}
          {additions.map((a) => (
            <Field key={a.id} label={`+ ${a.id}`}>
              <input
                type="checkbox"
                checked={additionsOn.includes(a.id)}
                onChange={(e) =>
                  setAdditionsOn(
                    e.target.checked
                      ? [...additionsOn, a.id]
                      : additionsOn.filter((x) => x !== a.id),
                  )
                }
              />
            </Field>
          ))}
          <p className="muted">{placed.length} lights placed</p>
        </fieldset>

        <fieldset>
          <legend>View</legend>
          <Field label="theta">
            <Range value={theta} min={0} max={359} onChange={setTheta} />
          </Field>
          <Field label="tilt (3D)">
            <Range value={tilt} min={0} max={85} onChange={setTilt} />
          </Field>
          <Field label="hullHint">
            <Range value={hullHint} min={0} max={1} step={0.05} onChange={setHullHint} />
          </Field>
          <Field label="range set">
            <input
              type="checkbox"
              checked={rangeOn}
              onChange={(e) => setRangeOn(e.target.checked)}
            />
          </Field>
          {rangeOn && (
            <Field label="range nm">
              <Range value={range} min={0} max={5} step={0.1} onChange={setRange} />
            </Field>
          )}
          <Field label="sky">
            <Range value={sky} min={0} max={1} step={0.05} onChange={setSky} />
          </Field>
          <Field label="seascape">
            <input
              type="checkbox"
              checked={seascape}
              onChange={(e) => setSeascape(e.target.checked)}
            />
          </Field>
          <Field label="labels">
            <input
              type="checkbox"
              checked={labelsOn}
              onChange={(e) => setLabelsOn(e.target.checked)}
            />
          </Field>
        </fieldset>
      </section>

      <section className="views">
        <figure>
          <figcaption>ProfileView</figcaption>
          <ProfileView hull={hull} placed={placed} facts={facts} labels={labels} />
        </figure>
        <figure>
          <figcaption>BearingView</figcaption>
          <BearingView
            hull={hull}
            placed={placed}
            theta={theta}
            onTheta={setTheta}
            hullHint={hullHint}
            range={rangeOn ? range : undefined}
            sky={sky}
            seascape={seascape}
            labels={labels}
          />
        </figure>
        <figure>
          <figcaption>PlanView</figcaption>
          <PlanView hull={hull} placed={placed} theta={theta} onTheta={setTheta} labels={labels} />
        </figure>
        <figure>
          <figcaption>BenchyView ({model})</figcaption>
          <BenchyView
            key={model}
            modelUrl={models[model]!}
            hull={hull}
            placed={placed}
            facts={facts}
            theta={theta}
            onTheta={setTheta}
            tilt={tilt}
            onTilt={setTilt}
            labels={labels}
          />
        </figure>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
