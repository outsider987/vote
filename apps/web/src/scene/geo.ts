import * as THREE from "three";
import type { MultiPolygon, Polygon } from "geojson";
import { LAT0, LON0, MAP_SCALE, PAPER, SHIFT } from "../config";
import { clamp01 } from "../util";

/* Map projection and the extruded "paper stack" meshes. */

type Pt = [number, number];
export type Ring = Pt[];

const mercY = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const Y0 = mercY(LAT0);

/** Lon/lat → map plane; Kinmen and Matsu are shifted toward Taiwan. */
export function projector(code: string) {
  const [dLon, dLat] = SHIFT[code] || [0, 0];
  return ([lon, lat]: number[]): Pt => [(lon + dLon - LON0) * MAP_SCALE, (mercY(lat + dLat) - Y0) * MAP_SCALE];
}

function ringArea(r: Ring) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
}

function pointInRing([x, y]: Pt, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSeg(px: number, py: number, [ax, ay]: Pt, [bx, by]: Pt) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Approximate pole of inaccessibility: the interior point farthest from any edge. */
export function labelPoint(rings: Ring[]): Pt {
  const outer = rings[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  let best: Pt = [(minX + maxX) / 2, (minY + maxY) / 2], bestD = -1;
  const N = 26;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const p: Pt = [minX + ((maxX - minX) * i) / N, minY + ((maxY - minY) * j) / N];
    if (!pointInRing(p, outer) || rings.slice(1).some((h) => pointInRing(p, h))) continue;
    let d = Infinity;
    for (const r of rings) for (let k = 0, l = r.length - 1; k < r.length; l = k++) d = Math.min(d, distToSeg(p[0], p[1], r[l], r[k]));
    if (d > bestD) { bestD = d; best = p; }
  }
  return best;
}

export interface SideUniforms {
  uTop: { value: number };
  uBand: { value: THREE.Color };
  uBandMix: { value: number };
}

/** Stack sides: sheet seams every 0.09 units, darker at the foot, and a colored band just under the top. */
function makeSideMaterial() {
  const uniforms: SideUniforms = {
    uTop: { value: 0.05 },
    uBand: { value: new THREE.Color("#ffffff") },
    uBandMix: { value: 0 },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xf6f7f5, roughness: 0.93, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vWY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vWY;\nuniform float uTop;\nuniform vec3 uBand;\nuniform float uBandMix;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float seam = 1.0 - smoothstep(0.02, 0.2, fract(vWY / 0.09));
        diffuseColor.rgb *= 1.0 - 0.18 * seam;
        diffuseColor.rgb *= mix(0.8, 1.0, smoothstep(0.0, 0.3, vWY));
        float band = smoothstep(uTop - 0.055, uTop - 0.04, vWY);
        diffuseColor.rgb = mix(diffuseColor.rgb, uBand, band * uBandMix);`);
  };
  return { material: m, uniforms };
}

export interface Box { minX: number; minY: number; maxX: number; maxY: number }

export interface Stack {
  mesh: THREE.Mesh;
  caps: THREE.MeshStandardMaterial;
  sides: THREE.MeshStandardMaterial;
  uniforms: SideUniforms;
  /** The largest polygon, used to place the label. */
  biggest: Ring[];
  box: Box;
  /** Sampled outline points for camera framing. */
  points: THREE.Vector3[];
}

/** Extrude one geometry into a paper stack of height 1 (scaled per frame). */
export function buildStack(geometry: Polygon | MultiPolygon, P: (p: number[]) => Pt, { insetScale = 1, minArea = 0.003 } = {}): Stack {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let projected: Ring[][] = polys.map((poly) => poly.map((ring) => {
    const pts = ring.map(P);
    const a = pts[0], b = pts[pts.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) pts.pop();
    return pts;
  }));
  if (insetScale !== 1) {
    // enlarge each island around its own centre, keeping the islands' spacing
    projected = projected.map((rings) => {
      const xs = rings[0].map((pt) => pt[0]), ys = rings[0].map((pt) => pt[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      return rings.map((ring) => ring.map(([x, y]): Pt => [cx + (x - cx) * insetScale, cy + (y - cy) * insetScale]));
    });
  }
  const areas = projected.map((rings) => Math.abs(ringArea(rings[0])));
  const maxArea = Math.max(...areas);
  const shapes: THREE.Shape[] = [], points: THREE.Vector3[] = [];
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let biggest: Ring[] = projected[0], biggestArea = 0;
  projected.forEach((rings, i) => {
    const area = areas[i];
    if (area < minArea && area !== maxArea) return;   // drop small islets
    if (area > biggestArea) { biggestArea = area; biggest = rings; }
    for (const [x, y] of rings[0]) {
      box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y); box.maxY = Math.max(box.maxY, y);
    }
    const shape = new THREE.Shape(rings[0].map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of rings.slice(1)) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    shapes.push(shape);
    for (let k = 0; k < rings[0].length; k += 6) points.push(new THREE.Vector3(rings[0][k][0], 0, -rings[0][k][1]));
  });
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  const caps = new THREE.MeshStandardMaterial({ color: new THREE.Color(PAPER), roughness: 0.96, metalness: 0 });
  const { material: sides, uniforms } = makeSideMaterial();
  const mesh = new THREE.Mesh(geo, [caps, sides]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.y = 0.02;
  return { mesh, caps, sides, uniforms, biggest, box, points };
}

export function disposeStack(s: Stack) {
  s.mesh.geometry.dispose();
  s.caps.dispose();
  s.sides.dispose();
}
