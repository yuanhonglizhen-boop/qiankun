import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { G, clipPlanes, clipEarth } from './materials.js';
import { buildDingling, applyBuild, setDoor, doorStateFromBuild } from './scene.js';
import { C, R, Y0, ANNOTATIONS, DIG_STEPS, DEFENSES, stageName } from './data.js';

const $ = (s) => document.querySelector(s);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 渲染器 ----------
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.localClippingEnabled = true;
renderer.setClearColor(0x000000, 0);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.3, 2000);
const HOME = { pos: new THREE.Vector3(78, 34, 14), target: new THREE.Vector3(-2, -18, -36) };
// 竖屏时拉远一些，让整座地宫进入画面
if (window.innerWidth < window.innerHeight) HOME.pos.sub(HOME.target).multiplyScalar(1.9).add(HOME.target);
camera.position.copy(HOME.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4;
controls.maxDistance = 420;
controls.autoRotateSpeed = 0.35;
controls.update();

const model = buildDingling(scene);
scene.updateMatrixWorld(true);

// ---------- 状态 ----------
const state = {
  B: reduceMotion ? 100 : 0,
  S: 0.5,
  playing: !reduceMotion,
  autoRotate: !reduceMotion,
  colorOn: false,
  wobble: true,
  notes: true,
  mode: 'free', // free | dig | demo | why
  step: 0,
};
let colorMix = 0;
let sectionTween = null;
let camTween = null;
const doorOverride = new Map();
let cutOverride = null;

// ---------- 主题 ----------
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const get = (k, f) => (cs.getPropertyValue(k).trim() || f);
  G.uPaper.value.set(get('--paper', '#ecebe6'));
  G.uInk.value.set(get('--ink', '#2b2d31'));
  G.uRed.value.set(get('--red', '#b8463a'));
}
readTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------- 尺寸 ----------
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  G.uDPR.value = dpr;
  G.uRes.value.set(w * dpr, h * dpr);
  G.uFocal.value = (h * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------- 剖切面 ----------
// 0–0.5：竖直剖开封土，剖面推到地宫背后；0.5–1：沿中轴东侧剖开殿身
const F = new THREE.Vector2(0, -40);
const BOX = [[-42, -80], [18, -80], [18, 46], [-42, 46]];
const support = (nx, nz) => Math.max(...BOX.map(([x, z]) => nx * (x - F.x) + nz * (z - F.y)));
const ease = (t) => t * t * (3 - 2 * t);
const sec = { n: new THREE.Vector3(1, 0, 0), c: 1e5, d: new THREE.Vector3(1, 0, 0), cA: 1e5 };
function updateSection() {
  const d = new THREE.Vector3().subVectors(camera.position, controls.target); d.y = 0;
  if (d.lengthSq() < 1e-6) d.set(1, 0, 0);
  d.normalize();
  const S = state.S;
  // 挖槽
  let cA = 1e5;
  if (S > 0.001) {
    const u = ease(Math.min(1, S / 0.5));
    const c0 = d.x * C.x + d.z * C.z + R + 14;
    const c1 = d.x * F.x + d.z * F.y - support(-d.x, -d.z) - 3;
    cA = c0 + (c1 - c0) * u;
  }
  clipEarth[0].normal.set(-d.x, 0, -d.z);
  clipEarth[0].constant = cA;
  sec.d.copy(d); sec.cA = cA;
  // 殿身剖切
  let n = d.clone(), c = 1e5;
  if (S > 0.5) {
    const u = (S - 0.5) / 0.5;
    const k = ease(Math.min(1, u / 0.3));
    const sx = Math.sign(d.x) || 1;
    n = new THREE.Vector3(d.x + (sx - d.x) * k, 0, d.z * (1 - k)).normalize();
    if (cutOverride) {
      n = new THREE.Vector3(cutOverride[0], 0, cutOverride[1]);
      const a = n.x * F.x + n.z * F.y + support(n.x, n.z) + 2;
      c = a + (cutOverride[2] - a) * ease(u);
    } else {
      const a = support(n.x, n.z) + 2;
      c = n.x * F.x + n.z * F.y + a + (2.6 - a) * ease(u);
    }
  }
  sec.n.copy(n); sec.c = c;
  clipPlanes[0].normal.set(-n.x, 0, -n.z);
  clipPlanes[0].constant = c;
}
const isClipped = (p, ground) => ground
  ? (sec.d.x * p[0] + sec.d.z * p[2] > sec.cA)
  : (sec.n.x * p[0] + sec.n.z * p[2] > sec.c);

// ---------- 注记 ----------
const labelLayer = $('#labels');
const leaderSvg = $('#leaders');
const labels = ANNOTATIONS.map((a) => {
  const el = document.createElement('div');
  el.className = 'note' + (a.red ? ' note-red' : '');
  el.innerHTML = `<b>${a.text}</b><span>${a.sub}</span>`;
  labelLayer.appendChild(el);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  leaderSvg.appendChild(line);
  if (a.red) line.classList.add('red');
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '2.2');
  leaderSvg.appendChild(dot);
  if (a.red) dot.classList.add('red');
  return { a, el, line, dot, v: new THREE.Vector3(...a.pos) };
});
const figRing = $('#figRing');
const tmpV = new THREE.Vector3();

function updateLabels() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const sc = w < 640 ? 0.55 : 1;
  const earthDone = state.B >= 86 && state.S < 0.32;
  for (const L of labels) {
    const a = L.a;
    let show = state.notes && state.B >= a.at && state.mode !== 'demo';
    if (show && isClipped(a.pos, a.pos[1] > 0 && !a.red)) show = false;
    if (show && earthDone && a.pos[1] < -1) show = false;
    if (show) {
      tmpV.copy(L.v).project(camera);
      if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.1 || Math.abs(tmpV.y) > 1.1) show = false;
    }
    if (!show) { L.el.hidden = true; L.line.style.display = 'none'; L.dot.style.display = 'none'; continue; }
    const x = (tmpV.x * 0.5 + 0.5) * w, y = (-tmpV.y * 0.5 + 0.5) * h;
    const lx = x + a.off[0] * sc, ly = y + a.off[1] * sc;
    L.el.hidden = false;
    const right = a.off[0] < 0;
    L.el.style.transform = `translate(${lx}px, ${ly}px) translate(${right ? '-100%' : '0'}, -50%)`;
    L.el.classList.toggle('flip', right);
    const ex = lx + (right ? 4 : -4);
    L.line.setAttribute('d', `M${x},${y} L${x + (lx - x) * 0.55},${ly} L${ex},${ly}`);
    L.line.style.display = ''; L.dot.style.display = '';
    L.dot.setAttribute('cx', x); L.dot.setAttribute('cy', y);
  }
  // 考古队员的红圈
  if (model.figure.visible) {
    tmpV.copy(model.figure.position).add(new THREE.Vector3(0, 0.9, 0)).project(camera);
    if (tmpV.z < 1) {
      figRing.hidden = false;
      figRing.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * w}px, ${(-tmpV.y * 0.5 + 0.5) * h}px)`;
    } else figRing.hidden = true;
  } else figRing.hidden = true;
}

// ---------- 相机飞行 ----------
function flyTo(pos, target, dur = 1.8) {
  camTween = {
    p0: camera.position.clone(), t0: controls.target.clone(),
    p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...target),
    s: performance.now(), d: reduceMotion ? 1 : dur * 1000,
  };
}
function tweenSection(to, dur = 1.4) {
  sectionTween = { from: state.S, to, s: performance.now(), d: reduceMotion ? 1 : dur * 1000 };
}

// ---------- 界面 ----------
const buildRange = $('#buildRange'), secRange = $('#secRange');
const buildOut = $('#buildOut'), secOut = $('#secOut');
function syncUI() {
  buildRange.value = Math.round(state.B * 10);
  secRange.value = Math.round(state.S * 1000);
  buildOut.textContent = `${stageName(state.B)}　${String(Math.round(state.B)).padStart(3, '0')}%`;
  secOut.textContent = state.S < 0.01 ? '未剖切' : state.S <= 0.5 ? `剖开封土　${String(Math.round(state.S * 200)).padStart(3, '0')}%` : `剖开殿身　${String(Math.round((state.S - 0.5) * 200)).padStart(3, '0')}%`;
  setPressed('#btnPlay', state.playing);
  setPressed('#btnRotate', state.autoRotate);
  setPressed('#btnColor', state.colorOn);
  setPressed('#btnWobble', state.wobble);
  setPressed('#btnNotes', state.notes);
  setPressed('#btnDig', state.mode === 'dig');
  setPressed('#btnDemo', state.mode === 'demo');
  setPressed('#btnWhy', state.mode === 'why');
}
function setPressed(sel, on) { $(sel).setAttribute('aria-pressed', on ? 'true' : 'false'); }

buildRange.addEventListener('input', () => { state.playing = false; state.B = buildRange.value / 10; syncUI(); });
secRange.addEventListener('input', () => { sectionTween = null; state.S = secRange.value / 1000; syncUI(); });
$('#btnPlay').addEventListener('click', () => {
  if (state.playing) state.playing = false;
  else { if (state.B >= 100) state.B = 0; state.playing = true; exitMode(); }
  syncUI();
});
$('#btnRotate').addEventListener('click', () => { state.autoRotate = !state.autoRotate; syncUI(); });
$('#btnColor').addEventListener('click', () => { state.colorOn = !state.colorOn; syncUI(); });
$('#btnWobble').addEventListener('click', () => { state.wobble = !state.wobble; syncUI(); });
$('#btnNotes').addEventListener('click', () => { state.notes = !state.notes; syncUI(); });
$('#btnReset').addEventListener('click', () => { exitMode(); flyTo(HOME.pos.toArray(), HOME.target.toArray()); tweenSection(0.5); });
$('#btnDig').addEventListener('click', () => (state.mode === 'dig' ? exitMode() : enterDig()));
$('#btnDemo').addEventListener('click', () => (state.mode === 'demo' ? exitMode() : enterDemo()));
$('#btnWhy').addEventListener('click', () => (state.mode === 'why' ? exitMode() : enterWhy()));

// ---------- 讲解面板 ----------
const panel = $('#panel');
const pKicker = $('#pKicker'), pTitle = $('#pTitle'), pBody = $('#pBody'), pNav = $('#pNav'), pCount = $('#pCount');
const pList = $('#pList'), demoFig = $('#demoFig');
$('#pClose').addEventListener('click', () => exitMode());
$('#pPrev').addEventListener('click', () => gotoStep(state.step - 1));
$('#pNext').addEventListener('click', () => gotoStep(state.step + 1));

function finishBuild() { state.playing = false; state.B = 100; }

function exitMode() {
  state.mode = 'free';
  panel.hidden = true;
  model.figure.visible = false;
  model.key.visible = false;
  doorOverride.clear();
  cutOverride = null;
  syncUI();
}

function enterDig() {
  exitMode();
  finishBuild();
  state.mode = 'dig';
  state.autoRotate = false;
  panel.hidden = false;
  pNav.hidden = false; pList.hidden = true; demoFig.hidden = true;
  figPos = null;
  gotoStep(0);
}
let figPos = null, figFrom = null, figT = 0, door1Anim = null;
function gotoStep(i) {
  i = Math.max(0, Math.min(DIG_STEPS.length - 1, i));
  state.step = i;
  const st = DIG_STEPS[i];
  pKicker.textContent = st.date;
  pTitle.textContent = st.title;
  pBody.textContent = st.text;
  pCount.textContent = `${i + 1} / ${DIG_STEPS.length}`;
  $('#pPrev').disabled = i === 0;
  $('#pNext').disabled = i === DIG_STEPS.length - 1;
  flyTo(st.cam, st.target, 2.2);
  cutOverride = st.cut ?? null;
  tweenSection(st.section);
  if (st.fig) {
    model.figure.visible = true;
    figFrom = figPos ? figPos.clone() : new THREE.Vector3(...st.fig);
    figPos = new THREE.Vector3(...st.fig);
    figT = performance.now();
  } else model.figure.visible = false;
  // 石门：发现前全部封闭；第 5 步推开第一道；之后全开
  doorOverride.clear();
  door1Anim = null;
  for (const d of model.doors) {
    if (i < 4) doorOverride.set(d.def.id, [0, 1]);
    else if (i === 4) doorOverride.set(d.def.id, [0, 1]);
    else doorOverride.set(d.def.id, [1, 0]);
  }
  if (i === 4) door1Anim = performance.now() + 1600;
  syncUI();
}

function enterWhy() {
  exitMode();
  finishBuild();
  state.mode = 'why';
  state.autoRotate = false;
  panel.hidden = false;
  pNav.hidden = true; pList.hidden = false; demoFig.hidden = true;
  pKicker.textContent = '防盗';
  pTitle.textContent = '为什么挖不进去';
  pBody.textContent = '定陵的地宫被打开，是因为考古队找到了明朝人自己留下的指路石。单靠蛮力，几百年里没人进去过。点下面每一条看对应位置。';
  pList.innerHTML = '';
  DEFENSES.forEach((d) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<i>${d.title}</i><span>${d.text}</span>`;
    b.addEventListener('click', () => {
      if (d.demo) { enterDemo(); return; }
      pList.querySelectorAll('button').forEach((x) => x.removeAttribute('aria-current'));
      b.setAttribute('aria-current', 'true');
      flyTo(d.cam, d.target);
      tweenSection(d.section);
    });
    li.appendChild(b);
    pList.appendChild(li);
  });
  syncUI();
}

// 自来石演示
const DEMO_STEPS = [
  [0, 2.5, '石门敞开，自来石立在门后地面的石槽里。'],
  [2.5, 5, '工匠退出后，从门外把两扇石门推拢。'],
  [5, 6.4, '门一合拢，自来石顺势倒下，上端卡进门背的凹槽。'],
  [6.4, 9.4, '从外面推门，推力顺着石条传进地槽，门越推越紧。'],
  [9.4, 12, '1957 年，考古队用"拐钉钥匙"从门缝伸进去，套住石条上端，把它推正。'],
  [12, 14.5, '自来石立直，石门就能推开了。'],
];
const DEMO_LEN = 14.5;
let demoStart = 0;
function enterDemo() {
  exitMode();
  finishBuild();
  state.mode = 'demo';
  state.autoRotate = false;
  panel.hidden = false;
  pNav.hidden = true; pList.hidden = true; demoFig.hidden = false;
  pKicker.textContent = '防盗机关';
  pTitle.textContent = '自来石';
  demoStart = performance.now();
  flyTo([0.6, -21.8, -41.5], [0, -25.9, -33.6], 2);
  tweenSection(1);
  syncUI();
}
const dStone = $('#dStone'), dLeaf = $('#dLeaf'), dPush = $('#dPush'), dForce = $('#dForce'), dKey = $('#dKey');
function demoFrame(now) {
  const t = ((now - demoStart) / 1000) % DEMO_LEN;
  let open = 1, tilt = 0, push = 0, key = 0;
  if (t < 2.5) { open = 1; tilt = 0; }
  else if (t < 5) { open = 1 - ease((t - 2.5) / 2.5); }
  else if (t < 6.4) { open = 0; tilt = easeIn((t - 5) / 1.4); }
  else if (t < 9.4) { open = 0.006 * Math.max(0, Math.sin((t - 6.4) * 9)); tilt = 1; push = 1; }
  else if (t < 12) { open = 0; key = 1; tilt = 1 - ease(Math.max(0, (t - 10.2) / 1.8)); }
  else { open = ease((t - 12) / 2.5); tilt = 0; }
  doorOverride.set(2, [open, tilt]);
  const cap = DEMO_STEPS.find((s) => t >= s[0] && t < s[1]);
  if (cap && pBody.textContent !== cap[2]) pBody.textContent = cap[2];
  // 拐钉钥匙
  model.key.visible = key > 0;
  if (key) {
    const d = model.doors[1];
    const h = d.stone.len * Math.cos(tilt * d.maxTilt) + 0.15;
    const reach = Math.min(1, (t - 9.4) / 0.8);
    model.key.position.set(0.02, -26.88 + h, -32.2 - 0.25 * reach);
    model.key.rotation.y = Math.PI;
  }
  // 示意图
  const ang = tilt * Math.asin(0.75 / 1.6);
  const bx = 152, by = 150, L = 128;
  dStone.setAttribute('x2', bx - L * Math.sin(ang)); dStone.setAttribute('y2', by - L * Math.cos(ang));
  dLeaf.style.opacity = String(0.25 + 0.75 * (1 - open));
  dLeaf.setAttribute('stroke-dasharray', open > 0.5 ? '4 3' : 'none');
  dPush.style.opacity = String(push);
  dForce.style.opacity = String(push);
  dKey.style.opacity = String(key);
}
const easeIn = (t) => t * t;

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let last = performance.now();
let lastSig = '';
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  G.uTime.value += dt;
  if (state.wobble) { G.uBoil.value = Math.floor(G.uTime.value * 5); G.uJit.value = 1.25; }
  else { G.uJit.value = 0.7; }

  if (state.playing) {
    state.B = Math.min(100, state.B + dt * 100 / 34);
    if (state.B >= 100) { state.playing = false; if (state.mode === 'free') tweenSection(1, 3); }
  }
  const sig = `${state.B.toFixed(1)}|${state.S.toFixed(3)}|${state.playing}`;
  if (sig !== lastSig) { lastSig = sig; syncUI(); }
  if (sectionTween) {
    const k = Math.min(1, (now - sectionTween.s) / sectionTween.d);
    state.S = sectionTween.from + (sectionTween.to - sectionTween.from) * ease(k);
    if (k >= 1) sectionTween = null;
  }
  if (camTween) {
    const k = ease(Math.min(1, (now - camTween.s) / camTween.d));
    camera.position.lerpVectors(camTween.p0, camTween.p1, k);
    controls.target.lerpVectors(camTween.t0, camTween.t1, k);
    if (k >= 1) camTween = null;
  }
  controls.autoRotate = state.autoRotate && !camTween;
  controls.update();

  // 着彩
  const autoColor = Math.max(0, Math.min(1, (state.B - 94) / 6));
  const target = state.colorOn ? 1 : autoColor;
  colorMix += (target - colorMix) * Math.min(1, dt * 3);
  G.uColor.value = colorMix;

  applyBuild(model, state.B);
  if (state.mode === 'demo') demoFrame(now);
  if (state.mode === 'dig' && door1Anim && now > door1Anim) {
    const t = (now - door1Anim) / 1000;
    const tilt = 1 - ease(Math.min(1, t / 1.6));
    const open = ease(Math.max(0, Math.min(1, (t - 1.8) / 2)));
    doorOverride.set(1, [open, tilt]);
  }
  for (const d of model.doors) {
    const o = doorOverride.get(d.def.id);
    const [open, tilt] = o ?? doorStateFromBuild(d, state.B);
    setDoor(d, open, tilt);
  }
  if (model.figure.visible && figPos) {
    const k = ease(Math.min(1, (now - figT) / 2000));
    model.figure.position.lerpVectors(figFrom, figPos, k);
  }

  updateSection();
  renderer.render(scene, camera);
  updateLabels();
  updateCompass();
  requestAnimationFrame(frame);
}

const needle = $('#needle');
function updateCompass() {
  const d = new THREE.Vector3().subVectors(camera.position, controls.target);
  const deg = Math.atan2(-d.x, d.z) * 180 / Math.PI;
  needle.style.transform = `rotate(${-deg}deg)`;
}

syncUI();
requestAnimationFrame(frame);
window.__dl = { state, camera, controls, model, flyTo, tweenSection, enterDig, enterDemo, enterWhy, gotoStep, exitMode };
