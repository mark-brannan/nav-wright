// nav-wright's own page: every hull, every view, every prop as a plain
// control, fed by colregs-engine directly. Imports ../src, not dist.
// The 3D model is the primary view; the silhouette and the 2D views are
// one click away, and every view is in the grid below.

import { StrictMode, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { formatLook, lookProps } from './copyProps.js';
import { decodeUrlState, encodeUrlState, type UrlState } from './urlState.js';
import { evaluateDisplay } from 'colregs-engine';
import type { DisplayEvaluation, FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import type { PlacedLight, PlacedShape, SectorProfile, ShapesData } from '../src/index.js';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import shapesJson from 'colregs/data/shapes.json' with { type: 'json' };
import {
  BearingView,
  declaredFlashRate,
  lightRangesFor,
  PlanView,
  ProfileView,
  allHulls,
  bearingLabel,
  defaultSceneLabels,
  placeLights,
  placeShapes,
  selectHull,
  wrapDegrees,
} from '../src/index.js';
import {
  BearingModelView,
  BenchyView,
  MAX_TILT,
  MIN_TILT,
  SILHOUETTE_VARIANTS,
  defaultBenchyLabels,
} from '../src/benchy.js';
import type { SilhouetteVariant } from '../src/benchy.js';
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
  const loft = `loft-${hullId}.glb`;
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

// The primary pane: which view, and for the silhouette which variant (or all
// three side by side). Both live in the URL, with theta, so a link opens the
// same picture: ?view=silhouette&variant=soft&theta=90.
const VIEWS = {
  '3d': '3D model',
  silhouette: 'Silhouette',
  profile: 'Profile (2D)',
  bearing: 'Bearing (2D)',
} as const;
type ViewKey = keyof typeof VIEWS;
const VARIANTS = ['all', ...SILHOUETTE_VARIANTS] as const;
type VariantKey = (typeof VARIANTS)[number];
const VARIANT_LABELS: Record<VariantKey, string> = {
  all: 'All three',
  mesh: 'A: mesh',
  block: 'B: spec block',
  soft: 'C: soft',
};

const query = new URLSearchParams(location.search);
const initial = decodeUrlState(location.search, {
  views: Object.keys(VIEWS),
  variants: VARIANTS,
});
const initialView = initial.view as ViewKey;
const initialVariant = initial.variant as VariantKey;

/** Her heading's swing in a seaway, degrees: two sines a little out of step,
 *  so it never settles into a metronome. */
function useYaw(on: boolean, amplitude: number, periodS: number): number {
  const [yaw, setYaw] = useState(0);
  useEffect(() => {
    if (!on) {
      setYaw(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const w = (2 * Math.PI) / periodS;
      setYaw(amplitude * (0.75 * Math.sin(w * t) + 0.25 * Math.sin(1.618 * w * t + 1)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on, amplitude, periodS]);
  return yaw;
}

/** Keep every control in the address bar, leaving other keys (yaw, compare)
 * alone. Debounced: theta changes on every degree of a drag. */
function useUrlState(state: UrlState) {
  useEffect(() => {
    const t = setTimeout(() => {
      const search = encodeUrlState(state, location.search);
      try {
        history.replaceState(null, '', search ? `?${search}` : location.pathname);
      } catch {
        // a browser rate-limiting replaceState: the next change catches up
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, Object.values(state));
}

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
  // The rule line last picked; the lights it calls for are drawn until one is toggled.
  const [lineIndex, setLineIndex] = useState(0);
  // The drawn lights once one is toggled by hand (null: follow the picked line).
  // Drawing a set no rule calls for is unlawful: no line matches it.
  const [drawnOverride, setDrawnOverride] = useState<string[] | null>(null);
  const [model, setModel] = useState(defaultModel(allHulls.powerSmall.spec.id));
  const [theta, setTheta] = useState(initial.theta);
  const [view, setView] = useState<ViewKey>(initialView);
  const [variant, setVariant] = useState<VariantKey>(initialVariant);
  // ?yaw and ?compare, so a render has a link
  const [profileOn, setProfileOn] = useState(true);
  const [fwdTail, setFwdTail] = useState(2);
  const [aftInside, setAftInside] = useState(5);
  const [aftAtLimit, setAftAtLimit] = useState(0.5);
  const [aftTail, setAftTail] = useState(5);
  const [dropout, setDropout] = useState(true);
  const [yawOn, setYawOn] = useState(() => query.has('yaw'));
  const [yawAmp, setYawAmp] = useState(7);
  const [yawPeriod, setYawPeriod] = useState(8);
  const [compare, setCompare] = useState(() => query.has('compare'));
  const yaw = useYaw(yawOn, yawAmp, yawPeriod);
  const shownTheta = (((theta + yaw) % 360) + 360) % 360;
  // a drag reports the yawed bearing; keep the course, not the swing
  const dragTheta = (t: number) => {
    if (Math.abs(t - shownTheta) > 0.75) setTheta((((t - yaw) % 360) + 360) % 360);
  };
  const sectorProfile = useMemo(
    (): SectorProfile | undefined =>
      profileOn
        ? {
            forward: { inside: 0, atLimit: 1, outside: fwdTail },
            aft: { inside: aftInside, atLimit: aftAtLimit, outside: aftTail },
          }
        : undefined,
    [profileOn, fwdTail, aftInside, aftAtLimit, aftTail],
  );
  const [tilt, setTilt] = useState(initial.tilt);
  const [hullHint, setHullHint] = useState(initial.hullHint);
  // Range to her in nm; fades the hull hint (full strength at 0.5 nm and nearer)
  const [range, setRange] = useState(initial.range);
  const [sky, setSky] = useState(initial.sky);
  const [sea, setSea] = useState(initial.sea);
  const [glowSize, setGlowSize] = useState(initial.glowSize);
  const [glowFalloff, setGlowFalloff] = useState(initial.glowFalloff);
  const [transmissivity, setTransmissivity] = useState(initial.transmissivity);
  const [haze, setHaze] = useState(initial.haze);
  const lightRangesNm = useMemo(
    () => lightRangesFor(lightsData, Number(facts['fact:length_m'] ?? 12)),
    [facts],
  );
  const [singleLantern, setSingleLantern] = useState(initial.singleLantern);
  const [rangeGlow, setRangeGlow] = useState(initial.rangeGlow);
  const [flashRateOn, setFlashRateOn] = useState(initial.flashRateOn);
  const [labelsOn, setLabelsOn] = useState(true);
  // every control above is in the URL (see urlState.ts), ?day included
  const [day, setDay] = useState(initial.day);
  const urlState: UrlState = {
    view,
    variant,
    theta,
    tilt,
    hullHint,
    range,
    sky,
    sea,
    glowSize,
    glowFalloff,
    transmissivity,
    haze,
    day,
    singleLantern,
    rangeGlow,
    flashRateOn,
  };
  useUrlState(urlState);

  const hull = allHulls[hullKey];

  const look = lookProps(
    urlState,
    flashRateOn ? declaredFlashRate(lightsData, 'light:flashing') : undefined,
    dropout,
  );
  const [copied, setCopied] = useState(false);
  const copyLook = () => {
    if (!look) return;
    navigator.clipboard
      .writeText(formatLook(look))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  const resetRule = () => {
    setLineIndex(0);
    setDrawnOverride(null);
  };

  const pickHull = (k: HullKey) => {
    setHullKey(k);
    setFacts(hullFacts[k]);
    resetRule();
    setModel(defaultModel(allHulls[k].spec.id));
  };

  const patchFacts = (p: Partial<Record<string, string | number | boolean | undefined>>) => {
    const next: Record<string, unknown> = { ...facts, ...p };
    // making_way refines position:underway; the engine refuses it otherwise
    if (next['fact:position'] !== 'position:underway') delete next['fact:making_way'];
    else if (next['fact:making_way'] === undefined) next['fact:making_way'] = true;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    setFacts(next as FactRecord);
    resetRule();
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

  // One line per rule set that could apply: each display, and each display
  // with any combination of its optional additions. Placed per line, because
  // a light's position depends on what else is on the mast.
  const lines = useMemo(() => {
    const out: {
      label: string;
      placed: PlacedLight[];
      shapes: PlacedShape[];
      keys: Set<string>;
    }[] = [];
    for (const d of displays) {
      for (let mask = 0; mask < 1 << additions.length; mask++) {
        const extra = additions.filter((_, i) => mask & (1 << i));
        const placed = placeLights(
          [...d.lights, ...extra.flatMap((a) => a.lights)],
          hull.spec,
          facts,
          lightsData,
          geometryData,
        );
        const shapes = placeShapes(
          [...d.shapes, ...extra.flatMap((a) => a.shapes)],
          hull.spec,
          dayFacts,
          shapesData,
          geometryData,
        );
        const rules = [...d.entries, ...extra.map((a) => a.id)].join(' + ');
        out.push({
          label: `${rules}${d.chosen.length > 0 ? ` (${d.chosen.join(', ')})` : ''}${extra.length > 0 ? ' (optional)' : ''}`,
          placed,
          shapes,
          keys: new Set(placed.map((l) => l.key)),
        });
      }
    }
    return out;
  }, [displays, additions, hull, facts, dayFacts]);

  const picked = lines[Math.min(lineIndex, Math.max(0, lines.length - 1))];
  // Every light any rule draws, the picked line's first, in its own placement.
  const allLights = useMemo(() => {
    const byKey = new Map<string, PlacedLight>();
    for (const l of [...(picked ? [picked] : []), ...lines].flatMap((line) => line.placed))
      if (!byKey.has(l.key)) byKey.set(l.key, l);
    return [...byKey.values()];
  }, [picked, lines]);
  const drawnKeys = useMemo(
    () => new Set(drawnOverride ?? (picked ? [...picked.keys] : [])),
    [drawnOverride, picked],
  );
  const placed = useMemo(
    () => allLights.filter((l) => drawnKeys.has(l.key)),
    [allLights, drawnKeys],
  );
  // The line whose lights are exactly the ones drawn; none means unlawful.
  const matched = lines.findIndex(
    (line) => line.keys.size === drawnKeys.size && [...line.keys].every((k) => drawnKeys.has(k)),
  );
  const unlawful = matched < 0;
  const inEffect = matched >= 0 ? lines[matched]! : picked;
  const placedShapes = inEffect?.shapes ?? [];

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
          <a href="./vessels.html">Vessels</a>
        </nav>
      </header>

      <section className="stage">
        <div className="primary">
          <div className="tabs" role="group" aria-label="View">
            {(Object.keys(VIEWS) as ViewKey[]).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
                {VIEWS[v]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="copy-look"
            disabled={!look}
            onClick={copyLook}
            title={
              look
                ? `Copy this look as props for ${look.component}, ready to paste into searoom`
                : 'The profile view has no bearing props'
            }
          >
            {copied
              ? 'Copied'
              : look
                ? `Copy as ${look.component} props`
                : 'No props for this view'}
          </button>
          {view === 'silhouette' && (
            <div className="tabs tabs-sub" role="group" aria-label="Silhouette variant">
              {VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={variant === v}
                  onClick={() => setVariant(v)}
                >
                  {VARIANT_LABELS[v]}
                </button>
              ))}
            </div>
          )}
          {view === '3d' && (
            <div className={compare ? 'compare' : undefined}>
              {compare && (
                <figure>
                  <figcaption>today: hard cut, no dropout</figcaption>
                  <BearingModelView
                    key={`${model}-today`}
                    modelUrl={models[model]!}
                    hull={hull}
                    placed={placed}
                    facts={facts}
                    theta={shownTheta}
                    onTheta={dragTheta}
                    tilt={tilt}
                    onTilt={setTilt}
                    hullHint={hullHint}
                    range={range}
                    sky={sky}
                    sea={sea}
                    labels={labels}
                    controls={false}
                  />
                </figure>
              )}
              <figure>
                <figcaption>
                  {compare
                    ? `sector profile ${profileOn ? 'on' : 'off'}, range dropout ${dropout ? 'on' : 'off'}`
                    : `BearingModelView (${model})`}
                </figcaption>
                <BearingModelView
                  key={model}
                  modelUrl={models[model]!}
                  hull={hull}
                  placed={placed}
                  facts={facts}
                  theta={shownTheta}
                  onTheta={dragTheta}
                  tilt={tilt}
                  onTilt={setTilt}
                  hullHint={hullHint}
                  range={range}
                  sky={sky}
                  sea={sea}
                  sectorProfile={sectorProfile}
                  rangeDropout={dropout}
                  lightRangesNm={lightRangesNm}
                  transmissivity={transmissivity}
                  glowSize={glowSize}
                  glowFalloff={glowFalloff}
                  rangeGlow={rangeGlow}
                  haze={haze}
                  labels={labels}
                  controls={false}
                />
              </figure>
            </div>
          )}
          {view === 'silhouette' && (
            <div className={variant === 'all' ? 'silhouettes' : undefined}>
              {(variant === 'all' ? SILHOUETTE_VARIANTS : [variant as SilhouetteVariant]).map(
                (v) => (
                  <figure key={v}>
                    <figcaption>
                      Silhouette {VARIANT_LABELS[v]}
                      {v === 'mesh' && ` (${model})`}
                    </figcaption>
                    <BearingModelView
                      key={v === 'mesh' ? model : v}
                      modelUrl={models[model]!}
                      hull={hull}
                      placed={placed}
                      facts={facts}
                      theta={theta}
                      onTheta={setTheta}
                      hullHint={hullHint}
                      range={range}
                      sky={sky}
                      sea={sea}
                      silhouette={v}
                      lightRangesNm={lightRangesNm}
                      glowSize={glowSize}
                      glowFalloff={glowFalloff}
                      rangeGlow={rangeGlow}
                      haze={haze}
                      labels={labels}
                      controls={false}
                    />
                  </figure>
                ),
              )}
            </div>
          )}
          {view === 'profile' && (
            <figure>
              <figcaption>ProfileView</figcaption>
              <ProfileView
                hull={hull}
                placed={placed}
                facts={dayFacts}
                labels={labels}
                time={day ? 'day' : 'night'}
                shapes={placedShapes}
              />
            </figure>
          )}
          {view === 'bearing' && (
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
                seascape={false}
                singleLantern={singleLantern}
                rangeGlow={rangeGlow}
                lightRangesNm={lightRangesNm}
                flashesPerMinute={
                  flashRateOn ? declaredFlashRate(lightsData, 'light:flashing') : undefined
                }
                labels={labels}
              />
            </figure>
          )}
        </div>
        <aside className="side">
          <figure>
            <figcaption>Benchy</figcaption>
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
            <figcaption>Arc/Bearing View</figcaption>
            <div className="arc-body">
              <PlanView
                hull={hull}
                placed={placed}
                theta={theta}
                onTheta={setTheta}
                labels={labels}
                time={day ? 'day' : 'night'}
                shapes={placedShapes}
              />
              <p className="arc-readout" aria-live="polite">
                <span className="muted">{labels.bearingThetaLabel}</span>
                <strong>{Math.round(wrapDegrees(theta)) % 360}°</strong>
                <span>{labels.aspect[bearingLabel(Math.round(wrapDegrees(theta)) % 360)]}</span>
              </p>
            </div>
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
          {lines.map((line, i) => (
            <label key={line.label} className="radio">
              <input
                type="radio"
                name="rule-in-effect"
                checked={i === matched}
                onChange={() => {
                  setLineIndex(i);
                  setDrawnOverride(null);
                }}
              />
              <span>{line.label}</span>
            </label>
          ))}
          <label className="radio">
            <input type="radio" name="rule-in-effect" checked={unlawful} onChange={() => {}} />
            <span>unlawful / unconstrained</span>
          </label>
          <p className="muted">
            {unlawful
              ? 'Selected: the lights drawn match no rule. Toggle them under Lights drawn.'
              : 'Picking a rule draws its lights.'}
          </p>
        </fieldset>

        <fieldset>
          <legend>Sector profile, 3D (#118)</legend>
          <Field label="profile">
            <input
              type="checkbox"
              checked={profileOn}
              onChange={(e) => setProfileOn(e.target.checked)}
            />
          </Field>
          <Field label="bow tail °">
            <Range value={fwdTail} min={0} max={3} step={0.5} onChange={setFwdTail} />
          </Field>
          <Field label="aft taper °">
            <Range value={aftInside} min={0} max={10} step={0.5} onChange={setAftInside} />
          </Field>
          <Field label="aft at limit">
            <Range value={aftAtLimit} min={0} max={1} step={0.05} onChange={setAftAtLimit} />
          </Field>
          <Field label="aft tail °">
            <Range value={aftTail} min={0} max={5} step={0.5} onChange={setAftTail} />
          </Field>
          <Field label="range dropout">
            <input
              type="checkbox"
              checked={dropout}
              onChange={(e) => setDropout(e.target.checked)}
            />
          </Field>
          <Field label="yaw">
            <input type="checkbox" checked={yawOn} onChange={(e) => setYawOn(e.target.checked)} />
          </Field>
          <Field label="yaw ± °">
            <Range value={yawAmp} min={0} max={15} step={0.5} onChange={setYawAmp} />
          </Field>
          <Field label="yaw period s">
            <Range value={yawPeriod} min={2} max={20} step={0.5} onChange={setYawPeriod} />
          </Field>
          <Field label="compare with today">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
            />
          </Field>
          <p className="muted">bearing shown {shownTheta.toFixed(1)}°</p>
        </fieldset>

        <fieldset>
          <legend>View</legend>
          <Field label="theta">
            <Range value={theta} min={0} max={359.5} step={0.5} onChange={setTheta} />
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
          {allLights.length === 0 && <p className="muted">no lights</p>}
          {allLights.map((l) => (
            <Field
              key={l.key}
              label={`${l.lightId.replace('light:', '')} · ${l.sourceEntry}${l.color ? ` · ${l.color}` : ''}`}
            >
              <input
                type="checkbox"
                checked={drawnKeys.has(l.key)}
                onChange={(e) =>
                  setDrawnOverride(
                    e.target.checked
                      ? [...drawnKeys, l.key]
                      : [...drawnKeys].filter((k) => k !== l.key),
                  )
                }
              />
            </Field>
          ))}
          <p className="muted">
            {placed.length} of {allLights.length} drawn
          </p>
        </fieldset>

        <fieldset>
          <legend>Glow and haze, 3D (#118)</legend>
          <Field label="glow size">
            <Range value={glowSize} min={0} max={4} step={0.05} onChange={setGlowSize} />
          </Field>
          <Field label="glow falloff">
            <Range value={glowFalloff} min={0} max={1} step={0.05} onChange={setGlowFalloff} />
          </Field>
          <Field label="haze">
            <Range value={haze} min={0} max={1} step={0.05} onChange={setHaze} />
          </Field>
          <Field label="visibility K">
            <Range
              value={transmissivity}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setTransmissivity}
            />
          </Field>
          <p className="muted">
            K drives range dropout; range glow (under View) drives both views.
          </p>
        </fieldset>
      </section>

      <h2 className="views-heading">Every view</h2>
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
