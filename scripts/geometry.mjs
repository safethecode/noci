import svgpath from 'svgpath';

const TAU = Math.PI * 2;

function emptyBounds() {
  return [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
}

function include(bounds, x, y) {
  bounds[0] = Math.min(bounds[0], x);
  bounds[1] = Math.min(bounds[1], y);
  bounds[2] = Math.max(bounds[2], x);
  bounds[3] = Math.max(bounds[3], y);
}

function quadraticRoots(a, b, c) {
  if (Math.abs(a) < 1e-14) {
    return Math.abs(b) < 1e-14 ? [] : [-c / b];
  }
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return [];
  }
  const squareRoot = Math.sqrt(discriminant);
  if (squareRoot === 0) {
    return [-b / (2 * a)];
  }
  const q = -0.5 * (b + Math.sign(b || 1) * squareRoot);
  return [q / a, c / q];
}

function cubicPoint(from, values, t) {
  const u = 1 - t;
  return [
    from[0] * u ** 3 + 3 * values[0] * u * u * t + 3 * values[2] * u * t * t + values[4] * t ** 3,
    from[1] * u ** 3 + 3 * values[1] * u * u * t + 3 * values[3] * u * t * t + values[5] * t ** 3,
  ];
}

function quadraticPoint(from, values, t) {
  const u = 1 - t;
  return [
    from[0] * u * u + 2 * values[0] * u * t + values[2] * t * t,
    from[1] * u * u + 2 * values[1] * u * t + values[3] * t * t,
  ];
}

function positiveAngle(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

function includeArc(bounds, from, values) {
  let [rx, ry, rotation, large, sweep, endX, endY] = values;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if ((from[0] === endX && from[1] === endY) || rx === 0 || ry === 0) {
    return;
  }

  const phi = ((rotation % 360) * Math.PI) / 180;
  const cosine = Math.cos(phi);
  const sine = Math.sin(phi);
  const dx = (from[0] - endX) / 2;
  const dy = (from[1] - endY) / 2;
  const xPrime = cosine * dx + sine * dy;
  const yPrime = -sine * dx + cosine * dy;
  const radiiScale = (xPrime * xPrime) / (rx * rx) + (yPrime * yPrime) / (ry * ry);
  if (!(radiiScale > 0) || !Number.isFinite(radiiScale)) {
    throw new Error('Arc radii exceed the supported numeric range.');
  }
  let coefficient = 0;
  if (radiiScale > 1) {
    // SVG expands undersized radii; the corrected arc center is the chord midpoint.
    const scale = Math.sqrt(radiiScale);
    rx *= scale;
    ry *= scale;
  } else {
    const sign = Boolean(large) === Boolean(sweep) ? -1 : 1;
    coefficient = sign * Math.sqrt(Math.max(0, (1 - radiiScale) / radiiScale));
  }
  const centerPrimeX = (coefficient * rx * yPrime) / ry;
  const centerPrimeY = (-coefficient * ry * xPrime) / rx;
  const centerX = cosine * centerPrimeX - sine * centerPrimeY + (from[0] + endX) / 2;
  const centerY = sine * centerPrimeX + cosine * centerPrimeY + (from[1] + endY) / 2;
  const startVector = [(xPrime - centerPrimeX) / rx, (yPrime - centerPrimeY) / ry];
  const endVector = [(-xPrime - centerPrimeX) / rx, (-yPrime - centerPrimeY) / ry];
  if (![centerX, centerY, ...startVector, ...endVector].every(Number.isFinite)) {
    throw new Error('Arc geometry exceeds the supported numeric range.');
  }
  const startAngle = Math.atan2(startVector[1], startVector[0]);
  let sweepAngle = Math.atan2(
    startVector[0] * endVector[1] - startVector[1] * endVector[0],
    startVector[0] * endVector[0] + startVector[1] * endVector[1],
  );
  if (!sweep && sweepAngle > 0) {
    sweepAngle -= TAU;
  }
  if (sweep && sweepAngle < 0) {
    sweepAngle += TAU;
  }

  const xAngle = Math.atan2(-ry * sine, rx * cosine);
  const yAngle = Math.atan2(ry * cosine, rx * sine);
  for (const angle of [xAngle, xAngle + Math.PI, yAngle, yAngle + Math.PI]) {
    const traversed =
      sweepAngle >= 0 ? positiveAngle(angle - startAngle) : positiveAngle(startAngle - angle);
    if (traversed <= Math.abs(sweepAngle) + 1e-12) {
      include(
        bounds,
        centerX + rx * cosine * Math.cos(angle) - ry * sine * Math.sin(angle),
        centerY + rx * sine * Math.cos(angle) + ry * cosine * Math.sin(angle),
      );
    }
  }
}

function pathBounds(data) {
  const path = svgpath(data).abs().unshort();
  if (path.err) {
    throw new Error(path.err);
  }
  const bounds = emptyBounds();
  let position = [0, 0];
  let start = position;
  let drawn = false;
  for (const [command, ...values] of path.segments) {
    if (command === 'M') {
      position = values;
      start = position;
      continue;
    }
    const from = position;
    if (command === 'Z') {
      position = start;
    } else if (command === 'H') {
      position = [values[0], from[1]];
    } else if (command === 'V') {
      position = [from[0], values[0]];
    } else {
      position = values.slice(-2);
    }

    // A move alone paints nothing. A zero-length drawn segment still has a round cap.
    include(bounds, ...from);
    include(bounds, ...position);
    drawn = true;
    if (command === 'C') {
      for (const axis of [0, 1]) {
        const p0 = from[axis];
        const p1 = values[axis];
        const p2 = values[axis + 2];
        const p3 = values[axis + 4];
        for (const t of quadraticRoots(
          -p0 + 3 * p1 - 3 * p2 + p3,
          2 * (p0 - 2 * p1 + p2),
          p1 - p0,
        )) {
          if (t > 0 && t < 1) {
            include(bounds, ...cubicPoint(from, values, t));
          }
        }
      }
    } else if (command === 'Q') {
      for (const axis of [0, 1]) {
        const denominator = from[axis] - 2 * values[axis] + values[axis + 2];
        if (Math.abs(denominator) > 1e-14) {
          const t = (from[axis] - values[axis]) / denominator;
          if (t > 0 && t < 1) {
            include(bounds, ...quadraticPoint(from, values, t));
          }
        }
      }
    } else if (command === 'A') {
      includeArc(bounds, from, values);
    } else if (!['L', 'H', 'V', 'Z'].includes(command)) {
      throw new Error(`Unsupported path command: ${command}`);
    }
  }
  return drawn ? bounds : null;
}

function primitiveBounds(tag, attrs) {
  if (tag === 'path') {
    return pathBounds(attrs.d);
  }
  const bounds = emptyBounds();
  const number = (key) => Number(attrs[key]);
  if (tag === 'circle') {
    include(bounds, number('cx') - number('r'), number('cy') - number('r'));
    include(bounds, number('cx') + number('r'), number('cy') + number('r'));
  } else if (tag === 'rect') {
    include(bounds, number('x'), number('y'));
    include(bounds, number('x') + number('width'), number('y') + number('height'));
  } else if (tag === 'line') {
    include(bounds, number('x1'), number('y1'));
    include(bounds, number('x2'), number('y2'));
  } else if (tag === 'polyline' || tag === 'polygon') {
    const points = attrs.points
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    for (let index = 0; index < points.length; index += 2) {
      include(bounds, points[index], points[index + 1]);
    }
  } else {
    throw new Error(`Unsupported SVG primitive: ${tag}`);
  }
  return bounds;
}

/**
 * Stroke-inclusive geometric bounds for a validated Noci master with round caps and joins.
 * Curves use their extrema, not their controls; elliptical arcs retain SVG semantics.
 * Filled paths use their closed contour bounds; callers must also reject empty artwork.
 * Returns [minX, minY, maxX, maxY], or null when there are no drawn segments.
 * The caller chooses a floating-point tolerance; bounds are neither rounded nor clipped.
 * @param {{strokeWidth: number, nodes: Array<[string, Record<string, string>]>}} master
 * @returns {[number, number, number, number] | null}
 */
export function paintedBounds(master) {
  const bounds = emptyBounds();
  let painted = false;
  for (const [tag, attrs] of master.nodes) {
    const node = primitiveBounds(tag, attrs);
    if (!node) {
      continue;
    }
    const radius = attrs.stroke === 'none' ? 0 : master.strokeWidth / 2;
    include(bounds, node[0] - radius, node[1] - radius);
    include(bounds, node[2] + radius, node[3] + radius);
    painted = true;
  }
  return painted ? bounds : null;
}
