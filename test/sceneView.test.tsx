import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneView } from '../src/SceneView.js';
import { selectHull } from '../src/hulls.js';

const hull = selectHull({});
const v = (heading: number) => ({ hull, placed: [], heading });

describe('SceneView', () => {
  it('draws both vessels rotated to their headings and the line of bearing', () => {
    const html = renderToStaticMarkup(
      <SceneView own={v(0)} target={v(180)} relativeBearing={0} rangeM={1000} />,
    );
    expect(html).toContain('data-vessel="own"');
    expect(html).toContain('data-vessel="target"');
    expect(html).toContain('rotate(180)');
    expect(html).toContain('data-line-of-bearing');
  });

  it('renders finite coordinates when both vessels sit at one point', () => {
    const html = renderToStaticMarkup(
      <SceneView own={v(0)} target={v(90)} relativeBearing={0} rangeM={0} />,
    );
    expect(html).not.toContain('NaN');
  });

  it('draws a course-and-speed vector only for a vessel with a speed', () => {
    const html = renderToStaticMarkup(
      <SceneView
        own={{ ...v(0), speedMps: 5 }}
        target={v(180)}
        relativeBearing={0}
        rangeM={1000}
      />,
    );
    expect(html).toContain('data-vector="own"');
    expect(html).not.toContain('data-vector="target"');
  });

  it('draws the CPA marker from both vessels motion, and not without speeds', () => {
    const own = { ...v(0), speedMps: 5 };
    const target = { ...v(180), speedMps: 5 };
    const cpa = { cpaM: 0, tcpaS: 100 };
    const html = renderToStaticMarkup(
      <SceneView own={own} target={target} relativeBearing={0} rangeM={1000} cpa={cpa} />,
    );
    expect(html).toContain('data-cpa');
    expect(html).toContain('CPA 0 m in 100 s');
    expect(html).not.toContain('NaN');
    const bare = renderToStaticMarkup(
      <SceneView own={v(0)} target={v(180)} relativeBearing={0} rangeM={1000} cpa={cpa} />,
    );
    expect(bare).not.toContain('data-cpa');
  });
});
