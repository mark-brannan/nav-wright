// Renders the vessel as a 3D model, for the Benchy view and the 3D bearing
// view (BearingModelView: night, faint hull, lights in arc only). Every
// vessel uses the same stand-in mesh regardless of hull, size or mode of
// propulsion; only the length scaling varies.
//
// The lights are drawn in the scene rather than as a 2D overlay: the view
// orbits, so a flat annotation layer in profile coordinates would slide
// off the hull the moment you dragged it. They come from the same
// placeLights output the 2D views use, so there is still one
// light-placement implementation; what changes here is only where on the
// mesh each light is seated. The mesh's shape is read back as a station
// profile and each light snapped to the surface at its station (see
// anchorLights in modelTransform.ts), so a sidelight sits on the rail
// and a masthead light clears the cabin instead of landing inside it.
//
// Model: the caller supplies its URL. The .glb ships in this package
// (models/3dbenchy-lowpoly.glb) but is not imported here — a library
// cannot know how a consumer's bundler turns an asset into a URL, and
// reading one off import.meta.env would bind it to Vite. See MODELS.md
// for provenance, license and the bow-orientation check this component
// relies on (local +X is the bow). The scale/orientation math itself
// lives in modelTransform.ts, where it is unit-tested.

import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { ComponentRef, ReactElement, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ModelErrorBoundary } from './ModelErrorBoundary.js';
import type { PlacedLight } from './placement.js';
import { lightsInView } from './placement.js';
import {
  VIEW_FRAME,
  anchorLights,
  lightPosition,
  lightRadius,
  orbitAngles,
  orbitPosition,
  viewFrame,
} from './modelTransform.js';
import type { HullStations } from './modelTransform.js';
import { placeScene, profileHullModel } from './sceneProfile.js';
import { DEFAULT_TILT, MAX_TILT } from './tilt.js';

const NO_HULL: HullStations = { beam: 0, mastX: NaN, aftMastX: NaN, sternX: NaN, bowX: NaN };

/** The placed hull and her lights, seated on it. One component because
 * the lights need the mesh's profile, which only exists once the model
 * has loaded — so they arrive together, on the hull, rather than the
 * lights appearing first at their analytic positions and then jumping.
 * Everything is placed in metres and drawn in view units (viewFrame),
 * framed from her length and spec rather than the mesh, so she is the same
 * size on screen whatever her length and whichever mesh is drawn for her. */
function Hull({
  modelUrl,
  lengthMeters,
  hull,
  placed,
  anchored,
  inViewAt,
  opacity,
}: {
  modelUrl: string;
  lengthMeters: number;
  hull: HullStations;
  placed: PlacedLight[];
  anchored: boolean;
  /** Draw only the lights whose arc holds this bearing; undefined draws all. */
  inViewAt?: number;
  /** Mesh opacity, 0 (hidden) .. 1. The lights are never faded. */
  opacity: number;
}): ReactElement {
  const { scene } = useGLTF(modelUrl);

  // The mesh is fitted to the spec's own bow-to-stern span, not the full
  // length, so it lands in the frame the spec's stations are drawn in. A
  // missing spec (NO_HULL's NaNs) falls back to the full-length fit.
  const { sternX, bowX } = hull;
  // Clone and materials are made together: the clone shares the cached GLTF's
  // materials, and fading those would fade every other view of the mesh.
  // `depth` is the same mesh writing depth only, so a faded hull shows its
  // nearest surface over the sky, not every face behind it.
  const { group, materials, depth } = useMemo(() => {
    const g = placeScene(scene, lengthMeters, { sternX, bowX });
    const materials = ownMaterials(g);
    const depth = g.clone(true);
    depth.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = DEPTH_ONLY;
    });
    return { group: g, materials, depth };
  }, [scene, lengthMeters, sternX, bowX]);
  const faded = opacity < 1;
  useEffect(() => {
    for (const m of materials) {
      m.transparent = faded;
      m.opacity = opacity;
      m.depthWrite = !faded;
      m.needsUpdate = true;
    }
  }, [materials, opacity, faded]);
  const fit = useMemo(
    () => viewFrame(lengthMeters, hull, placed),
    [lengthMeters, hull, placed],
  );
  const profile = useMemo(
    () => profileHullModel(scene, lengthMeters, { sternX, bowX }),
    [scene, lengthMeters, sternX, bowX],
  );

  const positions = useMemo(
    () =>
      profile
        ? anchorLights(placed, lengthMeters, hull, profile, lightRadius(lengthMeters))
        : null,
    [placed, lengthMeters, hull, profile],
  );

  const shown = useMemo(
    () => (inViewAt === undefined ? null : new Set(lightsInView(placed, inViewAt))),
    [placed, inViewAt],
  );

  return (
    <group scale={fit.scale} position={fit.position}>
      <primitive object={depth} visible={faded && opacity > 0} />
      <primitive object={group} visible={opacity > 0} />
      {placed.map((l, i) =>
        shown && !shown.has(l) ? null : (
          <SceneLight
            key={l.key}
            light={l}
            lengthMeters={lengthMeters}
            position={positions?.[i]}
          />
        ),
      )}
      {anchored && opacity > 0 && <AnchorCable lengthMeters={lengthMeters} />}
    </group>
  );
}

/** Writes depth, draws nothing: the faded hull's prepass. */
const DEPTH_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false });

/** Give every mesh under `root` its own copy of its material(s), and return
 * them, so they can be changed without touching the loader's cache. */
function ownMaterials(root: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const own = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) =>
      m.clone(),
    );
    mesh.material = Array.isArray(mesh.material) ? own : own[0]!;
    out.push(...own);
  });
  return out;
}

/** One light: a small emissive bead inside an additive halo, so it reads
 * as a light source from any angle rather than as a coloured dot that
 * disappears edge-on.
 *
 * Drawn without depth testing, so a light is never swallowed by the
 * stand-in mesh's oversized superstructure — which is a cartoon's, not
 * this vessel's. Which lights are drawn at all is Hull's call: every one,
 * as the 2D profile does, or only those in arc (inViewAt), as the bearing
 * view does. */
function SceneLight({
  light,
  lengthMeters,
  position,
}: {
  light: PlacedLight;
  lengthMeters: number;
  /** Where to seat it; falls back to the analytic position when the mesh
   * could not be profiled. */
  position?: [number, number, number];
}): ReactElement {
  const halo = useRef<THREE.Mesh>(null);
  const r = lightRadius(lengthMeters);
  const at = position ?? lightPosition(light, lengthMeters);

  useFrame(({ clock }) => {
    if (!halo.current) return;
    const on =
      light.character !== 'flashing' || clock.elapsedTime % 1.2 < 0.35;
    halo.current.visible = on;
  });

  return (
    <group position={at}>
      <mesh renderOrder={2}>
        <sphereGeometry args={[r, 12, 12]} />
        <meshBasicMaterial
          color={light.color}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={halo} renderOrder={1}>
        <sphereGeometry args={[r * 2.6, 12, 12]} />
        <meshBasicMaterial
          color={light.color}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** The anchor cable, when she is anchored: bow to the seabed, drawn in the
 * scene for the same reason the lights are. */
function AnchorCable({ lengthMeters }: { lengthMeters: number }): ReactElement {
  const points = useMemo(
    () => [
      new THREE.Vector3(lengthMeters / 2, lengthMeters * 0.08, 0),
      new THREE.Vector3(lengthMeters * 0.95, -lengthMeters * 0.35, 0),
    ],
    [lengthMeters],
  );
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(points),
    [points],
  );
  return (
    <primitive
      object={new THREE.Line(geometry, new THREE.LineDashedMaterial({
        color: '#7d8ea3',
        dashSize: lengthMeters * 0.03,
        gapSize: lengthMeters * 0.03,
      }))}
      onUpdate={(l: THREE.Line) => l.computeLineDistances()}
    />
  );
}

const DAY_BACKGROUND = '#0a1622';

const DEG = Math.PI / 180;
const MIN_POLAR = (90 - MAX_TILT) * DEG;
const MAX_POLAR = 90 * DEG;

/** Drives the camera from `theta` (relative bearing of the viewer, the
 * same angle the bearing view's slider carries) and `tilt` (elevation
 * above the waterline), and reports both back when the user drags, so
 * each stays one number rather than two. Works in view units (see
 * VIEW_FRAME), so it has no length to follow. */
function OrbitRig({
  theta,
  onTheta,
  tilt,
  onTilt,
  pan,
}: {
  theta: number;
  onTheta?: (t: number) => void;
  tilt: number;
  onTilt?: (t: number) => void;
  pan: boolean;
}): ReactElement {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  // The last angles this component itself reported. Without them, our own
  // report comes back as a prop and re-seats the camera mid-drag.
  const reported = useRef<{ theta: number; tilt: number } | null>(null);

  useEffect(() => {
    const r = reported.current;
    if (r && Math.abs(r.theta - theta) < 0.5 && Math.abs(r.tilt - tilt) < 0.5)
      return;
    // At theta 90 the bow falls to the right of the frame, as it does in
    // the 2D profile.
    camera.position.set(...orbitPosition(theta, tilt));
    controls.current?.update();
  }, [theta, tilt, camera]);

  return (
    <OrbitControls
      ref={controls}
      target={[0, 0, 0]}
      enablePan={pan}
      enableZoom
      minDistance={VIEW_FRAME.minDistance}
      maxDistance={VIEW_FRAME.maxDistance}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      onChange={() => {
        const c = controls.current;
        if (!c) return;
        const next = orbitAngles(c.getAzimuthalAngle(), c.getPolarAngle());
        const prev = reported.current;
        if (prev && prev.theta === next.theta && prev.tilt === next.tilt) return;
        reported.current = next;
        if (next.theta !== prev?.theta) onTheta?.(next.theta);
        if (next.tilt !== prev?.tilt) onTilt?.(next.tilt);
      }}
    />
  );
}

export function BenchyModel({
  modelUrl,
  lengthMeters,
  placed,
  anchored = false,
  theta = 90,
  onTheta,
  tilt = DEFAULT_TILT,
  onTilt,
  hull = NO_HULL,
  inViewAt,
  hullOpacity = 1,
  background = DAY_BACKGROUND,
  night = false,
  label,
  fallback = <div className="scene-3d" />,
  onError,
}: {
  /** URL of the .glb to render. This package ships one at
   * `nav-wright/models/3dbenchy-lowpoly.glb`; resolve it however your
   * bundler resolves assets and pass the result. */
  modelUrl: string;
  lengthMeters: number;
  placed: PlacedLight[];
  anchored?: boolean;
  /** Relative bearing of the viewer, in degrees — the same angle the
   * bearing view carries, so the two views agree on where you stand. */
  theta?: number;
  onTheta?: (t: number) => void;
  /** Camera elevation above the waterline, degrees. */
  tilt?: number;
  onTilt?: (t: number) => void;
  /** The hull spec's stations (half-beam, masts, stern and bow) in fx/py
   * units, so each light can be seated on the mesh's counterpart of where
   * the 2D profile put it, the mesh fitted to the spec's own bow-to-stern
   * span, and the view framed on her (mast heights too: pass the HullSpec). The default seats everything on the centreline and
   * fits the mesh to the full length. */
  hull?: HullStations;
  /** Draw only the lights a viewer at this relative bearing can see (their
   * arc holds it), as the bearing view does. Undefined draws every light,
   * as the profile does. Pass `theta` here to keep the exam's meaning. */
  inViewAt?: number;
  /** The mesh's opacity, 0 (lights only) .. 1 (solid). */
  hullOpacity?: number;
  /** Canvas background colour. */
  background?: string;
  /** Moonlight rather than daylight on the mesh, and no panning: with the
   * orbit centre pinned to the vessel, the camera's azimuth is the viewer's
   * relative bearing and nothing else. */
  night?: boolean;
  /** Accessible name for the canvas. Comes from the caller's SceneLabels —
   * these views render without an IntlProvider, by design (searoom#20). */
  label?: string;
  /** Shown if the model or the WebGL context fails. */
  fallback?: ReactNode;
  onError?: (error: unknown) => void;
}): ReactElement {
  return (
    <ModelErrorBoundary fallback={fallback} onError={onError}>
      <Canvas
        className="scene-3d"
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: VIEW_FRAME.fov, near: VIEW_FRAME.near, far: VIEW_FRAME.far }}
        role="img"
        aria-label={label}
      >
        <color attach="background" args={[background]} />
        <ambientLight intensity={night ? 0.12 : 0.7} />
        <directionalLight
          position={[4, 6, 5]}
          intensity={night ? 0.35 : 1.1}
          color={night ? '#8aa2c8' : '#ffffff'}
        />
        <directionalLight position={[-4, 3, -3]} intensity={night ? 0.06 : 0.3} />
        <OrbitRig
          theta={theta}
          onTheta={onTheta}
          tilt={tilt}
          onTilt={onTilt}
          pan={!night}
        />
        <Suspense fallback={null}>
          <Hull
            modelUrl={modelUrl}
            lengthMeters={lengthMeters}
            hull={hull}
            placed={placed}
            anchored={anchored}
            inViewAt={inViewAt}
            opacity={Math.min(1, Math.max(0, hullOpacity))}
          />
        </Suspense>
      </Canvas>
    </ModelErrorBoundary>
  );
}
