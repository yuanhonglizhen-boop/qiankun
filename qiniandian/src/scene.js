import * as THREE from 'three';
import { TIERS, TOP, FLOOR, COLUMNS, colAngles, ROOFS, DRUMS } from './data.js';
import { PieceSet, addBox, boxMatrix, lathe, solid, linesOnly, circleSegs, clamp01, finialGeos } from './builders.js';
import { makeLocal } from './materials.js';

const TINT = {
  marble: '#ece7da', column: '#a83a2c', paint: '#3f7a74', roof: '#2d5596', drum: '#9b3a2e',
  lattice: '#a3402f', gold: '#c9a24a', ceiling: '#3c6f73', floor: '#8d8a84', base: '#d8d2c3',
};

const up = new THREE.Vector3(0, 1, 0);
const polar = (r, a, y = 0) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
// 让盒子的局部 z 轴指向角度 a 的径向
const radialRot = (a) => Math.PI / 2 - a;

export function buildHall(scene) {
  const parts = [];
  const root = new THREE.Group();
  scene.add(root);
  const reg = (obj, s0, s1, extra = {}) => {
    if (!extra.proxy) root.add(obj);
    const p = { obj, s0, s1, local: obj.userData.local, ...extra };
    parts.push(p);
    return p;
  };
  const growSolid = (geom, tint, s0, s1, opts = {}) => {
    const local = makeLocal({ mode: 0 });
    const s = solid(geom, local, { tint, ...opts });
    s.userData.local = local;
    return reg(s, s0, s1, { grow: true });
  };

  // ---------- 地面构造线 ----------
  const red = makeLocal(); red.uProg.value = 1;
  let arr = [];
  for (const r of [52, 64, 82]) arr.push(...circleSegs(0, 0, 0, r, 180));
  arr.push(0, 0, 95, 0, 0, -95, -95, 0, 0, 95, 0, 0);
  root.add(linesOnly(arr, red, { red: true, alpha: 0.34, noClip: true }));
  const faint = makeLocal(); faint.uProg.value = 1;
  root.add(linesOnly(circleSegs(0, 0, 0, 47.5, 200, true), faint, { alpha: 0.3, noClip: true }));

  // ---------- 三层台基 ----------
  TIERS.forEach((t, i) => {
    const g = new THREE.CylinderGeometry(t.r, t.r, t.y1 - t.y0, 160, 1).translate(0, (t.y0 + t.y1) / 2, 0);
    growSolid(g, TINT.base, i * 2.6, i * 2.6 + 2.8, { edgeAngle: 30, detail: 400 });
  });

  // ---------- 栏杆与台阶 ----------
  {
    const rail = new PieceSet(), stairs = new PieceSet();
    const stairDirs = [Math.PI / 2, -Math.PI / 2, 0, Math.PI]; // 南、北、东、西
    TIERS.forEach((t, ti) => {
      const rr = t.r - 0.35, y = t.y1;
      const stairHalf = (ti === 2 ? 4.2 : 4.6) / rr; // 台阶口所占角度的一半
      const nPost = Math.round(2 * Math.PI * rr / 2.1);
      const inGap = (a) => stairDirs.some((d) => Math.abs(Math.atan2(Math.sin(a - d), Math.cos(a - d))) < stairHalf);
      for (let k = 0; k < nPost; k++) {
        const a = k / nPost * Math.PI * 2, a2 = (k + 1) / nPost * Math.PI * 2;
        if (inGap(a)) continue;
        const p = polar(rr, a);
        const tt = ti * 0.3 + (k / nPost) * 0.25;
        addBox(rail, p.x, y + 0.6, p.z, 0.22, 1.2, 0.22, tt, radialRot(a));
        addBox(rail, p.x, y + 1.27, p.z, 0.16, 0.14, 0.16, tt, radialRot(a));
        if (inGap(a2)) continue;
        const m = polar(rr, (a + a2) / 2), seg = 2 * rr * Math.sin((a2 - a) / 2) - 0.24;
        addBox(rail, m.x, y + 0.38, m.z, seg, 0.62, 0.1, tt + 0.02, radialRot((a + a2) / 2) + Math.PI / 2 - Math.PI / 2);
        addBox(rail, m.x, y + 0.86, m.z, seg, 0.1, 0.14, tt + 0.03, radialRot((a + a2) / 2));
      }
      // 台阶：每层 9 步
      for (const d of stairDirs) {
        const w = d === Math.PI / 2 ? 9.2 : 6.4;
        const below = ti === 0 ? 0 : TIERS[ti - 1].y1;
        const h = t.y1 - below, steps = 9, rise = h / steps, tread = 0.36;
        for (let s = 0; s < steps; s++) {
          const rr2 = t.r + tread * (s + 0.5);
          const p = polar(rr2, d);
          const yTop = t.y1 - rise * (s + 1);
          addBox(stairs, p.x, (below + yTop + rise) / 2, p.z, w, yTop + rise - below, tread, ti * 0.3 + s * 0.02, radialRot(d));
        }
      }
    });
    reg(rail.build({ mode: 1, drop: 1.6, tint: TINT.marble, detail: 0.5 }), 8, 14);
    reg(stairs.build({ mode: 1, drop: 1.2, tint: TINT.marble, detail: 0.9 }), 7, 13);
  }

  // ---------- 台明与柱础 ----------
  growSolid(new THREE.CylinderGeometry(13.4, 13.6, FLOOR - TOP, 120).translate(0, (TOP + FLOOR) / 2, 0), TINT.marble, 14, 15.5, { edgeAngle: 30 });
  {
    const ps = new PieceSet();
    const g = new THREE.CylinderGeometry(1, 1.15, 1, 16);
    for (const [k, c] of Object.entries(COLUMNS)) {
      for (const a of colAngles(c)) {
        const p = polar(c.r, a);
        ps.add(g, new THREE.Matrix4().compose(new THREE.Vector3(p.x, FLOOR + 0.15, p.z), new THREE.Quaternion(), new THREE.Vector3(c.d * 0.95, 0.3, c.d * 0.95)), Math.random() * 0.3, 40);
      }
    }
    reg(ps.build({ mode: 1, drop: 1.2, tint: TINT.marble, detail: 0.8 }), 15, 17);
  }

  // ---------- 三圈柱子 ----------
  const colGroups = {};
  const colTiming = { dragon: [17, 22], gold: [22, 28], eave: [28, 33] };
  for (const [key, c] of Object.entries(COLUMNS)) {
    const geos = [];
    for (const a of colAngles(c)) {
      const p = polar(c.r, a);
      geos.push(new THREE.CylinderGeometry(c.d / 2 * 0.94, c.d / 2, c.h, 20).translate(p.x, FLOOR + 0.3 + c.h / 2 - 0.3, p.z));
    }
    const merged = mergeGeos(geos);
    const p = growSolid(merged, TINT.column, ...colTiming[key], { edgeAngle: 40, detail: 1.5 });
    colGroups[key] = p.obj;
  }

  // ---------- 枋与梁 ----------
  const beams = new PieceSet();
  const ringBeams = (c, y, t0) => {
    const as = colAngles(c);
    for (let i = 0; i < as.length; i++) {
      const a = as[i], b = as[(i + 1) % as.length];
      const pa = polar(c.r, a), pb = polar(c.r, b);
      const m = pa.clone().add(pb).multiplyScalar(0.5), len = pa.distanceTo(pb);
      const rot = Math.atan2(pb.x - pa.x, pb.z - pa.z) + Math.PI / 2;
      addBox(beams, m.x, y - 0.35, m.z, len, 0.7, 0.42, t0 + i * 0.01, rot);
      addBox(beams, m.x, y - 1.25, m.z, len, 0.5, 0.36, t0 + i * 0.01, rot);
    }
  };
  ringBeams(COLUMNS.dragon, COLUMNS.dragon.top, 0.6);
  ringBeams(COLUMNS.gold, COLUMNS.gold.top, 0.3);
  ringBeams(COLUMNS.eave, COLUMNS.eave.top, 0.0);
  // 径向梁：檐柱 → 金柱；金柱 → 中心（承托上层童柱）
  const radialBeam = (r0, r1, a, y, t) => {
    const p0 = polar(r0, a), p1 = polar(r1, a), m = p0.clone().add(p1).multiplyScalar(0.5);
    addBox(beams, m.x, y, m.z, 0.42, 0.6, Math.abs(r1 - r0), t, radialRot(a));
  };
  for (const a of colAngles(COLUMNS.eave)) radialBeam(COLUMNS.eave.r, COLUMNS.gold.r, a, COLUMNS.eave.top - 0.3, 0.15);
  for (const a of colAngles(COLUMNS.gold)) radialBeam(COLUMNS.gold.r, COLUMNS.dragon.r - 0.6, a, COLUMNS.gold.top - 0.3, 0.45);
  reg(beams.build({ mode: 1, drop: 2.2, tint: TINT.paint, detail: 1.2 }), 33, 40);

  // 童柱：立在金柱梁上，撑起上层鼓身（示意 8 根）
  {
    const ps = new PieceSet();
    const g = new THREE.CylinderGeometry(0.28, 0.3, 1, 12);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + i * Math.PI / 4, p = polar(5.9, a);
      const y0 = COLUMNS.gold.top, y1 = DRUMS[1].y1;
      ps.add(g, new THREE.Matrix4().compose(new THREE.Vector3(p.x, (y0 + y1) / 2, p.z), new THREE.Quaternion(), new THREE.Vector3(1, y1 - y0, 1)), i * 0.05, 40);
    }
    reg(ps.build({ mode: 1, drop: 2, tint: TINT.column, detail: 1.2 }), 66, 69);
  }

  // ---------- 斗拱 ----------
  const brackets = [];
  ROOFS.forEach((rf, ri) => {
    const ps = new PieceSet();
    for (let k = 0; k < rf.n; k++) {
      const a = (k + 0.5) / rf.n * Math.PI * 2, rot = radialRot(a);
      const t = k / rf.n * 0.6;
      const at = (dr, dy) => polar(rf.bracketR + dr, a, rf.bracketY + dy);
      let p = at(0, 0.15); addBox(ps, p.x, p.y, p.z, 0.42, 0.3, 0.42, t, rot);          // 坐斗
      p = at(0.15, 0.4); addBox(ps, p.x, p.y, p.z, 1.3, 0.2, 0.24, t + 0.1, rot);      // 横拱
      p = at(0.35, 0.4); addBox(ps, p.x, p.y, p.z, 0.24, 0.2, 1.1, t + 0.1, rot);      // 翘
      p = at(0.6, 0.62); addBox(ps, p.x, p.y, p.z, 0.32, 0.24, 0.32, t + 0.2, rot);    // 升
      p = at(0.6, 0.82); addBox(ps, p.x, p.y, p.z, 1.6, 0.2, 0.24, t + 0.25, rot);     // 外拽拱
      p = at(0.85, 0.82); addBox(ps, p.x, p.y, p.z, 0.24, 0.2, 1.4, t + 0.25, rot);    // 昂
    }
    const s = [40 + ri * 2, 44 + ri * 2];
    brackets.push(reg(ps.build({ mode: 1, drop: 1.4, tint: TINT.paint, detail: 0.5 }), ...s));
  });

  // ---------- 鼓身 ----------
  DRUMS.forEach((d, i) => {
    const g = new THREE.CylinderGeometry(d.r, d.r, d.y1 - d.y0, 96, 1, true).translate(0, (d.y0 + d.y1) / 2, 0);
    const ring = new THREE.CylinderGeometry(d.r + 0.15, d.r + 0.15, 0.5, 96, 1, true).translate(0, d.y1 - 0.25, 0);
    const merged = mergeGeos([g, ring]);
    growSolid(merged, i === 0 ? TINT.lattice : TINT.drum, i === 0 ? 55 : 66, i === 0 ? 60 : 71, { edgeAngle: 30, detail: 400, kind: 2 });
  });
  // 中层槛窗格子线
  {
    const ps = new PieceSet(), d = DRUMS[0];
    const a = [];
    for (let k = 0; k < 48; k++) {
      const ang = k / 48 * Math.PI * 2, p0 = polar(d.r + 0.02, ang, d.y0 + 0.3), p1 = polar(d.r + 0.02, ang, d.y1 - 0.6);
      a.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
    for (let y = d.y0 + 0.3; y <= d.y1 - 0.6; y += 0.3) a.push(...circleSegs(0, y, 0, d.r + 0.02, 96));
    ps.addLines(a, 0);
    reg(ps.build({ mode: 0, detail: 0.3, alpha: 0.55 }), 57, 60, { grow: true, linesOnlyGrow: [d.y0, d.y1] });
  }

  // ---------- 三重檐 ----------
  const roofs = [];
  ROOFS.forEach((rf, i) => {
    const [r0, y0] = rf.lip, [r1, y1] = rf.top;
    const N = 18, prof = [];
    const curve = (t) => [r0 + (r1 - r0) * t, y0 + (y1 - y0) * Math.pow(t, 1.55)];
    // 外表面：由内（上）到外（檐口）
    for (let k = N; k >= 0; k--) prof.push(curve(k / N));
    prof.push([r0 + 0.15, y0 - 0.15], [r0, y0 - 0.55]);
    // 内表面（椽望），向内收
    for (let k = 0; k <= N; k++) { const [r, y] = curve(k / N); prof.push([Math.max(0, r - 0.35), y - 0.7]); }
    if (i === 2) { prof.unshift([0, y1 + 0.05]); prof.push([0, y1 - 0.7]); }
    const g = lathe(prof.reverse(), 144);
    const s0 = [47, 60, 71][i], s1 = s0 + 7;
    const part = growSolid(g, TINT.roof, s0, s1, { edgeAngle: 35, detail: 400 });
    roofs.push(part);
    // 瓦垄线
    const tl = [], meridians = Math.round(r0 * 2 * Math.PI / 0.9);
    for (let m = 0; m < meridians; m++) {
      const a = m / meridians * Math.PI * 2;
      for (let k = 0; k < N; k++) {
        const [ra, ya] = curve(k / N), [rb, yb] = curve((k + 1) / N);
        const pa = polar(ra + 0.01, a, ya + 0.04), pb = polar(rb + 0.01, a, yb + 0.04);
        tl.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      }
    }
    const tiles = new PieceSet();
    tiles.addLines(tl, 0);
    part.obj.add(tiles.build({ local: part.local, detail: 0.9, alpha: 0.6 }));
  });

  // ---------- 宝顶 ----------
  {
    const f = finialGeos(ROOFS[2].top[1] - 0.2);
    growSolid(mergeGeos([f.base, f.neck, f.ball]), TINT.gold, 78, 82, { edgeAngle: 35, detail: 2 });
  }

  // ---------- 天花与藻井（殿内） ----------
  {
    const ps = new PieceSet();
    // 下层、中层天花：环形平板
    const ann = (rIn, rOut, y) => new THREE.RingGeometry(rIn, rOut, 96, 1).rotateX(Math.PI / 2).translate(0, y, 0);
    ps.add(ann(COLUMNS.gold.r, COLUMNS.eave.r, COLUMNS.eave.top - 1.6), new THREE.Matrix4(), 0, 30);
    ps.add(ann(COLUMNS.dragon.r + 0.6, COLUMNS.gold.r, COLUMNS.gold.top - 1.6), new THREE.Matrix4(), 0.3, 30);
    // 藻井：逐层收进的井口
    const steps = [[5.6, 0], [4.8, 0.9], [4.0, 1.8], [3.1, 2.8], [2.2, 3.7], [1.4, 4.5]];
    const y0 = COLUMNS.dragon.top - 0.4;
    steps.forEach(([r, dy], k) => {
      const g = new THREE.CylinderGeometry(r, r, 0.9, 64, 1, true).translate(0, y0 + dy + 0.45, 0);
      ps.add(g, new THREE.Matrix4(), 0.5 + k * 0.07, 30);
      if (k < steps.length - 1) ps.add(ann(steps[k + 1][0], r, y0 + dy + 0.9), new THREE.Matrix4(), 0.5 + k * 0.07, 30);
    });
    ps.add(new THREE.CircleGeometry(1.4, 48).rotateX(Math.PI / 2).translate(0, y0 + 5.4, 0), new THREE.Matrix4(), 0.95, 30);
    reg(ps.build({ mode: 1, drop: 0.8, tint: TINT.ceiling, detail: 1, kind: 2 }), 82, 88);
    // 天花格子线
    const tl = [];
    for (const [rIn, rOut, y] of [[COLUMNS.gold.r, COLUMNS.eave.r, COLUMNS.eave.top - 1.62], [COLUMNS.dragon.r + 0.6, COLUMNS.gold.r, COLUMNS.gold.top - 1.62]]) {
      for (let r = rIn + 0.8; r < rOut; r += 0.8) tl.push(...circleSegs(0, y, 0, r, 96));
      const n = Math.round(rOut * 2 * Math.PI / 0.8);
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, p0 = polar(rIn, a, y), p1 = polar(rOut, a, y); tl.push(p0.x, y, p0.z, p1.x, y, p1.z); }
    }
    const ls = new PieceSet(); ls.addLines(tl, 0);
    reg(ls.build({ mode: 2, detail: 0.6, alpha: 0.5 }), 84, 88);
  }

  // ---------- 殿内地面与龙凤石 ----------
  {
    const ps = new PieceSet();
    for (let x = -11.2; x < 11.2; x += 0.7) for (let z = -11.2; z < 11.2; z += 0.7) {
      if (Math.hypot(x + 0.35, z + 0.35) > 11.0 || Math.hypot(x + 0.35, z + 0.35) < 1.3) continue;
      addBox(ps, x + 0.35, FLOOR + 0.03, z + 0.35, 0.67, 0.06, 0.67, Math.hypot(x, z) / 12);
    }
    reg(ps.build({ mode: 1, drop: 0.5, tint: TINT.floor, detail: 0.7 }), 15, 17);
    growSolid(new THREE.CylinderGeometry(1.25, 1.25, 0.08, 48).translate(0, FLOOR + 0.04, 0), TINT.marble, 16, 17, { edgeAngle: 30, detail: 3 });
  }

  // ---------- 槅扇（十二间） ----------
  {
    const ps = new PieceSet(), lattice = [];
    const as = colAngles(COLUMNS.eave), r = COLUMNS.eave.r;
    const yb = FLOOR + 0.35, yt = COLUMNS.eave.top - 1.6;
    for (let i = 0; i < as.length; i++) {
      const a = as[i], b = as[(i + 1) % as.length];
      const pa = polar(r, a), pb = polar(r, b);
      const dir = pb.clone().sub(pa), len = dir.length(); dir.normalize();
      const inner = len - COLUMNS.eave.d - 0.1, leaves = 4, lw = inner / leaves;
      const rot = Math.atan2(dir.x, dir.z) + Math.PI / 2;
      for (let k = 0; k < leaves; k++) {
        const c = pa.clone().addScaledVector(dir, COLUMNS.eave.d / 2 + 0.05 + lw * (k + 0.5));
        addBox(ps, c.x, (yb + yt) / 2, c.z, lw - 0.06, yt - yb, 0.12, (i / 12) * 0.8 + k * 0.02, rot);
        // 格心
        const x0 = -lw / 2 + 0.12, x1 = lw / 2 - 0.12, y0 = yb + (yt - yb) * 0.42, y1 = yt - 0.2;
        const nrm = new THREE.Vector3(Math.cos(rot - Math.PI / 2), 0, -Math.sin(rot - Math.PI / 2));
        const off = polar(1, (a + b) / 2).multiplyScalar(0.07);
        const P = (u, y) => c.clone().addScaledVector(dir, u).add(off).setY(y);
        for (let u = x0; u <= x1 + 1e-6; u += (x1 - x0) / 5) { const p0 = P(u, y0), p1 = P(u, y1); lattice.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); }
        for (let y = y0; y <= y1 + 1e-6; y += (y1 - y0) / 12) { const p0 = P(x0, y), p1 = P(x1, y); lattice.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); }
        const q0 = P(x0, yb + 0.5), q1 = P(x1, yb + 0.5), q2 = P(x1, y0 - 0.3), q3 = P(x0, y0 - 0.3);
        lattice.push(q0.x, q0.y, q0.z, q1.x, q1.y, q1.z, q1.x, q1.y, q1.z, q2.x, q2.y, q2.z, q2.x, q2.y, q2.z, q3.x, q3.y, q3.z, q3.x, q3.y, q3.z, q0.x, q0.y, q0.z);
        void nrm;
      }
    }
    const g = ps.build({ mode: 1, drop: 0.6, tint: TINT.lattice, detail: 1.0 });
    const ls = new PieceSet(); ls.addLines(lattice, 0.9);
    g.add(ls.build({ local: g.userData.local, detail: 0.25, alpha: 0.6 }));
    reg(g, 88, 93);
  }

  return { root, parts, colGroups, roofs, brackets };
}

function mergeGeos(geos) {
  const pos = [], nor = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export function applyBuild(model, B) {
  for (const p of model.parts) {
    const prog = clamp01((B - p.s0) / (p.s1 - p.s0));
    p.local.uProg.value = prog;
    if (p.grow) {
      if (!p.y) {
        if (p.linesOnlyGrow) p.y = p.linesOnlyGrow;
        else { const b = new THREE.Box3().setFromObject(p.obj); p.y = [b.min.y - 0.01, b.max.y + 0.01]; }
      }
      p.local.uGrowY.value = p.y[0] + (p.y[1] - p.y[0]) * prog;
    }
  }
}

// 红色受力路径与"箍桶"环线（示意）
export function buildLoadPaths(scene) {
  const paths = new PieceSet(), rings = [];
  const seg = (pts, t0, t1, z) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const t = t0 + (t1 - t0) * (i / (pts.length - 1));
      paths.addLines([-0.2, pts[i][1], z * pts[i][0], -0.2, pts[i + 1][1], z * pts[i + 1][0]], t);
    }
  };
  for (const z of [1, -1]) {
    // 下檐 → 斗拱 → 檐柱 → 台基
    seg([[14.2, 13.8], [11.6, 12.9], [11.4, 12.3], [11.4, FLOOR], [11.4, TOP]], 0, 0.95, z);
    // 中檐 → 斗拱 → 金柱
    seg([[10.6, 19.6], [8.4, 18.7], [7.9, 18.1], [7.9, FLOOR], [7.9, TOP]], 0.05, 0.98, z);
    // 上檐 → 斗拱 → 童柱 → 梁 → 龙井柱 / 金柱
    seg([[7.4, 27.2], [6.3, 25.4], [5.9, 24.9], [5.9, 18.1], [4.2, 17.8], [3.9, 17.0], [3.9, FLOOR], [3.9, TOP]], 0.1, 1, z);
    seg([[5.9, 18.1], [7.6, 17.9]], 0.55, 0.62, z);
  }
  const local = makeLocal({ mode: 1, drop: 0 });
  const pathObj = paths.build({ local, red: true, alpha: 1, noClip: true, detail: 400 });
  // 箍桶：三道柱顶环 + 径向梁
  const ra = [];
  for (const [r, y] of [[COLUMNS.eave.r, COLUMNS.eave.top - 0.4], [COLUMNS.gold.r, COLUMNS.gold.top - 0.4], [COLUMNS.dragon.r, COLUMNS.dragon.top - 0.4]]) ra.push(...circleSegs(0, y, 0, r, 96));
  for (const a of colAngles(COLUMNS.eave)) { const p0 = polar(COLUMNS.eave.r, a, COLUMNS.eave.top - 0.3), p1 = polar(COLUMNS.gold.r, a, COLUMNS.eave.top - 0.3); ra.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); }
  for (const a of colAngles(COLUMNS.gold)) { const p0 = polar(COLUMNS.gold.r, a, COLUMNS.gold.top - 0.3), p1 = polar(COLUMNS.dragon.r - 0.6, a, COLUMNS.gold.top - 0.3); ra.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); }
  const rl = makeLocal(); rl.uProg.value = 1;
  const ringObj = linesOnly(ra, rl, { red: true, alpha: 0.95 });
  pathObj.visible = false; ringObj.visible = false;
  scene.add(pathObj, ringObj);
  return { pathObj, ringObj, local };
}

export { polar };
