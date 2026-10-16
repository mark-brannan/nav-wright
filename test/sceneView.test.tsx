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
});
