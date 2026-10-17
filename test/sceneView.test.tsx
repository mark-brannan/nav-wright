import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SceneView } from '../src/SceneView.js';
import { selectHull } from '../src/hulls.js';
import { defaultSceneLabels } from '../src/labels.js';

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

  describe('env backdrop', () => {
    const draw = (env?: { narrowChannel?: boolean; trafficLane?: boolean }) =>
      renderToStaticMarkup(
        <SceneView own={v(0)} target={v(270)} relativeBearing={45} rangeM={1500} env={env} />,
      );

    it('draws nothing without env, or with every flag false, and leaves the output as it was', () => {
      const none = draw();
      expect(none).not.toContain('data-env');
      expect(draw({})).toBe(none);
      expect(draw({ narrowChannel: false, trafficLane: false })).toBe(none);
    });

    it('draws a narrow channel for narrowChannel alone', () => {
      const html = draw({ narrowChannel: true });
      expect(html).toContain('data-env="narrow-channel"');
      expect(html).not.toContain('data-env="traffic-lane"');
      expect(html).toContain('Narrow channel');
    });

    it('draws a traffic lane, with separation line and chevrons, for trafficLane alone', () => {
      const html = draw({ trafficLane: true });
      expect(html).toContain('data-env="traffic-lane"');
      expect(html).not.toContain('data-env="narrow-channel"');
      expect(html).toContain('data-env-separation');
      expect(html).toContain('Traffic lane');
    });

    it('draws both when both flags are set, behind the vessels and after the sea', () => {
      const html = draw({ narrowChannel: true, trafficLane: true });
      expect(html).toContain('data-env="narrow-channel"');
      expect(html).toContain('data-env="traffic-lane"');
      expect(html.indexOf('data-env-backdrop')).toBeGreaterThan(html.indexOf('<rect'));
      expect(html.indexOf('data-env-backdrop')).toBeLessThan(html.indexOf('data-vessel="own"'));
      expect(html).not.toContain('NaN');
    });

    it('keeps the frame the same size', () => {
      expect(draw({ narrowChannel: true, trafficLane: true })).toContain('viewBox="0 0 440 440"');
    });

    it('takes its aria text from the labels', () => {
      const html = renderToStaticMarkup(
        <SceneView
          own={v(0)}
          target={v(270)}
          relativeBearing={45}
          rangeM={1500}
          env={{ narrowChannel: true }}
          labels={{ ...defaultSceneLabels, envNarrowChannel: 'Étroit chenal' }}
        />,
      );
      expect(html).toContain('Étroit chenal');
    });
  });
});
