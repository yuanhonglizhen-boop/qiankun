// 写实模式：竣工后把线稿材质换成实体材质，并补上只在写实模式出现的细部
// （琉璃瓦楞、瓦当、椽头、彩画带、槛窗、槅扇、匾额、阳光与阴影）。
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COLUMNS, ROOFS, DRUMS, FLOOR, colAngles } from './data.js';

const ROOF_BLUE = '#17224a'; // 照片里的琉璃瓦是很深的藏青

export function buildReal(scene, renderer, model) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // ---------- 光 ----------
  const lights = new THREE.Group();
  const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
  sun.position.set(-48, 58, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 10, far: 180 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  lights.add(sun, sun.target);
  lights.add(new THREE.HemisphereLight('#dfe9f5', '#b9a98e', 0.75));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.22 }));
  ground.position.y = 0.01;
  ground.receiveShadow = true;
  lights.add(ground);
  lights.visible = false;
  scene.add(lights);

  // ---------- 材质 ----------
  // 每种材质有自己的上色时段 [起, 止]（占整个上色过程 0–1）和由下往上刷的高度范围 [y0, y1]
  const revs = [];
  const clip = (m, when = [0, 1], ys = [0, 37]) => {
    m.clippingPlanes = model.clipPlanes; m.side = THREE.DoubleSide; m.envMap = envTex; m.envMapIntensity = 0.55;
    const u = { uRev: { value: 0 }, uY0: { value: ys[0] }, uY1: { value: ys[1] } };
    revs.push({ u, when });
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u); paintIn(sh); if (prev) prev(sh); };
    m.customProgramCacheKey = () => 'rev' + revs.length + (m.userData.key || '');
    return m;
  };
  const marble = clip(new THREE.MeshStandardMaterial({ color: '#ece8df', roughness: 0.5 }), [0, 0.22], [0, 6.2]);
  const floor = clip(new THREE.MeshStandardMaterial({ color: '#6f6b66', roughness: 0.8 }), [0.06, 0.2], [5, 6]);
  const lacquer = clip(new THREE.MeshPhysicalMaterial({ color: '#8c1c13', roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.3 }), [0.1, 0.38], [FLOOR, 25.5]);
  const paint = clip(new THREE.MeshStandardMaterial({ color: '#1f4652', roughness: 0.6 }), [0.34, 0.58], [11, 26]);
  const ceiling = clip(new THREE.MeshStandardMaterial({ color: '#2d6766', roughness: 0.7 }), [0.38, 0.58], [10, 30]);
  const gold = clip(new THREE.MeshStandardMaterial({ color: '#e0ac45', metalness: 1, roughness: 0.26 }), [0.88, 1], [33, 37]);
  const roofMats = ROOFS.map((rf, i) => {
    const m = tileRoof(ROOF_BLUE, Math.round(rf.lip[0] * 2 * Math.PI / 0.55));
    m.userData.key = 'roof' + i;
    return clip(m, [0.5 + i * 0.12, 0.7 + i * 0.12], [rf.lip[1] - 1.2, rf.top[1] + 0.4]);
  });
  const byTint = {
    d8d2c3: marble, ece7da: marble, a83a2c: lacquer, '3f7a74': paint, c9a24a: null,
    '3c6f73': ceiling, '8d8a84': floor, '9b3a2e': null, a3402f: null,
  };

  // ---------- 纹理 ----------
  const leafTex = canvasTex(128, 512, drawLeaf);
  const winTex = canvasTex(512, 256, drawDrum); winTex.wrapS = THREE.RepeatWrapping;
  const bandTex = canvasTex(512, 128, drawBand); bandTex.wrapS = THREE.RepeatWrapping;

  // ---------- 细部 ----------
  const extras = new THREE.Group();
  extras.visible = false;
  scene.add(extras);
  const add = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; extras.add(mesh); return mesh; };

  // 两层鼓身：红色槛窗
  DRUMS.forEach((d, i) => {
    const t = winTex.clone(); t.needsUpdate = true; t.repeat.set(i === 0 ? 12 : 9, 1);
    const g = new THREE.CylinderGeometry(d.r + 0.02, d.r + 0.02, d.y1 - d.y0, 128, 1, true).translate(0, (d.y0 + d.y1) / 2, 0);
    add(new THREE.Mesh(g, clip(new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), [0.26 + i * 0.08, 0.48 + i * 0.08], [d.y0, d.y1])));
  });

  // 檐下彩画带（额枋）
  const bands = [
    [COLUMNS.eave.r + 0.36, COLUMNS.eave.top - 1.9, COLUMNS.eave.top, 18],
    [DRUMS[0].r + 0.2, DRUMS[0].y1 - 0.9, DRUMS[0].y1 + 0.05, 20],
    [DRUMS[1].r + 0.2, DRUMS[1].y1 - 0.9, DRUMS[1].y1 + 0.05, 14],
  ];
  for (const [bi, [r, y0, y1, rep]] of bands.entries()) {
    const t = bandTex.clone(); t.needsUpdate = true; t.repeat.set(rep, 1);
    const g = new THREE.CylinderGeometry(r, r, y1 - y0, 160, 1, true).translate(0, (y0 + y1) / 2, 0);
    add(new THREE.Mesh(g, clip(new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), [0.4 + bi * 0.06, 0.56 + bi * 0.06], [y0, y1])));
  }

  // 槅扇：十二间、每间四扇
  {
    const as = colAngles(COLUMNS.eave), r = COLUMNS.eave.r;
    const yb = FLOOR + 0.35, yt = COLUMNS.eave.top - 1.6;
    const mats = [];
    for (let i = 0; i < as.length; i++) {
      const pa = polar(r, as[i]), pb = polar(r, as[(i + 1) % as.length]);
      const dir = pb.clone().sub(pa), len = dir.length(); dir.normalize();
      const lw = (len - COLUMNS.eave.d - 0.1) / 4;
      const rot = Math.atan2(dir.x, dir.z) + Math.PI / 2;
      for (let k = 0; k < 4; k++) {
        const c = pa.clone().addScaledVector(dir, COLUMNS.eave.d / 2 + 0.05 + lw * (k + 0.5));
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(c.x, (yb + yt) / 2, c.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(lw - 0.05, yt - yb, 0.14)));
      }
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), clip(new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.45 }), [0.18, 0.42], [FLOOR, COLUMNS.eave.top]), mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    add(im);
  }

  // 椽头与瓦当
  ROOFS.forEach((rf, ri) => {
    const [r0, y0] = rf.lip;
    const n = Math.round(2 * Math.PI * (r0 - 0.5) / 0.34);
    const geo = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8).rotateX(Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, clip(new THREE.MeshStandardMaterial({ roughness: 0.55 }), [0.46 + ri * 0.12, 0.6 + ri * 0.12], [y0 - 1, y0]), n);
    const col = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, p = polar(r0 - 0.55, a, y0 - 0.48);
      im.setMatrixAt(k, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 - a), new THREE.Vector3(1, 1, 1)));
      im.setColorAt(k, col.set(k % 2 ? '#2a5a8c' : '#2f7a5c'));
    }
    add(im);
    add(new THREE.Mesh(new THREE.TorusGeometry(r0 + 0.05, 0.12, 8, 240).rotateX(Math.PI / 2).translate(0, y0 - 0.05, 0), roofMats[ri]));
    const [r1, y1] = rf.top;
    if (ri < 2) add(new THREE.Mesh(new THREE.TorusGeometry(r1 + 0.1, 0.28, 10, 160).rotateX(Math.PI / 2).translate(0, y1 + 0.05, 0), roofMats[ri]));
  });

  // 檐口一道细红线（连檐、瓦口）
  ROOFS.forEach((rf, ri) => {
    const m = clip(new THREE.MeshStandardMaterial({ color: '#8a2c1e', roughness: 0.5 }), [0.52 + ri * 0.12, 0.7 + ri * 0.12], [rf.lip[1] - 1, rf.lip[1] + 0.5]);
    add(new THREE.Mesh(new THREE.TorusGeometry(rf.lip[0] - 0.02, 0.07, 6, 240).rotateX(Math.PI / 2).translate(0, rf.lip[1] - 0.28, 0), m));
  });

  // 宝顶：深蓝叠层底座 + 鎏金颈 + 圆宝珠
  {
    const y = ROOFS[2].top[1] - 0.2;
    const base = new THREE.LatheGeometry([[0, 0], [1.45, 0], [1.45, 0.45], [1.15, 0.55], [1.15, 1.05], [0.9, 1.15], [0.9, 1.6], [0, 1.6]].map(([a, b]) => new THREE.Vector2(a, b)), 48).translate(0, y, 0);
    add(new THREE.Mesh(base, roofMats[2]));
    const neck = new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.55, 0.16], [0.36, 0.32], [0.32, 0.8], [0.48, 0.92], [0, 0.95]].map(([a, b]) => new THREE.Vector2(a, b)), 32).translate(0, y + 1.6, 0);
    add(new THREE.Mesh(neck, gold));
    const ball = new THREE.SphereGeometry(0.82, 40, 24).scale(1, 1.18, 1).translate(0, y + 1.6 + 0.95 + 0.9, 0);
    add(new THREE.Mesh(ball, gold));
  }

  // 匾额：上层南面，蓝底金字"祈年殿"
  const plaqueTex = canvasTex(256, 512, drawPlaque);
  const plaque = add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 4.6, 0.25), [
    ...[0, 1, 2, 3, 4, 5].map((k) => clip(k === 4 ? new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.4, metalness: 0.15 }) : new THREE.MeshStandardMaterial({ color: '#c9982f', metalness: 0.6, roughness: 0.35 }), [0.8, 0.94], [21, 27])),
  ]));
  plaque.position.set(0, DRUMS[1].y1 - 1.3, DRUMS[1].r + 0.55);
  if (document.fonts) document.fonts.ready.then(() => { drawPlaque(plaqueTex.image.getContext('2d'), 256, 512); plaqueTex.needsUpdate = true; });

  // ---------- 上色过程 ----------
  // 每个线稿网格配一个写实"孪生"网格；上色时孪生网格按时段、由下往上带毛边地刷出来，
  // 线稿留在下面垫底，刷完后再隐藏。
  const sketchMeshes = [], twins = [];
  model.parts.forEach((p) => {
    const ri = model.roofs.findIndex((r) => r.obj === p.obj);
    const list = [];
    p.obj.traverse((o) => { if (o.isMesh && !o.isLineSegments) list.push(o); });
    for (const o of list) {
      sketchMeshes.push(o);
      let m = ri >= 0 ? roofMats[ri] : byTint[o.material.uniforms?.uTint?.value.getHexString()];
      if (m === undefined) m = marble;
      if (m === null) continue;
      const t = new THREE.Mesh(o.geometry, m);
      t.position.copy(o.position); t.quaternion.copy(o.quaternion); t.scale.copy(o.scale);
      t.castShadow = t.receiveShadow = true;
      t.visible = false;
      o.parent.add(t);
      twins.push(t);
    }
  });

  const sky = document.getElementById('sky');
  let P = -1;
  // p：0 = 纯线稿，1 = 上色完成
  function setProgress(p) {
    p = Math.max(0, Math.min(1, p));
    if (p === P) return;
    P = p;
    const any = p > 0;
    lights.visible = any; extras.visible = any;
    for (const t of twins) t.visible = any;
    for (const o of sketchMeshes) o.visible = p < 1;
    for (const { u, when } of revs) u.uRev.value = Math.max(0, Math.min(1, (p - when[0]) / (when[1] - when[0])));
    sun.intensity = 2.6 * smooth(p, 0.05, 0.6);
    ground.material.opacity = 0.22 * smooth(p, 0.3, 0.9);
    model.lineFade(1 - smooth(p, 0.45, 1));
    if (sky) sky.style.opacity = String(smooth(p, 0, 0.8));
  }
  function setRoofColors(list) {
    roofMats.forEach((m, i) => m.color.set(list ? list[i] : ROOF_BLUE));
  }
  setProgress(0);
  return { setProgress, setRoofColors, progress: () => P };
}
function smooth(x, a, b) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// 由下往上、带毛边地"刷"出颜色；刚刷到的边缘略深，像未干的颜料
function paintIn(sh) {
  if (!sh.vertexShader.includes('varying vec3 vWP;')) {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
  }
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vWP;
      uniform float uRev, uY0, uY1;
      float pHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float pNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
        return mix(mix(pHash(i), pHash(i + vec2(1, 0)), u.x), mix(pHash(i + vec2(0, 1)), pHash(i + vec2(1, 1)), u.x), u.y); }
      float pMask(){
        float h = clamp((vWP.y - uY0) / max(0.01, uY1 - uY0), 0., 1.);
        float a = atan(vWP.z, vWP.x);
        float n = pNoise(vec2(a * 7.0, vWP.y * 1.4)) * 0.6 + pNoise(vWP.xz * 1.7 + vWP.y) * 0.4;
        return h * 0.78 + n * 0.3;
      }`)
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      float pEdge = uRev * 1.3 - 0.12 - pMask();
      if (pEdge < 0.0) discard;`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 0.07, pEdge));`);
}

// 琉璃瓦：按角度起伏的瓦垄（法线扰动 + 明暗），按半径的瓦节；远处自动减弱避免摩尔纹
function tileRoof(color, rows) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.25 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRows = { value: rows };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWN;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWN;\nuniform float uRows;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float qTh = atan(vWP.z, vWP.x) * uRows;
        float qFade = clamp(1.0 - fwidth(qTh) * 0.45, 0.0, 1.0);
        bool under = vWN.y < -0.15;
        if (under) {
          // 檐下：青绿相间的彩绘椽子
          float r = fract(atan(vWP.z, vWP.x) * uRows * 0.5 / 3.14159);
          vec3 rafter = mod(floor(atan(vWP.z, vWP.x) * uRows * 0.5 / 3.14159), 2.0) < 1.0 ? vec3(0.12, 0.30, 0.24) : vec3(0.10, 0.22, 0.40);
          diffuseColor.rgb = mix(vec3(0.05, 0.08, 0.12), rafter, smoothstep(0.08, 0.2, r) * (1.0 - smoothstep(0.8, 0.92, r)));
        } else {
          // 筒瓦一垄垄隆起，瓦沟更深
          float qRib = pow(0.5 + 0.5 * cos(qTh), 0.7);
          float qCourse = fract(length(vWP.xz) / 0.42);
          float qFadeC = clamp(1.0 - fwidth(length(vWP.xz) / 0.42) * 1.5, 0.0, 1.0);
          diffuseColor.rgb *= mix(1.0, 0.45 + 0.7 * qRib, qFade);
          diffuseColor.rgb *= mix(1.0, 0.82 + 0.18 * smoothstep(0.0, 0.2, qCourse), qFadeC);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (vWN.y > -0.15) {
          float th = atan(vWP.z, vWP.x);
          vec3 tw = vec3(-sin(th), 0.0, cos(th));
          vec3 tv = normalize((viewMatrix * vec4(tw, 0.0)).xyz);
          float f = clamp(1.0 - fwidth(th * uRows) * 0.45, 0.0, 1.0);
          normal = normalize(normal - tv * sin(th * uRows) * 0.75 * f);
        }`);
  };
  return m;
}

// ---------- 画纹理 ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function lattice(g, x, y, w, h, step) {
  g.fillStyle = '#2a0f0b'; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.strokeStyle = '#b5853c'; g.lineWidth = 2.2;
  for (let k = -h; k < w + h; k += step) {
    g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + h, y + h); g.stroke();
    g.beginPath(); g.moveTo(x + k + h, y); g.lineTo(x + k, y + h); g.stroke();
  }
  g.strokeStyle = 'rgba(181,133,60,0.55)'; g.lineWidth = 1.4;
  for (let yy = y; yy < y + h; yy += step) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
  g.restore();
}
function drawLeaf(g, w, h) {
  // 照片里的槅扇：朱红边框，红褐色菱花格心，少量金线
  g.fillStyle = '#8f2418'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#5b130c'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  const x = 14, y = 18, lw = w - 28, lh = h * 0.56;
  g.fillStyle = '#4a120c'; g.fillRect(x, y, lw, lh);
  g.save(); g.beginPath(); g.rect(x, y, lw, lh); g.clip();
  g.strokeStyle = '#c0563a'; g.lineWidth = 3;
  for (let k = -lh; k < lw + lh; k += 14) {
    g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + lh, y + lh); g.stroke();
    g.beginPath(); g.moveTo(x + k + lh, y); g.lineTo(x + k, y + lh); g.stroke();
  }
  g.strokeStyle = 'rgba(192,86,58,0.7)'; g.lineWidth = 2;
  for (let yy = y; yy < y + lh; yy += 14) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + lw, yy); g.stroke(); }
  g.restore();
  g.strokeStyle = '#c99a45'; g.lineWidth = 2;
  g.strokeRect(x, y, lw, lh);
  g.strokeRect(14, h * 0.62, w - 28, h * 0.06);
  g.strokeRect(18, h * 0.72, w - 36, h * 0.22);
  g.beginPath(); g.ellipse(w / 2, h * 0.83, w * 0.22, h * 0.06, 0, 0, Math.PI * 2); g.stroke();
}
// 鼓身：青绿与蓝相间的方心彩画，金框金纹，下压一条深蓝带
function drawDrum(g, w, h) {
  const bandH = h * 0.22;
  g.fillStyle = '#16244a'; g.fillRect(0, h - bandH, w, bandH);
  g.fillStyle = '#c9a24a'; g.fillRect(0, h - bandH - 4, w, 4);
  const panels = 2, pw = w / panels;
  for (let k = 0; k < panels; k++) {
    const x0 = k * pw;
    g.fillStyle = '#1e3f86'; g.fillRect(x0, 0, pw, h - bandH - 4);
    g.fillStyle = k % 2 ? '#2a8f86' : '#2f8a6a';
    g.fillRect(x0 + pw * 0.12, h * 0.1, pw * 0.76, h * 0.52);
    g.strokeStyle = '#d8b24a'; g.lineWidth = 6;
    g.strokeRect(x0 + pw * 0.12, h * 0.1, pw * 0.76, h * 0.52);
    // 金色龙凤纹（简化为盘曲的金线与宝珠）
    g.lineWidth = 5; g.lineCap = 'round';
    const cx = x0 + pw / 2, cy = h * 0.36;
    g.beginPath();
    g.moveTo(cx - pw * 0.3, cy + 20);
    g.bezierCurveTo(cx - pw * 0.18, cy - 50, cx - pw * 0.02, cy + 50, cx + pw * 0.1, cy - 10);
    g.bezierCurveTo(cx + pw * 0.18, cy - 50, cx + pw * 0.28, cy + 10, cx + pw * 0.32, cy - 18);
    g.stroke();
    g.fillStyle = '#e6c25a';
    g.beginPath(); g.arc(cx + pw * 0.02, cy - 30, 11, 0, Math.PI * 2); g.fill();
    for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(cx - pw * 0.24 + j * pw * 0.15, cy + 34, 5, 0, Math.PI * 2); g.fill(); }
    // 两侧的箍头
    g.fillStyle = '#2a8f86'; g.fillRect(x0, 0, pw * 0.08, h - bandH - 4);
    g.fillStyle = '#d8b24a'; g.fillRect(x0 + pw * 0.08, 0, 4, h - bandH - 4); g.fillRect(x0 + pw * 0.92 - 4, 0, 4, h - bandH - 4);
    g.fillRect(x0, h * 0.68, pw, 4);
  }
}
// 一层檐下：上下两条额枋彩画，金色更多
function drawBand(g, w, h) {
  const row = (y0, rh, flip) => {
    const seg = w / 4;
    for (let k = 0; k < 4; k++) {
      const blue = (k + flip) % 2 === 0;
      g.fillStyle = blue ? '#1f4f9a' : '#2a8a6c';
      g.fillRect(k * seg, y0, seg, rh);
      g.strokeStyle = '#d8b24a'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(k * seg + seg * 0.16, y0 + 4); g.lineTo(k * seg + seg * 0.32, y0 + rh / 2); g.lineTo(k * seg + seg * 0.16, y0 + rh - 4); g.stroke();
      g.beginPath(); g.moveTo(k * seg + seg * 0.84, y0 + 4); g.lineTo(k * seg + seg * 0.68, y0 + rh / 2); g.lineTo(k * seg + seg * 0.84, y0 + rh - 4); g.stroke();
      g.fillStyle = '#d8b24a';
      g.beginPath(); g.ellipse(k * seg + seg / 2, y0 + rh / 2, seg * 0.12, rh * 0.28, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = blue ? '#2a8a6c' : '#1f4f9a';
      g.beginPath(); g.ellipse(k * seg + seg / 2, y0 + rh / 2, seg * 0.06, rh * 0.14, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#d8b24a'; g.fillRect(0, y0, w, 3); g.fillRect(0, y0 + rh - 3, w, 3);
  };
  row(0, h * 0.55, 0);
  g.fillStyle = '#8f2418'; g.fillRect(0, h * 0.55, w, h * 0.08);
  row(h * 0.63, h * 0.37, 1);
}
function drawPlaque(g, w, h) {
  // 宽金边（雕龙框，简化为凹凸的金色纹带）+ 蓝底金字
  g.fillStyle = '#c9982f'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e3bb55';
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    for (const [x, y] of [[t * w, 14], [t * w, h - 14], [14, t * h], [w - 14, t * h]]) { g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); }
  }
  g.strokeStyle = '#8a6420'; g.lineWidth = 3; g.strokeRect(36, 36, w - 72, h - 72);
  g.fillStyle = '#1f3c8c'; g.fillRect(44, 44, w - 88, h - 88);
  g.fillStyle = '#e8c35e';
  g.font = '700 96px "Noto Serif SC", "Songti SC", "SimSun", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  ['祈', '年', '殿'].forEach((c, i) => g.fillText(c, w / 2, h * (0.27 + i * 0.23)));
}
function polar(r, a, y = 0) { return new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)); }
