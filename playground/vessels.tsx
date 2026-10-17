// Real sailing vessels, traced from published drawings
// (docs/research/sailboat-lines): each one's lofted mesh in the 3D bearing
// view, lit as a sailing vessel of her own length, beside the drawings the
// mesh was lofted from.

import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { evaluateDisplay } from 'colregs-engine';
import type { FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import { allHulls, placeLights } from '../src/index.js';
import { BearingModelView } from '../src/benchy.js';
import '../src/style.css';
import './playground.css';

const lightsData = lightsJson as unknown as LightsData;
const geometryData = geometryJson as unknown as GeometryData;

interface Trace {
  name: string;
  sources: { page: string; drawing: string };
  specs: {
    loaFt: number;
    lwlFt?: number;
    beamFt: number;
    draftFt: number;
    rig?: string;
    hull?: string;
    designer?: string;
    built?: string | number;
  };
}

const traces = import.meta.glob<Trace>('../docs/research/sailboat-lines/*.json', {
  import: 'default',
  eager: true,
});
const drawings = import.meta.glob<string>('../docs/research/sailboat-lines/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});
const meshes = import.meta.glob<string>('../models/*-lines.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});
const stem = (path: string) =>
  path
    .split('/')
    .pop()!
    .replace(/\.\w+$/, '');
const drawing = (id: string, view: string) =>
  Object.entries(drawings).find(([p]) => stem(p) === `${id}-${view}`)?.[1];
const mesh = (id: string) => Object.entries(meshes).find(([p]) => stem(p) === `${id}-lines`)?.[1];

const FT = 0.3048;
const VIEWS = ['profile', 'plan', 'bodyplan', 'loft'] as const;
const RESEARCH =
  'https://github.com/mark-brannan/nav-wright/tree/main/docs/research/sailboat-lines';

/** Traces by length, smallest first. */
const vessels = Object.entries(traces)
  .map(([path, trace]) => ({ id: stem(path), trace }))
  .sort((a, b) => a.trace.specs.loaFt - b.trace.specs.loaFt);

function Vessel({ id, trace }: { id: string; trace: Trace }) {
  const lengthM = trace.specs.loaFt * FT;
  // Lights are placed from a hull spec's stations; the mesh is fitted to
  // that same span, so a sailing hull of her size class stands in.
  const hull = lengthM < 20 ? allHulls.sailSmall : allHulls.sailLarge;
  const facts = useMemo(
    (): FactRecord => ({
      'fact:position': 'position:underway',
      'fact:making_way': true,
      'fact:propulsion': 'propulsion:sail',
      'fact:activity': 'activity:none',
      'fact:length_m': Math.round(lengthM * 10) / 10,
    }),
    [lengthM],
  );
  const placed = useMemo(() => {
    const display = evaluateDisplay(facts).displays[0];
    return display ? placeLights(display.lights, hull.spec, facts, lightsData, geometryData) : [];
  }, [facts, hull]);
  const [theta, setTheta] = useState(300);
  const [tilt, setTilt] = useState(12);
  const modelUrl = mesh(id);
  const s = trace.specs;
  return (
    <section className="gallery-hull vessel" id={id}>
      <h2>
        {trace.name}{' '}
        <span className="muted">
          LOA {s.loaFt} ft ({lengthM.toFixed(1)} m), beam {s.beamFt} ft, draft {s.draftFt} ft
          {s.rig ? `, ${s.rig}` : ''}
          {s.hull ? `, ${s.hull}` : ''}
          {s.designer ? `, ${s.designer}` : ''}
          {s.built ? `, ${s.built}` : ''}
        </span>
      </h2>
      <div className="vessel-views">
        <figure className="gallery-row">
          <figcaption>
            <strong>BearingModelView</strong>{' '}
            <span className="muted">
              {id}-lines.glb, lit as a {lengthM.toFixed(1)} m sailing vessel underway
            </span>
          </figcaption>
          {modelUrl ? (
            <BearingModelView
              modelUrl={modelUrl}
              hull={hull}
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
            <p className="muted">no mesh: run node scripts/sailboat-lines.mjs</p>
          )}
        </figure>
        <figure className="gallery-row">
          <figcaption>
            <strong>Loft</strong> <span className="muted">the same mesh, flat-shaded</span>
          </figcaption>
          <img src={drawing(id, 'loft')} alt={`${trace.name} loft`} />
        </figure>
      </div>
      <div className="vessel-drawings">
        {VIEWS.filter((v) => v !== 'loft').map((v) => (
          <figure key={v} className="gallery-row">
            <figcaption>
              <strong>{v === 'bodyplan' ? 'Body plan' : v[0]!.toUpperCase() + v.slice(1)}</strong>
            </figcaption>
            <img src={drawing(id, v)} alt={`${trace.name} ${v}`} />
          </figure>
        ))}
      </div>
      <p className="muted">
        Traced from <a href={trace.sources.drawing}>the published drawing</a> (
        <a href={trace.sources.page}>spec page</a>); the trace and its notes are{' '}
        <a href={`${RESEARCH}/${id}.json`}>{id}.json</a>.
      </p>
    </section>
  );
}

function Vessels() {
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
          {vessels.length} real sailing vessels traced from published drawings and lofted into 3D (
          <a href={RESEARCH}>the research</a>). Drag the bearing view to turn her.
        </span>
      </header>
      {vessels.map((v) => (
        <Vessel key={v.id} id={v.id} trace={v.trace} />
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Vessels />
  </StrictMode>,
);
