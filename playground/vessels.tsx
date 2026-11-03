// Every shipped mesh, by its catalog record (docs/design/mesh-catalog.md):
// pick one by name, see her in the 3D bearing view lit as the vessel the
// record says she is, with the record beside her. The traced real sailing
// vessels (docs/research/sailboat-lines) keep the drawings they were
// lofted from under the picker.

import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { evaluateSignals } from 'colregs-engine';
import type { FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import { allHulls, meshCatalog, placeLights, selectHull } from '../src/index.js';
import type { Hull, MeshRecord } from '../src/index.js';
import { BearingModelView } from '../src/benchy.js';
import '../src/style.css';
import './playground.css';

const lightsData = lightsJson as unknown as LightsData;
const geometryData = geometryJson as unknown as GeometryData;

const meshes = import.meta.glob<string>('../models/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});
const drawings = import.meta.glob<string>('../docs/research/sailboat-lines/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});
const stem = (path: string) =>
  path
    .split('/')
    .pop()!
    .replace(/\.\w+$/, '');
const meshUrl = (file: string) => Object.entries(meshes).find(([p]) => p.endsWith(`/${file}`))?.[1];
const drawing = (id: string, view: string) =>
  Object.entries(drawings).find(([p]) => stem(p) === `${id}-${view}`)?.[1];

const VIEWS = ['profile', 'plan', 'bodyplan', 'loft'] as const;
const RESEARCH =
  'https://github.com/mark-brannan/nav-wright/tree/main/docs/research/sailboat-lines';

/** The length a scene would give her: her own, else the middle of her fit band. */
function lengthOf(r: MeshRecord): number {
  if (r.loaM) return r.loaM;
  if (r.fitLengthM) return (r.fitLengthM[0] + r.fitLengthM[1]) / 2;
  return 12;
}

/** Lit as what the record says she is: a sailing vessel under sail, an
 * oared boat, else a power-driven vessel underway. */
function factsOf(r: MeshRecord): FactRecord {
  const propulsion = r.propulsion.includes('sail')
    ? 'propulsion:sail'
    : r.propulsion.includes('power')
      ? 'propulsion:power'
      : 'propulsion:oars';
  return {
    'fact:position': 'position:underway',
    'fact:making_way': true,
    'fact:propulsion': propulsion,
    'fact:activity': 'activity:none',
    'fact:length_m': Math.round(lengthOf(r) * 10) / 10,
  };
}

/** The hull spec whose stations light her: a loft's own drawing, else the
 * one selectHull picks for her facts. */
function hullOf(r: MeshRecord, facts: FactRecord): Hull {
  const loft = r.file.match(/^loft-(.*?)(-slender|-sheered|-highside)?\.glb$/);
  const own = loft && Object.values(allHulls).find((h) => h.spec.id === loft[1]);
  return own || selectHull(facts);
}

function Record({ r }: { r: MeshRecord }) {
  const rows: [string, string][] = [
    ['file', r.file],
    ['kind / fidelity', `${r.kind} / ${r.fidelity}`],
    ['hull form', r.hullForm],
    ...(r.rig ? ([['rig', r.rig]] as [string, string][]) : []),
    ['propulsion', r.propulsion.join(', ')],
    ['shows', r.shows.join(', ') || '—'],
    [
      'LOA × beam × draft',
      `${r.loaM ?? '—'} × ${r.beamM ?? '—'} × ${r.draftM ?? '—'} m${r.nominal ? ' (nominal)' : ''}`,
    ],
    ['fits', r.fitLengthM ? `${r.fitLengthM[0]}–${r.fitLengthM[1]} m` : '—'],
    ['L/B, L/H', `${r.proportions.lengthBeam}, ${r.proportions.lengthHeight}`],
    ['frame', `waterline z ${r.frame.waterlineZ}, hull x ${r.frame.hullX.join('..')}`],
    [
      'lights [fx, z]',
      `masthead ${r.lights.masthead.join(', ')}; side ${r.lights.sidelight.join(', ')}; stern ${r.lights.stern.join(', ')}`,
    ],
    ...(r.aisType !== undefined ? ([['AIS type', String(r.aisType)]] as [string, string][]) : []),
    ['source', `${r.source.license}, ${r.source.url}`],
  ];
  return (
    <table className="mesh-record">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Viewer({ r }: { r: MeshRecord }) {
  const facts = useMemo(() => factsOf(r), [r]);
  const hull = useMemo(() => hullOf(r, facts), [r, facts]);
  const placed = useMemo(() => {
    const display = evaluateSignals(facts).displays[0];
    return display ? placeLights(display.lights, hull.spec, facts, lightsData, geometryData) : [];
  }, [facts, hull]);
  const [theta, setTheta] = useState(300);
  const [tilt, setTilt] = useState(12);
  const modelUrl = meshUrl(r.file);
  return (
    <div className="vessel-views">
      <figure className="gallery-row">
        <figcaption>
          <strong>BearingModelView</strong>{' '}
          <span className="muted">
            {r.file}, lit as a {facts['fact:length_m']} m {facts['fact:propulsion']!.slice(11)}{' '}
            vessel underway on the {hull.spec.id} stations
          </span>
        </figcaption>
        {modelUrl ? (
          <BearingModelView
            modelUrl={modelUrl}
            hull={hull}
            mesh={r}
            placed={placed}
            facts={facts}
            theta={theta}
            onTheta={setTheta}
            tilt={tilt}
            onTilt={setTilt}
            hullHint={1}
            sky={0.35}
            sea={0.5}
          />
        ) : (
          <p className="muted">no mesh: npm run models</p>
        )}
      </figure>
      <figure className="gallery-row">
        <figcaption>
          <strong>Catalog record</strong> <span className="muted">models/catalog.json</span>
        </figcaption>
        <Record r={r} />
      </figure>
    </div>
  );
}

/** The traced vessels, with the drawings each was lofted from. */
function Traced({ r }: { r: MeshRecord }) {
  const id = r.file.replace(/\.glb$/, '');
  return (
    <section className="gallery-hull vessel" id={id}>
      <h2>
        {r.name}{' '}
        <span className="muted">
          LOA {r.loaM} m, beam {r.beamM} m, draft {r.draftM} m, {r.hullForm}
        </span>
      </h2>
      <Viewer r={r} />
      <div className="vessel-drawings">
        {VIEWS.map((v) => (
          <figure key={v} className="gallery-row">
            <figcaption>
              <strong>{v === 'bodyplan' ? 'Body plan' : v[0]!.toUpperCase() + v.slice(1)}</strong>
            </figcaption>
            <img src={drawing(id, v)} alt={`${r.name} ${v}`} />
          </figure>
        ))}
      </div>
      <p className="muted">
        Traced from <a href={r.source.url}>the published drawing</a>; the trace and its notes are{' '}
        <a href={`${RESEARCH}/${id}.json`}>{id}.json</a>.
      </p>
    </section>
  );
}

const byName = [...meshCatalog].sort(
  (a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file),
);
const KINDS = ['traced', 'loft', 'kit', 'calibration'] as const;

function Vessels() {
  const [file, setFile] = useState(
    byName.find((r) => r.kind === 'traced')?.file ?? byName[0]!.file,
  );
  const picked = meshCatalog.find((r) => r.file === file)!;
  return (
    <div className="pg gallery">
      <header>
        <h1>nav-wright vessels</h1>
        <nav className="tabs">
          <a href="./index.html">Playground</a>
          <a href="./gallery.html">Gallery</a>
          <a href="./scenes.html">Scenes</a>
          <a href="./vessels.html" aria-current="page">
            Vessels
          </a>
        </nav>
        <span className="muted">
          {meshCatalog.length} meshes, each with its catalog record. Drag the bearing view to turn
          her.
        </span>
      </header>
      <section className="gallery-hull vessel">
        <h2>
          <label>
            Mesh{' '}
            <select value={file} onChange={(e) => setFile(e.target.value)}>
              {KINDS.map((kind) => (
                <optgroup key={kind} label={kind}>
                  {byName
                    .filter((r) => r.kind === kind)
                    .map((r) => (
                      <option key={r.file} value={r.file}>
                        {r.name} — {r.file}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
        </h2>
        <Viewer key={picked.file} r={picked} />
      </section>
      {byName
        .filter((r) => r.kind === 'traced')
        .sort((a, b) => a.loaM! - b.loaM!)
        .map((r) => (
          <Traced key={r.file} r={r} />
        ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Vessels />
  </StrictMode>,
);
