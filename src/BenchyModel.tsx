// Renders the vessel as a 3D model, for the 3D bearing view. The mesh is
// the consumer's choice per hull (modelUrl); only the length scaling varies.
//
// The lights are drawn in the scene rather than as a 2D overlay: the view
// orbits, so a flat annotation layer in profile coordinates would slide
// off the hull the moment you dragged it. They come from the same
// placeLights output the 2D views use, so there is still one
// light-placement implementation; what changes here is only where on the
// mesh each light is seated. A light shows only while the viewer stands
// inside its arc (seatsSeenFrom, over the same lightsSeenFrom cull the SVG
// bearing view uses), so the two never disagree about what is visible. The mesh's shape is read back as a station
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

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentRef, ReactElement, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ModelErrorBoundary } from './ModelErrorBoundary.js';
import type { PlacedLight } from './placement.js';
import {
  VIEW_FRAME,
  anchorLights,
  fitView,
  lightPosition,
  lightRadius,
  orbitAngles,
  orbitPosition,
  seatsSeenFrom,
} from './modelTransform.js';
import type { HullStations } from './modelTransform.js';
import { placeScene, profileHullModel } from './sceneProfile.js';
import { DEFAULT_TILT, MAX_TILT } from './tilt.js';

const NO_HULL: HullStations = { beam: 0, mastX: NaN, aftMastX: NaN, sternX: NaN, bowX: NaN };

/** The placed hull and her lights, seated on it. One component because
 * the lights need the mesh's profile, which only exists once the model
 * has loaded — so they arrive together, on the hull, rather than the
 * lights appearing first at their analytic positions and then jumping.
 * Everything is placed in metres and drawn in view units (fitView), so
 * the hull is the same size on screen whatever her length. */
function Hull({
  modelUrl,
  lengthMeters,
  hull,
  placed,
  anchored,
  theta,
  opacity,
}: {
  modelUrl: string;
  lengthMeters: number;
  hull: HullStations;
  placed: PlacedLight[];
  anchored: boolean;
  /** The viewer's relative bearing: lights outside their arc from here are not drawn. */
  theta: number;
  /** The mesh's opacity, 0 (hidden: lights only) .. 1 (solid). */
  opacity: number;
}): ReactElement {
  const { scene } = useGLTF(modelUrl);

  // The mesh is fitted to the spec's own bow-to-stern span, not the full
  // length, so it lands in the frame the spec's stations are drawn in. A
  // missing spec (NO_HULL's NaNs) falls back to the full-length fit.
  const { sternX, bowX } = hull;
  const group = useMemo(
    () => withOwnMaterials(placeScene(scene, lengthMeters, { sternX, bowX })),
    [scene, lengthMeters, sternX, bowX],
  );
  useEffect(() => fadeMaterials(group, opacity), [group, opacity]);
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(group);
    return fitView({ min: { ...box.min }, max: { ...box.max } });
  }, [group]);
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

  const seen = seatsSeenFrom(placed, positions, theta);

  return (
    <group scale={fit.scale} position={fit.position}>
      <primitive object={group} visible={opacity > 0} />
      {seen.map(({ light, position }) => (
        <SceneLight
          key={light.key}
          light={light}
          lengthMeters={lengthMeters}
          position={position}
        />
      ))}
      {anchored && opacity > 0 && <AnchorCable lengthMeters={lengthMeters} />}
    </group>
  );
}

/** Give every mesh in `group` its own material, so fading this hull never
 * fades another instance of the same cached model. */
function withOwnMaterials(group: THREE.Object3D): THREE.Object3D {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
  });
  return group;
}

/** Set the hull's opacity. It keeps writing depth, so a faded hull still
 * hides its own far side and reads as a solid ghost, not a wireframe; the
 * lights ignore depth (SceneLight), so it never hides one of them. */
function fadeMaterials(group: THREE.Object3D, opacity: number): void {
  const o = Math.min(1, Math.max(0, opacity));
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const transparent = o < 1;
      if (m.transparent !== transparent) m.needsUpdate = true;
      m.transparent = transparent;
      m.opacity = o;
    }
  });
}

/** One light: a small emissive bead inside an additive halo, so it reads
 * as a light source from any angle rather than as a coloured dot that
 * disappears edge-on.
 *
 * Drawn without depth testing, so a light is never swallowed by the
 * stand-in mesh's oversized superstructure — which is a cartoon's, not
 * this vessel's. Whether it is drawn at all is the arc cull's call, in
 * Hull above. */
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
}: {
  theta: number;
  onTheta?: (t: number) => void;
  tilt: number;
  onTilt?: (t: number) => void;
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
      enablePan
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
  hullOpacity = 1,
  background = '#0a1622',
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
   * the 2D profile put it, and the mesh fitted to the spec's own
   * bow-to-stern span. The default seats everything on the centreline and
   * fits the mesh to the full length. */
  hull?: HullStations;
  /** The mesh's opacity, 0 (lights only, the exam view) .. 1 (solid). */
  hullOpacity?: number;
  /** The scene's background colour. */
  background?: string;
  /** Accessible name for the canvas. Comes from the caller's SceneLabels —
   * these views render without an IntlProvider, by design (searoom#20). */
  label?: string;
  /** Shown if the model or the WebGL context fails. */
  fallback?: ReactNode;
  onError?: (error: unknown) => void;
}): ReactElement {
  // Where the camera actually stands, for the arc cull: the theta prop, or
  // the orbit's own report when the viewer drags, so the cull is right even
  // for a caller that does not feed onTheta back in.
  const [seenFrom, setSeenFrom] = useState(theta);
  const [lastTheta, setLastTheta] = useState(theta);
  if (theta !== lastTheta) {
    setLastTheta(theta);
    setSeenFrom(theta);
  }
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
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 5]} intensity={1.1} />
        <directionalLight position={[-4, 3, -3]} intensity={0.3} />
        <OrbitRig
          theta={theta}
          onTheta={(t) => {
            setSeenFrom(t);
            onTheta?.(t);
          }}
          tilt={tilt}
          onTilt={onTilt}
        />
        <Suspense fallback={null}>
          <Hull
            modelUrl={modelUrl}
            lengthMeters={lengthMeters}
            hull={hull}
            placed={placed}
            anchored={anchored}
            theta={seenFrom}
            opacity={hullOpacity}
          />
        </Suspense>
      </Canvas>
    </ModelErrorBoundary>
  );
}
