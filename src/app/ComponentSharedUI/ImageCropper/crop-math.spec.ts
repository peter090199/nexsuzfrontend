import {
  clamp, coverScale, initialState, moveBy, scaleFromSlider, sliderFromScale, sourceRect, zoomTo
} from './crop-math';

describe('crop-math', () => {
  const box = { width: 280, height: 280 };

  it('the cover scale makes the picture just cover the window', () => {
    expect(coverScale(800, 400, box)).toBeCloseTo(0.7);       // limited by the height
    expect(coverScale(400, 800, box)).toBeCloseTo(0.7);       // limited by the width
    expect(coverScale(280, 280, box)).toBe(1);
  });

  it('starts covering the window, centred', () => {
    const s = initialState(800, 400, box);
    expect(s.scale).toBeCloseTo(0.7);
    expect(s.x).toBeCloseTo(-140);                            // (280 - 560) / 2
    expect(s.y).toBeCloseTo(0);
  });

  it('never lets an edge of the picture come inside the window', () => {
    const s = initialState(800, 400, box);
    const farRight = clamp({ ...s, x: 500 }, 800, 400, box);
    const farLeft = clamp({ ...s, x: -5000 }, 800, 400, box);
    expect(farRight.x).toBe(0);                               // left edge stops at the window's left edge
    expect(farLeft.x).toBeCloseTo(280 - 560);                 // right edge stops at the window's right edge
    expect(clamp({ ...s, y: 100 }, 800, 400, box).y).toBe(0);
    expect(clamp({ ...s, y: -100 }, 800, 400, box).y).toBe(0); // fits exactly vertically: cannot move
  });

  it('dragging moves the picture but stays clamped', () => {
    const s = initialState(800, 400, box);
    expect(moveBy(s, 30, 0, 800, 400, box).x).toBeCloseTo(-110);
    expect(moveBy(s, 1000, 0, 800, 400, box).x).toBe(0);
    expect(moveBy(s, -1000, 0, 800, 400, box).x).toBeCloseTo(-280);
  });

  it('zooming keeps the point under the focus where it was', () => {
    const s = initialState(800, 400, box);
    const focus = { x: 100, y: 120 };
    const before = { px: (focus.x - s.x) / s.scale, py: (focus.y - s.y) / s.scale };

    const z = zoomTo(s, s.scale * 2, 800, 400, box, s.scale, s.scale * 4, focus);
    const after = { px: (focus.x - z.x) / z.scale, py: (focus.y - z.y) / z.scale };

    expect(z.scale).toBeCloseTo(s.scale * 2);
    expect(after.px).toBeCloseTo(before.px, 3);
    expect(after.py).toBeCloseTo(before.py, 3);
  });

  it('zoom is limited to the allowed range and cannot uncover the window', () => {
    const s = initialState(800, 400, box);
    const out = zoomTo(s, 0.01, 800, 400, box, s.scale, s.scale * 4);
    const inn = zoomTo(s, 99, 800, 400, box, s.scale, s.scale * 4);
    expect(out.scale).toBeCloseTo(s.scale);
    expect(inn.scale).toBeCloseTo(s.scale * 4);
    expect(out.x).toBeLessThanOrEqual(0);
    expect(out.x + 800 * out.scale).toBeGreaterThanOrEqual(box.width - 0.001);
  });

  it('the source rectangle is the part of the ORIGINAL picture the window shows', () => {
    const s = initialState(800, 400, box);                    // scale 0.7, x -140
    const r = sourceRect(s, 800, 400, box);
    expect(r.sx).toBeCloseTo(200);                            // 140 / 0.7
    expect(r.sy).toBeCloseTo(0);
    expect(r.sw).toBeCloseTo(400);                            // 280 / 0.7
    expect(r.sh).toBeCloseTo(400);

    const zoomed = zoomTo(s, s.scale * 2, 800, 400, box, s.scale, s.scale * 4);
    const rz = sourceRect(zoomed, 800, 400, box);
    expect(rz.sw).toBeCloseTo(200);                           // twice as close: half as much picture
    expect(rz.sx + rz.sw).toBeLessThanOrEqual(800 + 0.001);   // never outside the picture
    expect(rz.sy + rz.sh).toBeLessThanOrEqual(400 + 0.001);
  });

  it('works for the 3:1 cover window too', () => {
    const banner = { width: 540, height: 180 };
    const s = initialState(1200, 800, banner);
    expect(s.scale).toBeCloseTo(0.45);                        // 540 / 1200
    const r = sourceRect(s, 1200, 800, banner);
    expect(r.sw).toBeCloseTo(1200);
    expect(r.sh).toBeCloseTo(400);                            // 180 / 0.45
    expect(r.sw / r.sh).toBeCloseTo(3);
  });

  it('maps the zoom slider and the scale onto each other (and back)', () => {
    expect(scaleFromSlider(0, 1, 4)).toBeCloseTo(1);
    expect(scaleFromSlider(100, 1, 4)).toBeCloseTo(4);
    expect(scaleFromSlider(50, 1, 4)).toBeCloseTo(2);          // exponential: the middle is the geometric mean
    for (const v of [0, 13, 50, 87, 100]) {
      expect(sliderFromScale(scaleFromSlider(v, 0.7, 2.8), 0.7, 2.8)).toBeCloseTo(v, 3);
    }
    expect(sliderFromScale(1, 1, 1)).toBe(0);                  // a degenerate range does not divide by zero
  });
});
