// Drawing the day shapes placed by shapes.ts (a sibling file of that name
// would not resolve beside it under .js import specifiers). Each shape is its shapes.json
// `svg`, verbatim and unredrawn, scaled from metres to pixels; the shapes
// are black on the day ground (flag A carries its own white and blue).

import { createElement } from 'react';
import type { ReactElement } from 'react';
import { PX, PZ } from './hulls.js';
import type { PlacedShape } from './shapes.js';

/** Profile pixels per z unit (the drawing's height scale). */
const PROFILE_PX_PER_Z = PZ(0) - PZ(1);
/** Cabinet-oblique drawing of an athwartship offset in the abeam profile. */
const OBLIQUE = 0.5;

// A shapes.json `svg` is rebuilt as React elements, never injected as
// markup: only plain drawing elements and an allowlist of geometry and paint
// attributes pass (no handlers, `style` or `href`). Anything else in the
// string drops the whole drawing, and the shape's bounding box is drawn.
const ELEMENTS = new Set(['path', 'circle', 'rect', 'ellipse', 'polygon', 'line']);
const ATTRS: Record<string, string> = {
  d: 'd',
  cx: 'cx',
  cy: 'cy',
  r: 'r',
  rx: 'rx',
  ry: 'ry',
  x: 'x',
  y: 'y',
  width: 'width',
  height: 'height',
  points: 'points',
  x1: 'x1',
  y1: 'y1',
  x2: 'x2',
  y2: 'y2',
  fill: 'fill',
  stroke: 'stroke',
  'stroke-width': 'strokeWidth',
  transform: 'transform',
};
const ELEMENT = /<([a-z]+)\b([^<>]*?)\/>/gy;
const ATTR = /\s*([a-zA-Z-]+)="([^"<>]*)"/gy;

/** The svg's drawing elements as React elements, or null if it holds anything else. */
export function shapeElements(svg: string): ReactElement[] | null {
  const m = /^<svg\b[^>]*>(.*)<\/svg>$/s.exec(svg.trim());
  if (!m) return null;
  const inner = m[1]!.trim();
  const out: ReactElement[] = [];
  ELEMENT.lastIndex = 0;
  let el: RegExpExecArray | null;
  while (ELEMENT.lastIndex < inner.length && (el = ELEMENT.exec(inner))) {
    const tag = el[1]!;
    if (!ELEMENTS.has(tag)) return null;
    const props: Record<string, string> = {};
    const raw = el[2]!.replace(/\s+$/, '');
    ATTR.lastIndex = 0;
    let a: RegExpExecArray | null;
    while (ATTR.lastIndex < raw.length && (a = ATTR.exec(raw))) {
      const name = ATTRS[a[1]!];
      if (name) props[name] = a[2]!;
    }
    if (ATTR.lastIndex !== raw.length) return null; // unquoted or malformed attributes
    out.push(createElement(tag, { key: out.length, ...props }));
    while (inner[ELEMENT.lastIndex] && /\s/.test(inner[ELEMENT.lastIndex]!)) ELEMENT.lastIndex++;
  }
  return out.length > 0 && ELEMENT.lastIndex === inner.length ? out : null;
}

/** One shape, centred on (x, y) pixels, `pxPerM` pixels to the metre. */
export function ShapeMark({
  shape,
  x,
  y,
  pxPerM,
  opacity,
}: {
  shape: PlacedShape;
  x: number;
  y: number;
  pxPerM: number;
  opacity?: number;
}): ReactElement {
  const s = pxPerM * shape.scale;
  const inner = shapeElements(shape.svg);
  return (
    <g
      className="day-shape"
      data-shape={shape.shapeId}
      opacity={opacity}
      transform={`translate(${(x - (shape.svgWidthM * s) / 2).toFixed(2)},${(y - (shape.svgHeightM * s) / 2).toFixed(2)}) scale(${s.toFixed(4)})`}
    >
      <title>{shape.term}</title>
      {inner ? (
        <g>{inner}</g>
      ) : (
        <rect
          width={shape.svgWidthM}
          height={shape.svgHeightM}
          fill="none"
          stroke="#000"
          strokeWidth={0.05}
        />
      )}
    </g>
  );
}

/** The shapes on the mast, at scale, in the abeam profile. A shape on the
 *  port side is behind the hull from here, so it is drawn faint. */
export function ProfileShapes({ shapes }: { shapes: PlacedShape[] }): ReactElement {
  return (
    <g className="day-shapes">
      {shapes.map((sh) => {
        const pxPerM = PROFILE_PX_PER_Z * sh.zPerM;
        const dx = sh.py * sh.halfLengthM * pxPerM * OBLIQUE;
        return (
          <ShapeMark
            key={sh.key}
            shape={sh}
            x={PX(sh.fx) + dx}
            y={PZ(sh.z)}
            pxPerM={pxPerM}
            opacity={sh.py < -0.001 ? 0.4 : undefined}
          />
        );
      })}
    </g>
  );
}

/** Top-down markers at each shape's position, with a legend of what they are. */
export function PlanShapes({
  shapes,
  center,
  hullScale,
  legendLabel,
}: {
  shapes: PlacedShape[];
  center: number;
  hullScale: number;
  legendLabel: string;
}): ReactElement | null {
  if (shapes.length === 0) return null;
  const terms = new Map<string, number>();
  for (const sh of shapes) terms.set(sh.term, (terms.get(sh.term) ?? 0) + 1);
  const seen = new Set<string>();
  return (
    <g className="day-shapes" role="group" aria-label={legendLabel}>
      {shapes.map((sh) => {
        const cx = center + sh.py * hullScale;
        const cy = center - sh.fx * hullScale;
        const id = `${cx.toFixed(1)},${cy.toFixed(1)},${sh.shapeId}`;
        if (seen.has(id)) return null;
        seen.add(id);
        const r = Math.max(3.5, ((sh.widthM / 2) * hullScale) / sh.halfLengthM);
        return (
          <g key={sh.key} className="day-shape" data-shape={sh.shapeId}>
            <title>{sh.term}</title>
            <circle cx={cx} cy={cy} r={r} fill="#000" stroke="#fff" strokeWidth={0.8} />
          </g>
        );
      })}
      {[...terms].map(([term, n], i) => (
        <text
          key={term}
          x={12}
          y={22 + i * 15}
          fontSize={11}
          fill="#000"
          fontFamily="system-ui, sans-serif"
        >
          {`● ${term} ×${n}`}
        </text>
      ))}
    </g>
  );
}
