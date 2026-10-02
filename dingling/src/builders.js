import * as THREE from 'three';
import { hatchMaterial, lineMaterial, makeLocal } from './materials.js';

// ---------- 构件集合：把许多小块合并成一个网格 + 一组线条 ----------

let seedCounter = 1;

export class PieceSet {
  constructor() {
    this.pos = []; this.nor = []; this.t = [];
    this.lpos = []; this.lt = []; this.lseed = [];
  }
  // geom：本地几何；matrix：放置矩阵；t：0..1 出场顺序
  add(geom, matrix, t = 0, edgeAngle = 20) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) this.t.push(t);
    let e;
    if (geom === _box) {
      if (!_boxEdges) _boxEdges = new THREE.EdgesGeometry(_box).attributes.position.array;
      e = new Float32Array(_boxEdges.length);
      const v = new THREE.Vector3();
      for (let i = 0; i < e.length; i += 3) {
        v.set(_boxEdges[i], _boxEdges[i + 1], _boxEdges[i + 2]).applyMatrix4(matrix);
        e[i] = v.x; e[i + 1] = v.y; e[i + 2] = v.z;
      }
    } else {
      e = new THREE.EdgesGeometry(g, edgeAngle).attributes.position.array;
    }
    pushStrokes(this, e, t);
    g.dispose();
  }
  addLines(arr, t = 0) { pushStrokes(this, arr, t); }
  build(opts = {}) {
    const local = opts.local ?? makeLocal(opts);
    const group = new THREE.Group();
    if (this.pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('aT', new THREE.Float32BufferAttribute(this.t, 1));
      g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, hatchMaterial(local, opts));
      mesh.frustumCulled = false;
      group.add(mesh);
      group.userData.bbox = g.boundingBox;
    }
    if (this.lpos.length && !opts.noLines) {
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(this.lpos, 3));
      lg.setAttribute('aT', new THREE.Float32BufferAttribute(this.lt, 1));
      lg.setAttribute('aSeed', new THREE.Float32BufferAttribute(this.lseed, 1));
      if (!group.userData.bbox) { lg.computeBoundingBox(); group.userData.bbox = lg.boundingBox; }
      const lines = new THREE.LineSegments(lg, lineMaterial(local, opts));
      lines.frustumCulled = false;
      lines.renderOrder = 2;
      group.add(lines);
    }
    group.userData.local = local;
    return group;
  }
}

// 每条边画两笔，端头略微出头，像手绘
function pushStrokes(ps, e, t) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < e.length; i += 6) {
    a.set(e[i], e[i + 1], e[i + 2]); b.set(e[i + 3], e[i + 4], e[i + 5]);
    d.subVectors(b, a); const len = d.length(); if (len < 1e-4) continue; d.divideScalar(len);
    for (let k = 0; k < 2; k++) {
      const ext = Math.min(len * (k ? 0.07 : 0.035), k ? 0.45 : 0.25);
      ps.lpos.push(a.x - d.x * ext, a.y - d.y * ext, a.z - d.z * ext, b.x + d.x * ext, b.y + d.y * ext, b.z + d.z * ext);
      const s1 = (seedCounter++ % 9973) * 0.731, s2 = (seedCounter++ % 9973) * 0.731;
      ps.lseed.push(s1, s2); ps.lt.push(t, t);
    }
  }
}

// ---------- 基本几何 ----------

const _box = new THREE.BoxGeometry(1, 1, 1);
let _boxEdges = null;
export function boxMatrix(cx, cy, cz, sx, sy, sz, rotY = 0) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(cx, cy, cz),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(sx, sy, sz));
  return m;
}
export function addBox(ps, cx, cy, cz, sx, sy, sz, t, rotY = 0) {
  ps.add(_box, boxMatrix(cx, cy, cz, sx, sy, sz, rotY), t);
}

// 楔形券石：内外半径、角度区间（绕 w 轴，0 在 +u 方向），w0..w1 为沿轴长度
export function wedgeGeometry(rIn, rOut, a0, a1, w0, w1) {
  const P = (r, a, w) => [r * Math.cos(a), r * Math.sin(a), w];
  const v = [P(rIn, a0, w0), P(rOut, a0, w0), P(rOut, a1, w0), P(rIn, a1, w0),
             P(rIn, a0, w1), P(rOut, a0, w1), P(rOut, a1, w1), P(rIn, a1, w1)];
  const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  const pos = [];
  for (const q of quads) {
    for (const i of [q[0], q[1], q[2], q[0], q[2], q[3]]) pos.push(...v[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// 局部 (u,v,w) → 世界。axis z：u 朝西、w 朝北；axis x：u 朝北、w 朝东
export function hallFrame(h, y0) {
  const m = new THREE.Matrix4();
  if (h.axis === 'z') {
    m.makeRotationY(Math.PI).setPosition(h.cx, y0, h.zStart);
  } else {
    m.makeRotationY(Math.PI / 2).setPosition(h.xStart, y0, h.cz);
  }
  return m;
}

// 石券殿：墙身条石 + 拱券楔石 + 金砖地面
export function buildHall(h, y0, wallSet, floorSet, contour) {
  const frame = hallFrame(h, y0);
  const W = h.W, H = h.H, T = h.T, r = W / 2, spring = H - r;
  const course = 0.62, blockL = 1.25;
  const opens = h.openings || [];
  const tmp = new THREE.Matrix4();
  const jitter = () => (Math.random() - 0.5) * 0.04;

  // 墙身
  for (const side of [-1, 1]) {
    const uc = side * (r + T / 2);
    const rows = Math.ceil(spring / course);
    for (let row = 0; row < rows; row++) {
      const yA = row * course, yB = Math.min(spring, yA + course);
      const off = (row % 2) * blockL / 2;
      for (let w = -off; w < h.len; w += blockL) {
        const wA = Math.max(0, w), wB = Math.min(h.len, w + blockL);
        if (wB - wA < 0.05) continue;
        const hit = opens.some(o => o.side === side && wB > o.w - o.width / 2 && wA < o.w + o.width / 2 && yA < o.h);
        if (hit) continue;
        tmp.copy(frame).multiply(boxMatrix(uc, (yA + yB) / 2, (wA + wB) / 2, T, yB - yA, wB - wA));
        wallSet.add(_box, tmp, clamp01((yA + 0.3) / (H + T)) * 0.9 + jitter());
      }
    }
    // 门洞过梁
    for (const o of opens.filter(o => o.side === side)) {
      if (o.h + 0.5 > spring) continue;
      tmp.copy(frame).multiply(boxMatrix(uc, o.h + 0.25, o.w, T, 0.5, o.width + 0.6));
      wallSet.add(_box, tmp, clamp01((o.h + 0.3) / (H + T)) * 0.9);
    }
  }

  // 拱券：每圈约 1 m，相邻圈错缝
  const ringL = 1.0;
  const n = Math.max(5, Math.round(Math.PI * (r + T / 2) / 0.6));
  const arch = new THREE.Matrix4().makeTranslation(0, spring, 0);
  let ring = 0;
  for (let w = 0; w < h.len - 1e-3; w += ringL, ring++) {
    const w1 = Math.min(h.len, w + ringL);
    const shift = (ring % 2) ? 0.5 : 0;
    const edges = [0];
    for (let k = 1; k < n + (shift ? 1 : 0); k++) edges.push(Math.min(Math.PI, (k - shift) * Math.PI / n));
    edges.push(Math.PI);
    for (let k = 0; k < edges.length - 1; k++) {
      const a0 = edges[k], a1 = edges[k + 1];
      if (a1 - a0 < 0.02) continue;
      const g = wedgeGeometry(r, r + T, a0, a1, w, w1);
      const mid = (a0 + a1) / 2;
      const t = clamp01((spring + r * Math.sin(mid) + 0.3) / (H + T)) * 0.9 + 0.08 * (Math.abs(mid - Math.PI / 2) < 0.3 ? 1 : 0);
      tmp.copy(frame).multiply(arch);
      wallSet.add(g, tmp, t);
      g.dispose();
    }
  }

  // 远看时的轮廓线：两端券形 + 纵向墙脚、起拱、券顶
  if (contour) {
    const a = [];
    const prof = (w, rr, uOff) => {
      const N = 24;
      a.push(-uOff, 0, w, -uOff, spring, w, uOff, 0, w, uOff, spring, w);
      for (let i = 0; i < N; i++) {
        const t0 = i / N * Math.PI, t1 = (i + 1) / N * Math.PI;
        a.push(rr * Math.cos(t0), spring + rr * Math.sin(t0), w, rr * Math.cos(t1), spring + rr * Math.sin(t1), w);
      }
    };
    prof(0, r + T, r + T); prof(h.len, r + T, r + T);
    for (const u of [-(r + T), r + T]) { a.push(u, 0, 0, u, 0, h.len, u, spring, 0, u, spring, h.len); }
    a.push(0, H + T, 0, 0, H + T, h.len);
    const v = new THREE.Vector3();
    for (let i = 0; i < a.length; i += 3) {
      v.set(a[i], a[i + 1], a[i + 2]).applyMatrix4(frame);
      a[i] = v.x; a[i + 1] = v.y; a[i + 2] = v.z;
    }
    contour.addLines(a, 0.95);
  }

  // 金砖地面
  if (floorSet) {
    const s = 0.64;
    for (let w = 0; w < h.len - 0.01; w += s) {
      for (let u = -r; u < r - 0.01; u += s) {
        const uB = Math.min(r, u + s), wB = Math.min(h.len, w + s);
        tmp.copy(frame).multiply(boxMatrix((u + uB) / 2, 0.06, (w + wB) / 2, uB - u - 0.03, 0.12, wB - w - 0.03));
        floorSet.add(_box, tmp, clamp01(w / h.len));
      }
    }
  }
}

// 端墙 / 券门墙（挤出体，外轮廓随殿身，内开拱门）
export function endWallGeometry(ew) {
  const { W, H, T } = ew.profile;
  const r = W / 2, spring = H - r, R2 = r + T;
  const s = new THREE.Shape();
  s.moveTo(-R2, 0); s.lineTo(R2, 0); s.lineTo(R2, spring);
  s.absarc(0, spring, R2, 0, Math.PI, false);
  s.lineTo(-R2, 0);
  if (ew.hole) {
    const hw = ew.hole.w / 2, hh = ew.hole.h;
    const p = new THREE.Path();
    p.moveTo(-hw, 0.0001); p.lineTo(-hw, hh);
    p.absarc(0, hh, hw, Math.PI, 0, true);
    p.lineTo(hw, 0.0001); p.lineTo(-hw, 0.0001);
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: ew.thick, bevelEnabled: false, curveSegments: 20 });
  return g;
}

// 庑殿式屋顶：底面半宽 a、半深 b，正脊半长 c，高 h
export function hipRoofGeometry(a, b, c, h) {
  const v = [[-a, 0, -b], [a, 0, -b], [a, 0, b], [-a, 0, b], [-c, h, 0], [c, h, 0]];
  const faces = [[3, 2, 5, 4], [1, 0, 4, 5], [2, 1, 5], [0, 3, 4], [0, 1, 2, 3]];
  const pos = [];
  for (const f of faces) {
    const tri = f.length === 4 ? [f[0], f[1], f[2], f[0], f[2], f[3]] : f;
    for (const i of tri) pos.push(...v[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ---------- 通用 ----------

export function clamp01(x) { return Math.max(0, Math.min(1, x)); }

export function lathe(points, segs = 64) {
  return new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), segs);
}

// 单个网格 + 边线（不合并，用于门扇、自来石等需要单独运动的构件）
export function solid(geom, local, opts = {}) {
  const group = new THREE.Group();
  const g = geom.index ? geom.toNonIndexed() : geom;
  const mesh = new THREE.Mesh(g, hatchMaterial(local, opts));
  group.add(mesh);
  if (!opts.noLines) {
    const ps = new PieceSet();
    ps.addLines(new THREE.EdgesGeometry(g, opts.edgeAngle ?? 20).attributes.position.array, 0);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(ps.lpos, 3));
    lg.setAttribute('aT', new THREE.Float32BufferAttribute(ps.lt, 1));
    lg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ps.lseed, 1));
    const lines = new THREE.LineSegments(lg, lineMaterial(local, opts));
    lines.renderOrder = 2;
    group.add(lines);
  }
  return group;
}

// 纯线条（施工辅助线、红色构造圆等）
export function linesOnly(arr, local, opts = {}) {
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  const n = arr.length / 3;
  lg.setAttribute('aT', new THREE.Float32BufferAttribute(new Array(n).fill(0), 1));
  lg.setAttribute('aSeed', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => Math.random() * 999), 1));
  const lines = new THREE.LineSegments(lg, lineMaterial(local, opts));
  lines.frustumCulled = false;
  lines.renderOrder = 1;
  return lines;
}

export function circleSegs(cx, y, cz, r, n = 128, dash = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (dash && i % 2) continue;
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    out.push(cx + r * Math.cos(a0), y, cz + r * Math.sin(a0), cx + r * Math.cos(a1), y, cz + r * Math.sin(a1));
  }
  return out;
}
