import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { analyse } from './mosaic.js';

const $ = (s) => document.querySelector(s);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 渲染器 ----------
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#15130f');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 1.2;
controls.maxDistance = 40;

// 暖色侧光，压低角度，让每块砖都投出短影、金砖闪光
const sun = new THREE.DirectionalLight('#ffe2b8', 3.2);
sun.position.set(-9, 7, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera; sc.left = -11; sc.right = 11; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 30;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.01;
scene.add(sun);
scene.add(new THREE.HemisphereLight('#fff4e0', '#3a2f22', 0.35));

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 8, aperture: 0.0035, maxblur: 0.008 });
composer.addPass(bokeh);
composer.addPass(new OutputPass());

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- 动画 uniform ----------
const U = { uT: { value: 0 }, uDur: { value: 0.9 } };
const HEAD = /* glsl */ `
attribute float aStart; attribute float aSeed;
uniform float uT; uniform float uDur;
mat3 rX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 rZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
float aK(){ return clamp((uT - aStart) / uDur, 0., 1.); }
mat3 aRot(){ float e = 1. - aK(); float a = e * e * (1.2 + aSeed * 2.4); return rX(a * 0.8) * rZ(a * 0.6); }
float aDrop(){ float e = 1. - aK(); return e * e * (1.5 + aSeed * 1.6); }
`;
const PROJECT = /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.y += aDrop();
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;
const WORLDPOS = /* glsl */ `
#if defined( USE_ENVMAP ) || defined( USE_SHADOWMAP ) || defined( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
  vec4 worldPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    worldPosition = instanceMatrix * worldPosition;
  #endif
  worldPosition.y += aDrop();
  worldPosition = modelMatrix * worldPosition;
#endif
`;
function animated(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = U.uT; sh.uniforms.uDur = U.uDur;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + HEAD)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = aRot() * objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = aRot() * transformed * step(0.0001, aK());')
      .replace('#include <project_vertex>', PROJECT)
      .replace('#include <worldpos_vertex>', WORLDPOS);
  };
  return mat;
}

// ---------- 砖形：几种略不规则的倒角方块 ----------
function tileVariants(n, seed) {
  const out = [];
  let a = seed;
  const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  for (let k = 0; k < n; k++) {
    const g = new RoundedBoxGeometry(1, 1, 1, 1, 0.12);
    const p = g.attributes.position;
    const k1 = (rnd() - 0.5) * 0.22, k2 = (rnd() - 0.5) * 0.18, k3 = (rnd() - 0.5) * 0.22, k4 = (rnd() - 0.5) * 0.1;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      p.setXYZ(i, x * (1 + k1 * z) + k2 * z, y * (1 + k4 * x), z * (1 + k3 * x) + k2 * 0.4 * x);
    }
    g.computeVertexNormals();
    out.push(g);
  }
  return out;
}

const MATS = {
  gold: () => animated(new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.2, color: '#ffffff' })),
  glass: () => animated(new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.26, clearcoat: 0.7, clearcoatRoughness: 0.15 })),
  stone: () => animated(new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.92, envMapIntensity: 0.45 })),
};
const depthMat = animated(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));

// ---------- 场景搭建 ----------
const WW = 18;
let HH = 9.4, built = null, tileTotal = 0, animSpan = 24;
const root = new THREE.Group();
scene.add(root);

const img = new Image();
img.src = 'assets/segment.jpg';
const imgTex = new THREE.TextureLoader().load('assets/segment.jpg');
imgTex.colorSpace = THREE.SRGBColorSpace;

let density = 'mid';
const DENS = { low: 11, mid: 8, high: 6.5 };

img.decode().then(() => build());

function build() {
  if (built) { root.remove(built); built.traverse((o) => o.geometry && o.geometry.dispose()); }
  const res = analyse(img, { cell: 2, tile: DENS[density] });
  HH = WW * res.aspect;
  const s = DENS[density] / img.naturalWidth * WW;
  const g = new THREE.Group();

  // 灰浆底与红色起稿线
  const cv = document.createElement('canvas');
  cv.width = res.N; cv.height = res.M;
  const c2 = cv.getContext('2d');
  c2.fillStyle = '#4f483e'; c2.fillRect(0, 0, cv.width, cv.height);
  const id = c2.getImageData(0, 0, cv.width, cv.height);
  for (let i = 0; i < res.N * res.M; i++) {
    const n = (Math.random() - 0.5) * 22;
    id.data[i * 4] = 84 + n; id.data[i * 4 + 1] = 77 + n; id.data[i * 4 + 2] = 66 + n;
  }
  c2.putImageData(id, 0, 0);
  const bedTex = new THREE.CanvasTexture(cv);
  bedTex.colorSpace = THREE.SRGBColorSpace;
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(WW + 0.2, HH + 0.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: bedTex, roughness: 0.95 }));
  bed.receiveShadow = true;
  g.add(bed);
  // 起稿线单独一层，铺砌过半后淡出
  const sk = document.createElement('canvas');
  sk.width = res.N; sk.height = res.M;
  const s2 = sk.getContext('2d'), sd = s2.createImageData(res.N, res.M);
  for (let i = 0; i < res.N * res.M; i++) if (res.edge[i]) { sd.data[i * 4] = 190; sd.data[i * 4 + 1] = 72; sd.data[i * 4 + 2] = 50; sd.data[i * 4 + 3] = 235; }
  s2.putImageData(sd, 0, 0);
  const skTex = new THREE.CanvasTexture(sk);
  skTex.colorSpace = THREE.SRGBColorSpace;
  const sketch = new THREE.Mesh(new THREE.PlaneGeometry(WW, HH).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: skTex, transparent: true, roughness: 0.95, depthWrite: false }));
  sketch.position.y = 0.003;
  sketch.receiveShadow = true;
  g.add(sketch);
  g.userData.sketch = sketch;

  // 木框与桌面
  const wood = new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: 0.55 });
  const fw = 0.38, fh = 0.32;
  for (const [x, z, sx, sz] of [[0, -(HH / 2 + fw / 2 + 0.1), WW + 2 * fw + 0.2, fw], [0, HH / 2 + fw / 2 + 0.1, WW + 2 * fw + 0.2, fw], [-(WW / 2 + fw / 2 + 0.1), 0, fw, HH + 0.2], [WW / 2 + fw / 2 + 0.1, 0, fw, HH + 0.2]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, fh, sz), wood);
    m.position.set(x, fh / 2 - 0.05, z); m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  const table = new THREE.Mesh(new THREE.PlaneGeometry(80, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a221b', roughness: 0.9 }));
  table.position.y = -0.06; table.receiveShadow = true;
  g.add(table);

  // 砖
  const V = 5, variants = tileVariants(V, 12345);
  const buckets = {};
  for (const t of res.tiles) {
    const v = Math.floor(((Math.sin(t.u * 9123.1 + t.v * 7311.7) + 1) * 0.5) * V) % V;
    const key = t.cls + v;
    (buckets[key] ||= { cls: t.cls, v, list: [] }).list.push(t);
  }
  const hslTmp = { h: 0, s: 0, l: 0 };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc3 = new THREE.Vector3(), col = new THREE.Color();
  tileTotal = 0;
  for (const b of Object.values(buckets)) {
    const n = b.list.length;
    const geo = variants[b.v].clone();
    const aStart = new Float32Array(n), aSeed = new Float32Array(n);
    const mesh = new THREE.InstancedMesh(geo, MATS[b.cls](), n);
    mesh.customDepthMaterial = depthMat;
    mesh.castShadow = true; mesh.receiveShadow = true;
    b.list.forEach((t, i) => {
      const r1 = hash(t.u * 13.1 + t.v * 7.7), r2 = hash(t.u * 3.3 + t.v * 17.9), r3 = hash(t.u * 29.7 + t.v * 1.3);
      const tilt = b.cls === 'gold' ? 0.07 : 0.025;
      const thick = s * (b.cls === 'gold' ? 0.34 : 0.42 + r2 * 0.12);
      e.set((r1 - 0.5) * tilt, -t.ang + (r3 - 0.5) * 0.16, (r2 - 0.5) * tilt);
      q.setFromEuler(e);
      p.set((t.u - 0.5) * WW, thick / 2 + 0.005, (t.v - 0.5) * HH);
      sc3.set(s * (0.9 + r1 * 0.08), thick, s * (0.88 + r3 * 0.09));
      m4.compose(p, q, sc3);
      mesh.setMatrixAt(i, m4);
      const k = 0.94 + r2 * 0.12;
      col.setRGB(t.c[0], t.c[1], t.c[2], THREE.SRGBColorSpace);
      col.getHSL(hslTmp);
      col.setHSL(hslTmp.h, Math.min(1, hslTmp.s * 1.3), Math.min(1, (hslTmp.l - 0.5) * 1.15 + 0.5) * k);
      if (b.cls === 'gold') col.lerp(new THREE.Color('#e3b65c'), 0.55);
      mesh.setColorAt(i, col);
      aStart[i] = 1.0 + t.order * animSpan * 0.92;
      aSeed[i] = r3;
    });
    geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(aStart, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    g.add(mesh);
    tileTotal += n;
  }

  // 原画对照层
  const orig = new THREE.Mesh(new THREE.PlaneGeometry(WW, HH).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: imgTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  orig.position.y = s * 0.7;
  orig.renderOrder = 5;
  g.add(orig);
  g.userData.orig = orig;

  root.add(g);
  built = g;
  $('#loading').hidden = true;
  fillCard(res);
  restart();
}
function hash(x) { const s = Math.sin(x * 127.1) * 43758.5453; return s - Math.floor(s); }

// ---------- 镜头脚本 ----------
const KEYS = [
  [0, [10.6, 1.5, 5.4], [7.2, 0, 1.2]],
  [5, [7.0, 1.8, 4.8], [3.8, 0, 0.6]],
  [10, [1.2, 2.4, 5.2], [-2.0, 0, 0.1]],
  [15, [-5.2, 3.0, 6.2], [-4.6, 0, -0.8]],
  [20, [-1.5, 8.5, 12.5], [0, 0, -0.4]],
  [25.5, [0, 16.5, 8.2], [0, 0, -0.2]],
];
const vA = new THREE.Vector3(), vB = new THREE.Vector3();
function catmull(arr, i, u, idx, out) {
  const P = (k) => arr[Math.max(0, Math.min(arr.length - 1, k))][idx];
  const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
  const u2 = u * u, u3 = u2 * u;
  out.set(0, 0, 0);
  for (let c = 0; c < 3; c++) {
    out.setComponent(c, 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3));
  }
  return out;
}
function camAt(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const u = Math.max(0, Math.min(1, (t - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0])));
  const uu = u * u * (3 - 2 * u) * 0.35 + u * 0.65;
  catmull(KEYS, i, uu, 1, vA); catmull(KEYS, i, uu, 2, vB);
  camera.position.copy(vA); controls.target.copy(vB);
}

// ---------- 状态与界面 ----------
const state = { t: 0, cinematic: true, narr: true, orig: false, dof: true, playing: true };
let origMix = 0;
const animating = () => state.t < animSpan + 1.2;
const textOn = () => state.narr && !animating();

function restart() {
  state.t = reduceMotion ? animSpan + 2 : 0;
  state.cinematic = !reduceMotion;
  if (reduceMotion) { camera.position.set(0, 16.5, 8.2); controls.target.set(0, 0, -0.2); }
  syncUI();
}
renderer.domElement.addEventListener('pointerdown', () => { state.cinematic = false; });
renderer.domElement.addEventListener('wheel', () => { state.cinematic = false; }, { passive: true });

const setPressed = (sel, on) => $(sel).setAttribute('aria-pressed', on ? 'true' : 'false');
function syncUI() {
  setPressed('#btnNarr', state.narr);
  setPressed('#btnOrig', state.orig);
  setPressed('#btnDof', state.dof);
  for (const d of ['low', 'mid', 'high']) setPressed(`#d_${d}`, density === d);
  $('#card').hidden = !textOn();
  $('#head').hidden = !textOn();
}
$('#btnReplay').addEventListener('click', restart);
$('#btnNarr').addEventListener('click', () => { state.narr = !state.narr; syncUI(); });
$('#btnOrig').addEventListener('click', () => { state.orig = !state.orig; syncUI(); });
$('#btnDof').addEventListener('click', () => { state.dof = !state.dof; syncUI(); });
for (const d of ['low', 'mid', 'high']) $(`#d_${d}`).addEventListener('click', () => { if (density !== d) { density = d; build(); } });

function fillCard(res) {
  $('#count').textContent = tileTotal.toLocaleString('zh-CN');
  const by = { gold: 0, glass: 0, stone: 0 };
  const pal = { gold: new Map(), glass: new Map(), stone: new Map() };
  for (const t of res.tiles) { by[t.cls]++; pal[t.cls].set(t.c.join(), t.c); }
  for (const k of ['gold', 'glass', 'stone']) {
    $(`#n_${k}`).textContent = by[k].toLocaleString('zh-CN');
    const box = $(`#sw_${k}`);
    box.innerHTML = '';
    [...pal[k].values()].sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2])).forEach((c) => {
      const i = document.createElement('i');
      i.style.background = `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
      box.appendChild(i);
    });
  }
}

// ---------- 主循环 ----------
let last = performance.now(), lastAnim = null;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (built) state.t += dt;
  U.uT.value = state.t;
  if (state.cinematic && built) camAt(Math.min(state.t, 26));
  controls.enabled = !state.cinematic || !animating();
  controls.update();
  const a = animating();
  if (a !== lastAnim) { lastAnim = a; syncUI(); }

  if (built) {
    origMix += ((state.orig ? 1 : 0) - origMix) * Math.min(1, dt * 4);
    built.userData.orig.material.opacity = origMix;
    built.userData.orig.visible = origMix > 0.01;
    built.userData.sketch.material.opacity = 1 - Math.min(1, Math.max(0, (state.t - 12) / 10));
  }
  bokeh.enabled = state.dof;
  bokeh.uniforms.focus.value = camera.position.distanceTo(controls.target);
  const settle = Math.min(1, Math.max(0, (state.t - 19) / 5));
  bokeh.uniforms.aperture.value = 0.0035 * (1 - settle) + 0.0006 * settle;
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__qj = { state, camera, controls, restart, camAt };
