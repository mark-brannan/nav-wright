// One record per shipped mesh: what the file is, which real vessel it
// depicts, how true to life it is, and where her lights mount. The design is
// docs/design/mesh-catalog.md (nav-wright#147); this is its schema.
//
// A sidecar, models/<stem>.json, carries the authored fields. The build
// (scripts/mesh-catalog.mjs) measures the rest off the mesh and folds both
// into models/catalog.json and src/meshCatalog.ts.

import { z } from 'zod';

/** Half-length units fore-aft (bow +1, stern -1) and the 2D profile's z
 * (LIGHT_Z_TO_X per fx): the frame HullSpec and placeLights share. */
const fxz = z.tuple([z.number(), z.number()]);

const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);

export const meshSidecarSchema = z.object({
  /** The .glb under models/, e.g. `westsail-32.glb`. */
  file: z.string().regex(/^[a-z0-9][a-z0-9-]*\.glb$/),
  /** The vessel, e.g. `Westsail 32`; for a kit mesh the nominal real vessel. */
  name: z.string().min(1),
  /** Provenance: a real vessel's published drawing, this repo's own 2D
   * drawings, a CC0 game kit, or the calibration Benchy. */
  kind: z.enum(['traced', 'loft', 'kit', 'calibration']),
  /** How true to life. Measured numbers sit beside it, never inside it. */
  fidelity: z.enum(['traced', 'typical', 'stylised', 'calibration']),
  source: z.object({
    /** The trace json, repo-relative, for a traced mesh. */
    trace: z.string().optional(),
    /** The kit and the file within it, for a kit mesh. */
    kit: z.string().optional(),
    kitFile: z.string().optional(),
    url: z.string().url(),
    /** SPDX identifier. */
    license: z.string().min(1),
  }),
  /** What the hull was built as, in the source's own words. Not a taxonomy. */
  hullForm: z.string().min(1),
  rig: z.string().optional(),
  /** What she can be driven by. */
  propulsion: z.array(z.enum(['sail', 'power', 'oars', 'none'])).min(1),
  /** Features visible on the mesh: `sails`, `towing-gear`, `cranes`, `funnel`… */
  shows: z.array(slug),
  /** Real for a traced mesh; a chosen nominal (`nominal: true`) for a kit or
   * loft; null for calibration. */
  loaM: z.number().positive().nullable(),
  beamM: z.number().positive().nullable(),
  draftM: z.number().positive().nullable(),
  nominal: z.boolean(),
  /** The length band a scene may scale her to before the UI must say
   * "scaled". Null for calibration. */
  fitLengthM: z.tuple([z.number().positive(), z.number().positive()]).nullable(),
  /** ITU-R M.1371 ship-type code a real example would most likely declare.
   * Informative only. */
  aisType: z.number().int().min(0).max(99).optional(),
});

export const meshRecordSchema = meshSidecarSchema.extend({
  /** Measured from the mesh: length over beam, and length over height
   * above the waterline (rig included). */
  proportions: z.object({ lengthBeam: z.number().positive(), lengthHeight: z.number().positive() }),
  /** The mesh's own waterline height and hull extent, in its own
   * coordinates: what placeHullModel takes. From the glb extras when the
   * mesh names them, else its bounds. */
  frame: z.object({ waterlineZ: z.number(), hullX: z.tuple([z.number(), z.number()]) }),
  /** Where each navigation light seats on this mesh, `[fx, z]`, as
   * anchorLights reads them off the station profile. */
  lights: z.object({ masthead: fxz, sidelight: fxz, stern: fxz }),
});

export type MeshSidecar = z.infer<typeof meshSidecarSchema>;
export type MeshRecord = z.infer<typeof meshRecordSchema>;
