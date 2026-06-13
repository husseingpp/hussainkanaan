// Formation waypoint math. Pure: no DOM, no canvas, no state mutation.
// Given a target point and a facing direction, returns the world-space
// position each unit slot should move to.

import type { FormationType } from '../core/state';

/**
 * Returns the world-space waypoint for slot `i` of `n` units moving toward
 * `target` with unit facing vector `(fx, fy)`.
 * Perpendicular (right of facing) = `(-fy, fx)`.
 */
export function formationWaypoint(
  target: { x: number; y: number },
  fx: number,
  fy: number,
  i: number,
  n: number,
  formation: FormationType,
  spacing: number,
): { x: number; y: number } {
  const px = -fy; // perpendicular X
  const py =  fx; // perpendicular Y

  let col = 0; // lateral offset (in perpendicular direction)
  let row = 0; // depth offset (opposite of facing direction)

  if (formation === 'line') {
    // All units spread side-by-side, centred on target.
    col = i - Math.floor(n / 2);
    row = 0;
  } else if (formation === 'column') {
    // Two-wide column: pairs placed one behind the other.
    col = (i % 2) - 0.5;
    row = Math.floor(i / 2);
  } else if (formation === 'wedge') {
    // V-shape: tip at slot 0, pairs widening back.
    if (i === 0) {
      col = 0; row = 0;
    } else {
      const pair = Math.ceil(i / 2);
      col = (i % 2 === 1 ? 1 : -1) * pair;
      row = pair;
    }
  } else {
    // box: sqrt(n) × sqrt(n) grid centred on target.
    const side = Math.ceil(Math.sqrt(n));
    col = (i % side) - Math.floor(side / 2);
    row = Math.floor(i / side);
  }

  return {
    x: target.x + px * col * spacing - fx * row * spacing,
    y: target.y + py * col * spacing - fy * row * spacing,
  };
}
