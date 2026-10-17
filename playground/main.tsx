// nav-wright's own page: every hull, every view, every prop as a plain
// control, fed by colregs-engine directly. Imports ../src, not dist.

import { StrictMode, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { evaluateDisplay } from 'colregs-engine';
import type { DisplayEvaluation, FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import type { ShapesData } from '../src/index.js';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import shapesJson from 'colregs/data/shapes.json' with { type: 'json' };
import {
  BearingView,
  declaredFlashRate,
  lightRangesFor,
  PlanView,
  ThetaControl,
  ProfileView,
  allHulls,
  defaultSceneLabels,
  placeLights,
  placeShapes,
  selectHull,
} from '../src/index.js';
import {
  BearingModelView,
  BenchyView,
  DEFAULT_TILT,
  MAX_TILT,
  MIN_TILT,
  defaultBenchyLabels,
} from '../src/benchy.js';
import '../src/style.css';
import './playground.css';
import { hullFacts } from './hullFacts.js';
import type { HullKey } from './hullFacts.js';

const lightsData = lightsJson as unknown as LightsData;
const geometryData = geometryJson as unknown as GeometryData;
const shapesData = shapesJson as unknown as ShapesData;

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
  // Editing the lights (or the optional additions) leaves the lawful set: no display is selected.
  const [custom, setCustom] = useState(false);
  const [model, setModel] = useState(defaultModel(allHulls.powerSmall.spec.id));
  const [theta, setTheta] = useState(45);
  const [tilt, setTilt] = useState(DEFAULT_TILT);
  const [hullHint, setHullHint] = useState(0.5);
  // Range to her in nm; fades the hull hint (full strength at 0.5 nm and nearer)
  const [range, setRange] = useState(0.5);
  const [sky, setSky] = useState(0);
  const [sea, setSea] = useState(0.1);
  // Lights switched off here are dropped from every view: what is drawn is
  // decoupled from what the lawful display calls for.
  const [lightsOff, setLightsOff] = useState<string[]>([]);
  const lightRangesNm = useMemo(
    () => lightRangesFor(lightsData, Number(facts['fact:length_m'] ?? 12)),
    [facts],
  );
  const [singleLantern, setSingleLantern] = useState(false);
  const [rangeGlow, setRangeGlow] = useState(false);
  const [flashRateOn, setFlashRateOn] = useState(false);
  const [labelsOn, setLabelsOn] = useState(true);
  // ?day opens in daylight, so a day view has a link
  const [day, setDay] = useState(() => new URLSearchParams(location.search).has('day'));

  const hull = allHulls[hullKey];

  const pickHull = (k: HullKey) => {
    setHullKey(k);
    setFacts(hullFacts[k]);
    setDisplayIndex(0);
    setAdditionsOn([]);
    setLightsOff([]);
    setCustom(false);
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
    setLightsOff([]);
    setCustom(false);
  };

  // Day states fact:time, which is what makes the engine return shapes.
  const dayFacts = useMemo(
    () => (day ? ({ ...facts, 'fact:time': 'time:day' } as FactRecord) : facts),
    [day, facts],
  );
  const evaln = useMemo((): { ok?: DisplayEvaluation; err?: string } => {
    try {
      return { ok: evaluateDisplay(dayFacts) };
    } catch (e) {
      return { err: String(e) };
    }
  }, [dayFacts]);

  const displays = evaln.ok?.displays ?? [];
  const additions = evaln.ok?.optionalAdditions ?? [];
  const current = Math.min(displayIndex, Math.max(0, displays.length - 1));
  const display = displays[current];

  const lawful = useMemo(() => {
    if (!display) return [];
    const extra = additions.filter((a) => additionsOn.includes(a.id)).flatMap((a) => a.lights);
    return placeLights([...display.lights, ...extra], hull.spec, facts, lightsData, geometryData);
  }, [display, additions, additionsOn, hull, facts]);
  const placed = useMemo(
    () => lawful.filter((l) => !lightsOff.includes(l.key)),
    [lawful, lightsOff],
  );

  const placedShapes = useMemo(() => {
    if (!display) return [];
    // a 'may' shape (Rule 28's cylinder) is an optional addition, like a 'may' light
    const extra = additions.filter((a) => additionsOn.includes(a.id)).flatMap((a) => a.shapes);
    return placeShapes(
      [...display.shapes, ...extra],
      hull.spec,
      dayFacts,
      shapesData,
      geometryData,
    );
  }, [display, additions, additionsOn, hull, dayFacts]);

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
        <nav className="tabs">
          <a href="./index.html" aria-current="page">
            Playground
          </a>
          <a href="./gallery.html">Gallery</a>
          <a href="./scenes.html">Scenes</a>
        </nav>
      </header>

      <section className="stage">
        <div className="primary">
          <BearingModelView
            key={model}
            modelUrl={models[model]!}
            hull={hull}
            placed={placed}
            facts={facts}
            theta={theta}
            onTheta={setTheta}
            tilt={tilt}
            onTilt={setTilt}
            hullHint={hullHint}
            range={range}
            sky={sky}
            sea={sea}
            labels={labels}
            controls={false}
          />
        </div>
        <aside className="side">
          <ThetaControl theta={theta} onTheta={setTheta} labels={labels} plan={hull.plan} />
          <figure>
            <figcaption>Benchy View (3dbenchy-lowpoly.glb)</figcaption>
            <BenchyView
              modelUrl={models['3dbenchy-lowpoly.glb']!}
              hull={hull}
              placed={placed}
              facts={facts}
              theta={theta}
              onTheta={setTheta}
              tilt={tilt}
              onTilt={setTilt}
              labels={labels}
              controls={false}
            />
          </figure>
          <figure>
            <figcaption>Plan view</figcaption>
            <PlanView
              hull={hull}
              placed={placed}
              theta={theta}
              onTheta={setTheta}
              labels={labels}
              time={day ? 'day' : 'night'}
              shapes={placedShapes}
            />
          </figure>
        </aside>
      </section>

      <section className="controls">
        <fieldset>
          <legend>Hull</legend>
          <Field label="allHulls">
            <Select value={hullKey} options={hullKeys} onChange={(v) => pickHull(v as HullKey)} />
          </Field>
          <Field label="3D model">
            <Select value={model} options={modelNames} onChange={setModel} />
          </Field>
          <Field label="camera elevation">
            <Range value={tilt} min={MIN_TILT} max={MAX_TILT} onChange={setTilt} />
          </Field>
          <Field label="hullHint">
            <Range value={hullHint} min={0} max={1} step={0.05} onChange={setHullHint} />
          </Field>
          <Field label="range nm (fades hull)">
            <Range value={range} min={0} max={5} step={0.1} onChange={setRange} />
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
          {displays.map((d, i) => (
            <label key={i} className="radio">
              <input
                type="radio"
                name="lawful-display"
                checked={!custom && i === current}
                onChange={() => {
                  setDisplayIndex(i);
                  setAdditionsOn([]);
                  setLightsOff([]);
                  setCustom(false);
                }}
              />
              <span>
                {d.entries.join(', ')}
                {d.chosen.length > 0 && ` (${d.chosen.join(', ')})`}
              </span>
            </label>
          ))}
          {additions.map((a) => (
            <Field key={a.id} label={`+ ${a.id}`}>
              <input
                type="checkbox"
                checked={additionsOn.includes(a.id)}
                onChange={(e) => {
                  setCustom(true);
                  setAdditionsOn(
                    e.target.checked
                      ? [...additionsOn, a.id]
                      : additionsOn.filter((x) => x !== a.id),
                  );
                }}
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
          <Field label="single lantern">
            <input
              type="checkbox"
              checked={singleLantern}
              onChange={(e) => setSingleLantern(e.target.checked)}
            />
          </Field>
          <Field label="range glow">
            <input
              type="checkbox"
              checked={rangeGlow}
              onChange={(e) => setRangeGlow(e.target.checked)}
            />
          </Field>
          <Field label="declared flash rate">
            <input
              type="checkbox"
              checked={flashRateOn}
              onChange={(e) => setFlashRateOn(e.target.checked)}
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

        <fieldset>
          <legend>Sky, sea and day</legend>
          <Field label="sky">
            <Range value={sky} min={0} max={1} step={0.05} onChange={setSky} />
          </Field>
          <Field label="sea">
            <Range value={sea} min={0} max={1} step={0.05} onChange={setSea} />
          </Field>
          <Field label="day">
            <input type="checkbox" checked={day} onChange={(e) => setDay(e.target.checked)} />
          </Field>
        </fieldset>

        <fieldset>
          <legend>Lights drawn</legend>
          {lawful.length === 0 && <p className="muted">no lights</p>}
          {lawful.map((l) => (
            <Field key={l.key} label={`${l.lightId.replace('light:', '')} (${l.key})`}>
              <input
                type="checkbox"
                checked={!lightsOff.includes(l.key)}
                onChange={(e) => {
                  setCustom(true);
                  setLightsOff(
                    e.target.checked ? lightsOff.filter((k) => k !== l.key) : [...lightsOff, l.key],
                  );
                }}
              />
            </Field>
          ))}
          <p className="muted">
            {placed.length} of {lawful.length} drawn; the lawful display is unchanged
          </p>
        </fieldset>
      </section>

      <section className="views">
        {(['starboard', 'port'] as const).map((side) => (
          <figure key={side}>
            <figcaption>Profile, {side}</figcaption>
            <ProfileView
              hull={hull}
              placed={placed}
              facts={dayFacts}
              labels={labels}
              time={day ? 'day' : 'night'}
              shapes={placedShapes}
              side={side}
            />
          </figure>
        ))}
        <figure>
          <figcaption>BearingView</figcaption>
          <BearingView
            hull={hull}
            placed={placed}
            theta={theta}
            onTheta={setTheta}
            hullHint={hullHint}
            range={range}
            sky={sky}
            seascape
            singleLantern={singleLantern}
            rangeGlow={rangeGlow}
            lightRangesNm={lightRangesNm}
            flashesPerMinute={
              flashRateOn ? declaredFlashRate(lightsData, 'light:flashing') : undefined
            }
            labels={labels}
            controls={false}
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
