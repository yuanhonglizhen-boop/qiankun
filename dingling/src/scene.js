import * as THREE from 'three';
import {
  Y0, C, R, HALLS, END_WALLS, DOORS, DIAMOND_WALL, STONE_TUNNEL, BRICK_TUNNEL, GUIDE_STONE,
} from './data.js';
import {
  PieceSet, addBox, boxMatrix, buildHall, endWallGeometry, hallFrame, lathe, solid,
  linesOnly, circleSegs, hipRoofGeometry, clamp01,
} from './builders.js';
import { makeLocal } from './materials.js';

const TINT = {
  stone: '#b8b2a3', marble: '#ece6d6', floor: '#6f6b66', brick: '#9a938a', earth: '#cdbb93',
  lacquer: '#8f3b2b', bronze: '#8a7650', qinghua: '#3f5f93', redwall: '#a8503f', roof: '#c79f3f',
  gold: '#b8924a', figure: '#3c4a5c',
};

export function buildDingling(scene) {
  const parts = [];
  const root = new THREE.Group();
  scene.add(root);

  // 构件登记：s0..s1 为工程进度区间
  const reg = (obj, s0, s1, extra = {}) => {
    if (!extra.proxy) root.add(obj);
    const p = { obj, s0, s1, local: obj.userData.local, ...extra };
    parts.push(p);
    return p;
  };

  // ---------- 地面构造线（常显） ----------
  const red = makeLocal(); red.uProg.value = 1;
  let arr = [];
  for (const r of [R + 16, 150, 190]) arr.push(...circleSegs(C.x, 0, C.z, r, 160));
  arr.push(0, 0, 95, 0, 0, -230); // 中轴线
  root.add(linesOnly(arr, red, { red: true, alpha: 0.38, noClip: true }));
  const faint = makeLocal(); faint.uProg.value = 1;
  arr = circleSegs(C.x, 0, C.z, R + 4, 180, true);
  for (const x of [-20, 20]) arr.push(x, Y0, 2, x, Y0, 6); // 标高刻度
  arr.push(17, Y0, -2, 30, Y0, -2, 18, 0, -2, 32, 0, -2);
  root.add(linesOnly(arr, faint, { alpha: 0.32, noClip: true }));

  // ---------- 基坑（施工辅助线） ----------
  {
    const a = [];
    const x0 = -19, x1 = 19, z0 = 2, z1 = -80, yb = Y0 - 0.3;
    const rect = (y, xa, xb, za, zb) => a.push(xa, y, za, xb, y, za, xb, y, za, xb, y, zb, xb, y, zb, xa, y, zb, xa, y, zb, xa, y, za);
    rect(0, x0 - 4, x1 + 4, z0 + 4, z1 - 4);
    rect(yb, x0, x1, z0, z1);
    for (const [x, z, X, Z] of [[x0, z0, x0 - 4, z0 + 4], [x1, z0, x1 + 4, z0 + 4], [x0, z1, x0 - 4, z1 - 4], [x1, z1, x1 + 4, z1 - 4]]) a.push(x, yb, z, X, 0, Z);
    const local = makeLocal({ mode: 2 });
    const pit = linesOnly(a, local, { alpha: 0.55 });
    pit.userData.local = local;
    reg(pit, 0, 8, { pit: true });
  }

  // ---------- 金砖地面 + 石券 ----------
  const floor = new PieceSet();
  const hallSets = {};
  const contours = {};
  for (const h of HALLS) {
    const ws = new PieceSet(), ct = new PieceSet();
    buildHall(h, Y0, ws, h.W >= 4 ? floor : null, ct);
    hallSets[h.id] = ws; contours[h.id] = ct;
  }
  reg(floor.build({ mode: 1, drop: 1.2, tint: TINT.floor, detail: 0.64 }), 8, 15);
  const hallTiming = {
    front: [15, 24], middle: [17, 28], rear: [21, 33], sideE: [26, 37], sideW: [27, 38],
    tunnelVault: [30, 38], passE: [33, 39], passW: [33, 39], passNE: [34, 40], passNW: [34, 40],
  };
  for (const h of HALLS) {
    const [s0, s1] = hallTiming[h.id];
    const g = hallSets[h.id].build({ mode: 1, drop: 2.6, tint: TINT.stone, detail: 0.9 });
    g.add(contours[h.id].build({ local: g.userData.local, detail: 400, alpha: 0.9 }));
    reg(g, s0, s1);
  }
  for (const ew of END_WALLS) {
    const g = endWallGeometry(ew);
    const m = hallFrame(ew, Y0);
    g.applyMatrix4(m);
    const local = makeLocal({ mode: 0 });
    const s = solid(g, local, { tint: TINT.stone, edgeAngle: 30 });
    s.userData.local = local;
    const base = ew.id.startsWith('dw') ? { dw1: 30, dw2: 22, dw3: 27 }[ew.id] : ew.id.startsWith('rear') ? 30 : 34;
    reg(s, base, base + 6, { grow: true });
  }

  // ---------- 石门与自来石 ----------
  const doors = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const d of DOORS) {
    const n = new THREE.Vector3(d.n[0], 0, d.n[1]);
    const r = new THREE.Vector3().crossVectors(up, n).normalize();
    const c = new THREE.Vector3(d.c[0], Y0 + 0.12, d.c[1]);
    const [lw, lh, lt] = d.leaf;
    const local = makeLocal({ mode: 1, drop: 4 });
    const door = { def: d, leaves: [], stone: null, local, open: 1, tilt: 0, n, r, c };
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      const X = r.clone().multiplyScalar(-side);
      const Z = new THREE.Vector3().crossVectors(X, up);
      const zs = Z.dot(n) < 0 ? 1 : -1; // 局部 +z 是否朝门外
      pivot.matrix.makeBasis(X, up, Z).setPosition(c.clone().addScaledVector(r, side * lw));
      pivot.matrixAutoUpdate = false;
      const leafGeo = new THREE.BoxGeometry(lw - 0.02, lh, lt).translate(lw / 2, lh / 2, zs * lt / 2);
      const swing = new THREE.Group();
      swing.add(solid(leafGeo, local, { tint: TINT.marble, detail: 1.5 }));
      if (d.studs) {
        const ps = new PieceSet();
        const stud = new THREE.SphereGeometry(0.055, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(zs * Math.PI / 2);
        for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
          const m = new THREE.Matrix4().makeTranslation(0.2 + i * (lw - 0.4) / 8, 0.35 + j * (lh - 0.7) / 8, zs * lt);
          ps.add(stud, m, 0, 80);
        }
        swing.add(ps.build({ local, tint: TINT.gold, noLines: true }));
      }
      pivot.add(swing);
      door.leaves.push({ pivot, swing, zs });
      root.add(pivot);
    }
    // 自来石：底端在门内 0.75 m 处的地槽，倒下后上端抵住门背
    const sLocal = makeLocal({ mode: 1, drop: 3 });
    const sp = new THREE.Group();
    const Zs = new THREE.Vector3().crossVectors(r, up);
    sp.matrix.makeBasis(r, up, Zs).setPosition(c.clone().addScaledVector(n, 0.75));
    sp.matrixAutoUpdate = false;
    const tiltG = new THREE.Group();
    const sh = d.studs ? 1.6 : 1.3;
    tiltG.add(solid(new THREE.BoxGeometry(0.26, sh, 0.26).translate(0, sh / 2, 0), sLocal, { tint: TINT.stone, detail: 1.2 }));
    sp.add(tiltG);
    root.add(sp);
    // 地槽
    door.stone = { pivot: sp, tilt: tiltG, sign: -Math.sign(Zs.dot(n)) || 1, len: sh, local: sLocal };
    door.maxTilt = Math.asin(Math.min(0.95, 0.75 / sh));
    doors.push(door);
    reg({ userData: { local } , isDoorProxy: true }, 40 + d.id * 0.8, 44 + d.id * 0.8, { proxy: true });
    reg({ userData: { local: sLocal }, isDoorProxy: true }, 48, 51, { proxy: true });
  }

  // ---------- 陈设 ----------
  const fy = Y0 + 0.12;
  const marble = new PieceSet(), bronze = new PieceSet(), qh = new PieceSet(), lacquer = new PieceSet();
  const throne = (x, z, s, t) => {
    addBox(marble, x, fy + 0.18 * s, z, 1.9 * s, 0.36 * s, 1.4 * s, t);
    addBox(marble, x, fy + 0.6 * s, z + 0.05 * s, 1.6 * s, 0.48 * s, 1.1 * s, t + 0.04);
    addBox(marble, x, fy + 1.3 * s, z - 0.55 * s, 1.6 * s, 1.4 * s, 0.18 * s, t + 0.08);
    for (const sx of [-1, 1]) addBox(marble, x + sx * 0.74 * s, fy + 1.05 * s, z, 0.14 * s, 0.42 * s, 1.0 * s, t + 0.08);
    // 五供
    const vase = lathe([[0, 0], [0.09, 0], [0.13, 0.1], [0.07, 0.3], [0.1, 0.42], [0, 0.42]], 12);
    const burner = lathe([[0, 0], [0.16, 0.02], [0.2, 0.16], [0.14, 0.24], [0, 0.24]], 12);
    const candle = lathe([[0, 0], [0.09, 0], [0.04, 0.05], [0.03, 0.5], [0.08, 0.52], [0, 0.55]], 10);
    const zf = z + 1.55 * s;
    bronze.add(burner, new THREE.Matrix4().makeTranslation(x, fy, zf), t + 0.1, 40);
    for (const sx of [-1, 1]) {
      bronze.add(candle, new THREE.Matrix4().makeTranslation(x + sx * 0.36 * s, fy, zf), t + 0.12, 40);
      bronze.add(vase, new THREE.Matrix4().makeTranslation(x + sx * 0.68 * s, fy, zf), t + 0.14, 40);
    }
    const jar = lathe([[0, 0], [0.28, 0], [0.42, 0.18], [0.46, 0.42], [0.4, 0.66], [0.38, 0.72], [0, 0.72]], 18);
    qh.add(jar, new THREE.Matrix4().makeTranslation(x, fy, z + 2.45 * s), t + 0.16, 40);
  };
  throne(0, -61.4, 1, 0.1);
  throne(-1.95, -58.9, 0.78, 0.3);
  throne(1.95, -58.9, 0.78, 0.3);
  // 后殿棺床与棺椁
  addBox(marble, 0, fy + 0.22, -72.55, 17, 0.45, 4.6, 0.4);
  const ty = fy + 0.45;
  addBox(lacquer, 0, ty + 0.85, -72.55, 1.7, 1.7, 3.3, 0.6);
  addBox(lacquer, 0, ty + 1.78, -72.55, 1.9, 0.16, 3.5, 0.65);
  for (const sx of [-1, 1]) {
    addBox(lacquer, sx * 3.0, ty + 0.7, -72.55, 1.35, 1.4, 2.9, 0.7);
    addBox(lacquer, sx * 3.0, ty + 1.47, -72.55, 1.5, 0.14, 3.05, 0.72);
    for (const [k, x] of [[0, 5.2], [1, 6.5], [2, 7.8]]) for (const z of [-71.3, -73.8]) {
      addBox(lacquer, sx * x, ty + 0.36, z, 1.05, 0.72, 0.8, 0.75 + k * 0.05);
    }
  }
  // 配殿棺床（空）
  for (const sx of [-1, 1]) addBox(marble, sx * 13, fy + 0.22, -51, 3.2, 0.45, 7.2, 0.5);
  reg(marble.build({ mode: 1, drop: 2.2, tint: TINT.marble, detail: 1.2 }), 48, 55);
  reg(bronze.build({ mode: 1, drop: 2.2, tint: TINT.bronze, detail: 0.4 }), 49, 55);
  reg(qh.build({ mode: 1, drop: 2.2, tint: TINT.qinghua, detail: 0.6 }), 49, 55);
  reg(lacquer.build({ mode: 1, drop: 2.2, tint: TINT.lacquer, detail: 1.2 }), 50, 55);

  // ---------- 金刚墙 ----------
  {
    const dw = DIAMOND_WALL, stones = new PieceSet(), bricks = new PieceSet();
    const sH = 0.55, bH = (dw.h - dw.stoneRows * sH) / dw.brickRows;
    const zc = (dw.z0 + dw.z1) / 2, depth = Math.abs(dw.z1 - dw.z0);
    const rows = dw.stoneRows + dw.brickRows;
    for (let row = 0; row < rows; row++) {
      const isStone = row < dw.stoneRows;
      const yA = isStone ? row * sH : dw.stoneRows * sH + (row - dw.stoneRows) * bH;
      const hgt = isStone ? sH : bH;
      const L = isStone ? 1.5 : 0.48;
      const off = (row % 2) * L / 2;
      for (let x = dw.x0 - off; x < dw.x1; x += L) {
        const xa = Math.max(dw.x0, x), xb = Math.min(dw.x1, x + L);
        if (xb - xa < 0.04) continue;
        addBox(isStone ? stones : bricks, (xa + xb) / 2, Y0 + yA + hgt / 2, zc, xb - xa - 0.012, hgt - 0.01, depth, row / rows);
      }
    }
    const loc = makeLocal({ mode: 1, drop: 1.0 });
    reg(stones.build({ local: loc, tint: TINT.stone, detail: 1.2 }), 61, 67);
    root.add(bricks.build({ local: loc, tint: TINT.brick, detail: 0.2 }));
  }

  // ---------- 石隧道 ----------
  {
    const st = STONE_TUNNEL, ps = new PieceSet(), segL = 2;
    for (let z = st.z0; z < st.z1 - 1e-3; z += segL) {
      const zm = z + segL / 2, f = (zm - st.z0) / (st.z1 - st.z0);
      const yf = st.yA + (st.yB - st.yA) * f;
      for (const sx of [-1, 1]) {
        for (let k = 0; k < Math.round(st.wallH / 0.75); k++) {
          addBox(ps, sx * (st.halfW + 0.5), yf + k * 0.75 + 0.375, zm, 1, 0.74, segL - 0.03, f * 0.8 + k * 0.02);
        }
      }
      addBox(ps, 0, yf - 0.2, zm, st.halfW * 2 + 2, 0.4, segL - 0.03, f * 0.8);
    }
    reg(ps.build({ mode: 1, drop: 1.5, tint: TINT.stone, detail: 0.9 }), 67, 72);
  }

  // ---------- 砖隧道（走向示意） ----------
  const bt = BRICK_TUNNEL;
  const curve = new THREE.QuadraticBezierCurve(
    new THREE.Vector2(...bt.start), new THREE.Vector2(...bt.ctrl), new THREE.Vector2(...bt.end));
  {
    const ps = new PieceSet(), N = 44;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N, p = curve.getPoint(u), tg = curve.getTangent(u);
      const yf = bt.yA + (bt.yB - bt.yA) * u;
      const nx = -tg.y, nz = tg.x, rot = Math.atan2(tg.x, tg.y);
      const segL = curve.getLength() / N;
      addBox(ps, p.x, yf - 0.15, p.y, bt.halfW * 2 + 1.4, 0.3, segL + 0.02, u * 0.85, rot);
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 6; k++) {
          addBox(ps, p.x + nx * sx * (bt.halfW + 0.35), yf + k * 0.5 + 0.25, p.y + nz * sx * (bt.halfW + 0.35), 0.7, 0.49, segL + 0.02, u * 0.85 + k * 0.01, rot);
        }
      }
    }
    reg(ps.build({ mode: 1, drop: 1.2, tint: TINT.brick, detail: 0.6 }), 71, 75);
  }
  // 指路石
  {
    const ps = new PieceSet();
    addBox(ps, GUIDE_STONE.pos[0], GUIDE_STONE.pos[1] + 0.25, GUIDE_STONE.pos[2], 0.34, 0.5, 0.14, 0, 0.6);
    reg(ps.build({ mode: 1, drop: 1.5, tint: TINT.stone, detail: 0.5 }), 74, 75);
  }

  // ---------- 回填夯土与宝顶 ----------
  {
    const g = lathe([[0, Y0 - 4], [R - 4, Y0 - 4], [R - 4, 6.5], [92, 7.6], [72, 10.2], [46, 13.6], [22, 15.7], [0, 16.2]], 120);
    g.translate(C.x, 0, C.z);
    const local = makeLocal({ mode: 0 });
    const s = solid(g, local, { tint: TINT.earth, kind: 1, edgeAngle: 50, inkAmt: 0.7, clip: 'earth' });
    s.userData.local = local;
    reg(s, 75, 87, { grow: true, earth: true });
  }

  // ---------- 宝城 ----------
  {
    const g = lathe([[R - 4, 0], [R, 0], [R, 7.4], [R - 0.2, 7.4], [R - 0.2, 8.6], [R - 1.0, 8.6], [R - 1.0, 7.4], [R - 4, 7.4], [R - 4, 0]], 160);
    g.translate(C.x, 0, C.z);
    const local = makeLocal({ mode: 0 });
    const s = solid(g, local, { tint: TINT.brick, edgeAngle: 50, clip: 'earth' });
    s.userData.local = local;
    reg(s, 85, 90, { grow: true });
  }

  // ---------- 方城明楼（示意） ----------
  {
    const ps = new PieceSet(), redp = new PieceSet(), roof = new PieceSet();
    const sh = new THREE.Shape();
    sh.moveTo(-11, 0); sh.lineTo(11, 0); sh.lineTo(11, 10); sh.lineTo(-11, 10); sh.lineTo(-11, 0);
    const hole = new THREE.Path();
    hole.moveTo(-2.2, 0.001); hole.lineTo(-2.2, 4.2); hole.absarc(0, 4.2, 2.2, Math.PI, 0, true); hole.lineTo(2.2, 0.001); hole.lineTo(-2.2, 0.001);
    sh.holes.push(hole);
    const base = new THREE.ExtrudeGeometry(sh, { depth: 20, bevelEnabled: false, curveSegments: 16 });
    ps.add(base, new THREE.Matrix4().makeTranslation(0, 0, 40), 0, 30);
    addBox(ps, 0, 10.3, 50, 23, 0.6, 21, 0.3);
    addBox(redp, 0, 14.1, 50, 13, 7, 13, 0.45);
    const eave = new THREE.CylinderGeometry(7.9 * Math.SQRT2, 9.6 * Math.SQRT2, 1.5, 4, 1).rotateY(Math.PI / 4);
    roof.add(eave, new THREE.Matrix4().makeTranslation(0, 18.1, 50), 0.6, 30);
    addBox(redp, 0, 20.2, 50, 11, 2.8, 11, 0.7);
    roof.add(hipRoofGeometry(9.2, 9.2, 4.2, 5.4), new THREE.Matrix4().makeTranslation(0, 21.5, 50), 0.85, 30);
    const loc = makeLocal({ mode: 1, drop: 4 });
    reg(ps.build({ local: loc, tint: TINT.brick, clip: 'earth' }), 88, 94);
    root.add(redp.build({ local: loc, tint: TINT.redwall, clip: 'earth' }));
    root.add(roof.build({ local: loc, tint: TINT.roof, clip: 'earth' }));
  }

  // ---------- 考古队员 ----------
  const figLocal = makeLocal({ mode: 0 }); figLocal.uProg.value = 1;
  const figure = new THREE.Group();
  figure.add(solid(new THREE.CylinderGeometry(0.2, 0.26, 1.3, 10).translate(0, 0.65, 0), figLocal, { tint: TINT.figure, edgeAngle: 40, noClip: true }));
  figure.add(solid(new THREE.SphereGeometry(0.15, 10, 8).translate(0, 1.5, 0), figLocal, { tint: '#d9c3a5', edgeAngle: 60, noClip: true }));
  figure.add(solid(new THREE.CylinderGeometry(0.12, 0.26, 0.12, 12).translate(0, 1.65, 0), figLocal, { tint: '#e8e2d2', edgeAngle: 40, noClip: true }));
  figure.visible = false;
  root.add(figure);

  // ---------- 拐钉钥匙（演示用红线） ----------
  const keyLocal = makeLocal({ mode: 0 }); keyLocal.uProg.value = 1;
  const key = linesOnly([0, 0, 0, 0, 0, 1.4, 0, 0, 1.4, 0, -0.25, 1.4], keyLocal, { red: true, alpha: 1, noClip: true });
  key.visible = false;
  root.add(key);

  return { root, parts, doors, figure, key, curve };
}

// 根据工程进度更新所有构件
export function applyBuild(model, B) {
  for (const p of model.parts) {
    const prog = clamp01((B - p.s0) / (p.s1 - p.s0));
    let v = prog;
    if (p.pit) v = prog * (1 - clamp01((B - 75) / 10));
    p.local.uProg.value = v;
    if (p.grow) {
      if (!p.y) {
        const b = new THREE.Box3().setFromObject(p.obj);
        p.y = [b.min.y - 0.01, b.max.y + 0.01];
      }
      p.local.uGrowY.value = p.y[0] + (p.y[1] - p.y[0]) * prog;
    }
  }
}

// 门的开合（open 1 = 全开）与自来石倾角（tilt 1 = 顶住）
export function setDoor(door, open, tilt) {
  door.open = open; door.tilt = tilt;
  for (const l of door.leaves) {
    l.swing.rotation.y = l.zs * open * 1.42;
  }
  door.stone.tilt.rotation.x = door.stone.sign * tilt * door.maxTilt;
}

export function doorStateFromBuild(door, B) {
  const tc = 55 + 5.5 * door.def.closeAt;
  const close = clamp01((B - tc) / 0.5);
  const fall = clamp01((B - tc - 0.5) / 0.3);
  return [1 - close, fall];
}
