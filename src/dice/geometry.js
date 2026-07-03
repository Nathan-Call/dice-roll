/**
 * Dice geometry engine.
 *
 * For each die we need two things:
 *   1. A BufferGeometry to render the solid.
 *   2. A list of faces — each with a centroid and outward normal — so we can
 *      stamp a number on every face and rotate the die so a chosen face points
 *      at the camera.
 *
 * Platonic solids come straight from three's built-in geometries; their faces
 * are recovered by clustering triangles that share an outward direction. The
 * d10 (pentagonal trapezohedron) isn't a built-in, so we build it by hand.
 *
 * Every solid is centred on the origin and convex, so a face's outward normal
 * is simply the normalised direction of its centroid — no cross products or
 * winding bookkeeping required for number placement.
 */

import * as THREE from 'three';

const RADIUS = 1;

/** Build the raw (un-numbered) geometry for a die kind. */
function buildGeometry(kind) {
  switch (kind) {
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(RADIUS);
    case 'cube':
      // Match the circumradius of the radius-1 solids for consistent sizing.
      return new THREE.BoxGeometry(1.18, 1.18, 1.18);
    case 'octahedron':
      return new THREE.OctahedronGeometry(RADIUS);
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(RADIUS);
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(RADIUS);
    case 'trapezohedron':
      return buildTrapezohedron();
    default:
      throw new Error(`Unknown die kind: ${kind}`);
  }
}

/**
 * Pentagonal trapezohedron (the d10 shape): two apexes joined by an alternating
 * ring of ten vertices, giving ten kite faces.
 */
function buildTrapezohedron() {
  const ringY = 0.16;
  const ringR = 1.25;
  // For the kite faces to be planar, the apex height is fixed by the ring
  // half-height: apexY = ringY · (1 + cos36°) / (1 − cos36°). Any other value
  // bends each kite along its diagonal and breaks flat-face detection.
  const cos36 = (1 + Math.sqrt(5)) / 4;
  const apexY = ringY * ((1 + cos36) / (1 - cos36));

  const north = new THREE.Vector3(0, apexY, 0);
  const south = new THREE.Vector3(0, -apexY, 0);
  const upper = [];
  const lower = [];
  for (let i = 0; i < 5; i++) {
    const aUp = (i * 2 * Math.PI) / 5;
    const aLo = aUp + Math.PI / 5; // +36°
    upper.push(new THREE.Vector3(Math.cos(aUp) * ringR, ringY, Math.sin(aUp) * ringR));
    lower.push(new THREE.Vector3(Math.cos(aLo) * ringR, -ringY, Math.sin(aLo) * ringR));
  }

  // Ten kite faces: five hang from the north apex, five from the south.
  const kites = [];
  for (let i = 0; i < 5; i++) {
    const next = (i + 1) % 5;
    kites.push([north, upper[i], lower[i], upper[next]]);
    kites.push([south, lower[i], upper[next], lower[next]]);
  }

  const positions = [];
  for (const kite of kites) {
    // Fan-triangulate the kite, fixing winding so normals point outward.
    addTriangle(positions, kite[0], kite[1], kite[2]);
    addTriangle(positions, kite[0], kite[2], kite[3]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Push a triangle, flipping winding if its normal faces inward. */
function addTriangle(out, a, b, c) {
  const centroid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
  const normal = new THREE.Vector3()
    .subVectors(b, a)
    .cross(new THREE.Vector3().subVectors(c, a));
  const verts = normal.dot(centroid) < 0 ? [a, c, b] : [a, b, c];
  for (const v of verts) out.push(v.x, v.y, v.z);
}

/**
 * Recover flat faces from a triangulated geometry.
 *
 * Triangles are grouped by their (outward) geometric normal — identical for
 * every triangle of a coplanar face, so this is robust even when three fans a
 * polygon from a single vertex. The face centre is the average of the face's
 * *unique* vertices (the true polygon centroid), so numbers sit dead-centre
 * rather than being pulled toward a fan vertex.
 */
function facesFromGeometry(geo) {
  const pos = geo.attributes.position;
  const index = geo.index ? geo.index.array : null;
  const triCount = index ? index.length / 3 : pos.count / 3;

  // Cluster triangles by normal using an angular tolerance rather than a
  // rounded string key — the latter can split one face in two when a normal
  // component lands exactly on a rounding boundary.
  const groups = [];
  const SAME_FACE = 0.999; // cos of ~2.5°
  const get = (i) => {
    const vi = index ? index[i] : i;
    return new THREE.Vector3().fromBufferAttribute(pos, vi);
  };

  for (let t = 0; t < triCount; t++) {
    const a = get(t * 3);
    const b = get(t * 3 + 1);
    const c = get(t * 3 + 2);
    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();
    // Ensure the normal points outward (away from the origin-centred solid).
    if (normal.dot(a) < 0) normal.negate();

    let group = groups.find((g) => g.normal.dot(normal) > SAME_FACE);
    if (!group) {
      group = { normal, verts: new Map() };
      groups.push(group);
    }
    for (const v of [a, b, c]) {
      const vk = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      if (!group.verts.has(vk)) group.verts.set(vk, v);
    }
  }

  return groups.map((g) => {
    const center = new THREE.Vector3();
    for (const v of g.verts.values()) center.add(v);
    center.divideScalar(g.verts.size);
    return { center, normal: g.normal.clone() };
  });
}

/**
 * Assign face numbers. For an even face count we pair opposite faces so they
 * sum to (sides + 1), mirroring real dice; otherwise we number by height.
 */
function numberFaces(faces, sides) {
  // Sort a stable, deterministic way (top-to-bottom, then around).
  const ordered = [...faces].sort((a, b) => {
    if (Math.abs(a.center.y - b.center.y) > 1e-3) return b.center.y - a.center.y;
    return Math.atan2(a.center.z, a.center.x) - Math.atan2(b.center.z, b.center.x);
  });

  const used = new Array(ordered.length).fill(false);
  let value = 1;
  for (let i = 0; i < ordered.length; i++) {
    if (used[i]) continue;
    ordered[i].number = value;
    used[i] = true;
    // Find the antipodal face and give it the complementary number.
    let best = -1;
    let bestDot = Infinity;
    for (let j = 0; j < ordered.length; j++) {
      if (used[j]) continue;
      const dot = ordered[i].normal.dot(ordered[j].normal);
      if (dot < bestDot) {
        bestDot = dot;
        best = j;
      }
    }
    if (best >= 0 && bestDot < -0.5) {
      ordered[best].number = sides + 1 - value;
      used[best] = true;
    }
    value += 1;
    // Skip values already handed to an opposite face.
    while (value <= sides && ordered.some((f) => f.number === value)) value += 1;
  }
  return ordered;
}

/** Build the complete, numbered die for a config kind. */
export function buildDie(kind, sides) {
  const geometry = buildGeometry(kind);
  const faces = numberFaces(facesFromGeometry(geometry), sides);
  return { geometry, faces };
}

/**
 * Build a d4 whose values live at the tetrahedron's corners (like a real d4):
 * every face shows the value of each of its three corner vertices. Returns the
 * geometry, the four values with their outward vertex directions (used to land
 * the result vertex pointing up), and the twelve corner labels.
 */
export function buildD4() {
  const radius = 1;
  const raw = [
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(-1, -1, 1),
    new THREE.Vector3(-1, 1, -1),
    new THREE.Vector3(1, -1, -1),
  ];
  const dirs = raw.map((v) => v.clone().normalize());
  const verts = dirs.map((d) => d.clone().multiplyScalar(radius));
  const vertexValue = [1, 2, 3, 4];

  const values = dirs.map((dir, i) => ({ value: vertexValue[i], dir }));

  // Each face is opposite one vertex; its outward normal points away from it.
  const labels = [];
  for (let k = 0; k < 4; k++) {
    const faceIdx = [0, 1, 2, 3].filter((i) => i !== k);
    const normal = dirs[k].clone().negate(); // outward normal of face opposite k
    const center = dirs[k].clone().multiplyScalar(-radius / 3); // face centroid
    for (const j of faceIdx) {
      const up = verts[j].clone().sub(center).normalize(); // toward the corner
      const right = up.clone().cross(normal).normalize();
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(right, up, normal),
      );
      const position = center
        .clone()
        .lerp(verts[j], 0.62)
        .add(normal.clone().multiplyScalar(0.015));
      labels.push({ value: vertexValue[j], position, quaternion });
    }
  }

  return { geometry: buildGeometry('tetrahedron'), radius, values, labels };
}
