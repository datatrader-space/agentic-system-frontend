// Geometry of the annotation editor: a straight port of the old editor's geometry.js
// (training_models_data/static/training_models_data/geometry.js), so a shape is cut, straightened and tidied the same way
// in both editors; keep the two in step. Below the port: crosses() and box(), used only by this editor.
/* eslint-disable no-var */
function signedArea(points) {
  var total = 0;
  for (var i = 0; i < points.length; i += 1) {
    var a = points[i], b = points[(i + 1) % points.length];
    total += a[0] * b[1] - b[0] * a[1];
  }
  return total / 2;
}
function area(points) { return Math.abs(signedArea(points)); }
function triangle(a, b, c) { return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2; }

/* The polygon with the points that are not corners taken away: again and again the point whose triangle with
   its two neighbours is the smallest is dropped, while that triangle is less than ``share`` of the polygon's
   area and more than ``keep`` points remain. A point in the middle of a straight edge has a triangle of almost
   nothing; a real corner has a large one. */
function corners(points, share, keep) {
  share = share === undefined ? 0.02 : share;
  keep = keep === undefined ? 4 : keep;
  var kept = points.map(function (p) { return [p[0], p[1]]; });
  var limit = area(kept) * share;
  while (kept.length > keep) {
    var smallest = -1, least = Infinity;
    for (var i = 0; i < kept.length; i += 1) {
      var size = triangle(kept[(i + kept.length - 1) % kept.length], kept[i], kept[(i + 1) % kept.length]);
      if (size < least) { least = size; smallest = i; }
    }
    if (least >= limit) break;
    kept.splice(smallest, 1);
  }
  return kept;
}

/* The smallest outline without a dent that holds every one of the points (their convex hull). Fewer than three
   points that differ give back what there is. The same rule as labels.hull. */
function hull(points) {
  var seen = {}, spots = [];
  points.forEach(function (p) { var key = p[0] + ',' + p[1]; if (!seen[key]) { seen[key] = true; spots.push([p[0], p[1]]); } });
  spots.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  if (spots.length < 3) return spots;
  function turn(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
  var lower = [], upper = [], i;
  for (i = 0; i < spots.length; i += 1) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], spots[i]) <= 0) lower.pop();
    lower.push(spots[i]);
  }
  for (i = spots.length - 1; i >= 0; i -= 1) {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], spots[i]) <= 0) upper.pop();
    upper.push(spots[i]);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/* The same polygon, running clockwise on screen and starting at the point nearest the top-left of its own box
   (labels.clockwise_from_top_left). */
function fromTopLeft(points) {
  var ordered = signedArea(points) < 0 ? points.slice().reverse() : points.slice();
  var left = Infinity, top = Infinity, start = 0, least = Infinity;
  ordered.forEach(function (p) { left = Math.min(left, p[0]); top = Math.min(top, p[1]); });
  ordered.forEach(function (p, index) {
    var far = (p[0] - left) * (p[0] - left) + (p[1] - top) * (p[1] - top);
    if (far < least) { least = far; start = index; }
  });
  return ordered.slice(start).concat(ordered.slice(0, start));
}

/* "Straighten": the wall an outline stands for. Its dents are filled (a model draws around the bed and the desk
   in front of a wall; the wall's corners are where it really ends, also behind furniture), then the points along
   an edge are dropped. The person asks for it, and ``tidyUp`` does it for a model's fresh answer where it is
   safe. The same rule as labels.whole. */
function whole(points, share) {
  var outline = hull(points);
  if (outline.length < 3 || area(outline) <= 0) return corners(points, share);
  return corners(fromTopLeft(outline), share);
}

function contains(points, at) {
  var inside = false;
  for (var i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    var a = points[i], b = points[j];
    if ((a[1] > at[1]) !== (b[1] > at[1]) && at[0] < (b[0] - a[0]) * (at[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function same(a, b) { return Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05; }
function tidy(points) {
  var out = [];
  points.forEach(function (p) { if (!out.length || !same(out[out.length - 1], p)) out.push(p); });
  if (out.length > 1 && same(out[0], out[out.length - 1])) out.pop();
  return out;
}

function far(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])); }

/* The two polygons a straight line through ``from`` and ``to`` cuts the polygon into, or null when the line does
   not cross its outline in exactly two places. Both polygons hold the two points of the cut, as the very same
   numbers.

   Where the cut ends: a click INSIDE the shape is the corner itself, and the outline bends to it. A model's area
   runs straight over a room corner, above the place where the ceiling meets it; the person clicks the real top
   and the real bottom of the corner and both walls get them. A click outside the shape, or within ``near`` of
   its outline, only says where the line runs: the cut then ends on the outline. */
function split(points, from, to, near) {
  var dx = to[0] - from[0], dy = to[1] - from[1];
  if (!dx && !dy) return null;
  var cuts = [];
  for (var i = 0; i < points.length; i += 1) {
    var a = points[i], b = points[(i + 1) % points.length];
    var ex = b[0] - a[0], ey = b[1] - a[1];
    var cross = dx * ey - dy * ex;
    if (Math.abs(cross) < 1e-9) continue;                              // this edge runs along the line
    var t = (dx * (from[1] - a[1]) - dy * (from[0] - a[0])) / cross;   // where on the edge, 0 at a and 1 at b
    if (t < 0 || t >= 1) continue;                                     // a corner belongs to the edge that starts at it
    cuts.push({ edge: i, point: [Math.round((a[0] + t * ex) * 10) / 10, Math.round((a[1] + t * ey) * 10) / 10] });
  }
  if (cuts.length !== 2) return null;
  near = near === undefined ? 0 : near;
  var clicks = far(from, cuts[0].point) + far(to, cuts[1].point) <= far(from, cuts[1].point) + far(to, cuts[0].point)
    ? [from, to] : [to, from];
  cuts.forEach(function (cut, c) {
    var click = clicks[c];
    if (far(click, cut.point) > near && contains(points, click)) {
      cut.point = [Math.round(click[0] * 10) / 10, Math.round(click[1] * 10) / 10];
    }
  });
  var first = [cuts[0].point], second = [cuts[1].point], i2;
  for (i2 = cuts[0].edge + 1; i2 <= cuts[1].edge; i2 += 1) first.push(points[i2]);
  first.push(cuts[1].point);
  for (i2 = cuts[1].edge + 1; i2 < points.length + cuts[0].edge + 1; i2 += 1) second.push(points[i2 % points.length]);
  second.push(cuts[0].point);
  first = tidy(first); second = tidy(second);
  if (first.length < 3 || second.length < 3 || area(first) < 1 || area(second) < 1) return null;
  return [first, second];
}

/* The point of the polygon's outline that is nearest to ``at``. */
function nearest(points, at) {
  var best = null, least = Infinity;
  for (var i = 0; i < points.length; i += 1) {
    var a = points[i], b = points[(i + 1) % points.length];
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var t = (dx || dy) ? Math.max(0, Math.min(1, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
    var spot = [a[0] + t * dx, a[1] + t * dy], gap = far(at, spot);
    if (gap < least) { least = gap; best = spot; }
  }
  return best;
}

/* The places where the outline bends INTO the shape (its dents), as the numbers of those points. A bend smaller
   than a 250th of the shape is a jagged edge, not a dent. */
function dented(points) {
  var count = points.length, turnsWith = signedArea(points) >= 0 ? 1 : -1, size = area(points), found = [];
  if (size <= 0) return found;
  for (var i = 0; i < count; i += 1) {
    var a = points[(i + count - 1) % count], b = points[i], c = points[(i + 1) % count];
    var turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (turn * turnsWith < 0 && triangle(a, b, c) >= size * 0.004) found.push(i);
  }
  return found;
}
/* True when the shape has a dent in its upper half: the ceiling shows between two walls there, or the shape
   runs around something that is not furniture. Filling it would draw a wall where there is none. */
function dentedAbove(points) {
  var top = Infinity, bottom = -Infinity;
  points.forEach(function (p) { top = Math.min(top, p[1]); bottom = Math.max(bottom, p[1]); });
  return dented(points).some(function (i) { return points[i][1] < (top + bottom) / 2; });
}

/* Where one shape that covers two walls is cut: at the room corner between them, or null when it shows none.

   Seen from inside a room, two walls that meet are lowest where they meet: the ceiling line dips to the corner
   and the floor line rises to it. So the outline of the two walls together has a dent at the top of the corner
   and a dent at its bottom, one above the other. The cut runs from the one to the other. Furniture makes dents
   too, but side by side along the floor, not one above the other. The two walls that come out share the two
   points of the cut exactly. */
function roomCut(points) {
  var count = points.length;
  if (count < 6) return null;
  var top = Infinity, bottom = -Infinity;
  points.forEach(function (p) { top = Math.min(top, p[1]); bottom = Math.max(bottom, p[1]); });
  var height = bottom - top, dents = dented(points), i, j;
  if (height <= 0) return null;
  var best = null;
  for (i = 0; i < dents.length; i += 1) {
    for (j = i + 1; j < dents.length; j += 1) {
      var from = dents[i], to = dents[j];
      if (to - from < 2 || count - (to - from) < 2) continue;                          // neighbours: nothing between them
      var p = points[from], q = points[to];
      var across = Math.abs(p[0] - q[0]), down = Math.abs(p[1] - q[1]);
      if (down < height * 0.3 || across > down * 0.25) continue;                      // a room corner stands upright
      var inside = [0.25, 0.5, 0.75].every(function (t) {
        return contains(points, [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      });
      if (inside && (!best || across / down < best.lean)) best = { from: from, to: to, lean: across / down };
    }
  }
  if (!best) return null;
  return [points.slice(best.from, best.to + 1), points.slice(best.to).concat(points.slice(0, best.from + 1))];
}

/* What a model drew, brought nearer to a label BY ITSELF, in the order a person would do it (2026-10-13, asked for
   by the owner: "why not automatic"). Returns ``{shapes, cut, straightened, moved}``; the counts say what was done.

   1. A shape over two or three walls is cut at every room corner it shows (``roomCut``).
   2. Each wall is brought to its corners (``whole``), which fills its dents. Furniture in front of a wall dents it
      from the floor, and filling that is right. A dent in the upper half is the ceiling between two walls: for one
      day (2026-10-12) every area was straightened by itself, uncut, and a shape over two walls grew over the
      ceiling between them. So a shape with a dent above, or one that would grow by more than ``GROWS``, is left
      for the person.
   3. A window or a door that reaches a little outside its wall is brought inside it.

   It is a head start still: the person checks every corner and presses Done, and Undo shows what the model drew. */
var GROWS = 1.5, REACH = 0.2;
function tidyUp(shapes) {
  var out = [], walls = [], report = { cut: 0, straightened: 0, moved: 0 };
  function tenth(p) { return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; }
  shapes.forEach(function (shape) {
    if (shape.kind !== 'wall') { out.push({ kind: shape.kind, points: shape.points.map(tenth) }); return; }
    var pieces = [shape.points], again = true, rounds = 0;
    while (again && rounds < 6) {
      again = false; rounds += 1;
      var next = [];
      pieces.forEach(function (piece) {
        var halves = roomCut(piece);
        if (halves) { again = true; next.push(halves[0], halves[1]); } else next.push(piece);
      });
      pieces = next;
    }
    report.cut += pieces.length - 1;
    pieces.forEach(function (piece) {
      var kept = whole(piece).map(tenth);
      var made = { kind: 'wall', points: piece.map(tenth) };
      if (kept.length >= 3 && kept.length < piece.length && !dentedAbove(piece) && area(hull(piece)) <= area(piece) * GROWS) {
        made.points = kept;
        report.straightened += 1;
      } else if (pieces.length === 1 && shape.corner_types) {
        made.corner_types = shape.corner_types.slice();                            // untouched: its corners keep their names
      }
      out.push(made);
      walls.push(made);
    });
  });
  out.forEach(function (shape) {
    if (shape.kind === 'wall' || !walls.length) return;
    var centre = [0, 0];
    shape.points.forEach(function (p) { centre[0] += p[0] / shape.points.length; centre[1] += p[1] / shape.points.length; });
    // Its wall: the smallest one that holds its centre, else the one that holds most of its points.
    var home = null, most = 0;
    walls.forEach(function (wall) {
      if (contains(wall.points, centre) && (!home || !home.holds || area(wall.points) < area(home.wall.points))) home = { wall: wall, holds: true };
    });
    if (!home) {
      walls.forEach(function (wall) {
        var held = shape.points.filter(function (p) { return contains(wall.points, p); }).length;
        if (held > most) { most = held; home = { wall: wall, holds: false }; }
      });
    }
    if (!home) return;
    var left = Infinity, right = -Infinity, high = Infinity, low = -Infinity;
    shape.points.forEach(function (p) { left = Math.min(left, p[0]); right = Math.max(right, p[0]); high = Math.min(high, p[1]); low = Math.max(low, p[1]); });
    var reach = far([left, high], [right, low]) * REACH, changed = false, tooFar = false;
    var moved = shape.points.map(function (p) {
      if (contains(home.wall.points, p)) return p;
      var spot = nearest(home.wall.points, p), gap = far(p, spot);
      if (gap > reach) tooFar = true;
      if (gap > 0.05) changed = true;
      return tenth(spot);
    });
    if (tooFar || !changed) return;                                               // far outside: the person decides
    shape.points = moved;
    report.moved += 1;
  });
  report.shapes = out;
  return report;
}

export { area, corners, contains, split, hull, whole, nearest, roomCut, tidyUp };

// Whether the segment from `from` to `to` touches the shape: a click inside it, or the segment crossing its outline.
// A cut is made only through a shape it touches (the line through two clicks far away from a shape does not cut it).
export function crosses(points, from, to) {
  if (contains(points, from) || contains(points, to)) return true;
  const side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (side(from, to, a) * side(from, to, b) <= 0 && side(a, b, from) * side(a, b, to) <= 0) return true;
  }
  return false;
}

// The four corners of the box between two opposite corners, clockwise from the top left.
export function box(a, b) {
  const left = Math.min(a[0], b[0]), right = Math.max(a[0], b[0]), top = Math.min(a[1], b[1]), bottom = Math.max(a[1], b[1]);
  return [[left, top], [right, top], [right, bottom], [left, bottom]];
}
