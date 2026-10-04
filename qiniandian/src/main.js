import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { G, clipPlanes } from './materials.js';
import { buildHall, applyBuild, buildLoadPaths, polar } from './scene.js';
import { buildReal } from './real.js';
import { FLOOR, COLUMNS, colAngles, ANNOTATIONS, COUNT_STEPS, LOAD_STEPS, HISTORY, stageName } from './data.js';

const $ = (s) => document.querySelector(s);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 渲染器 ----------
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.2, 2000);
const HOME = { pos: new THREE.Vector3(46, 30, 58), target: new THREE.Vector3(0, 17, 0) };
if (window.innerWidth < window.innerHeight) HOME.pos.sub(HOME.target).multiplyScalar(1.7).add(HOME.target);
camera.position.copy(HOME.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1;
controls.maxDistance = 400;
controls.autoRotateSpeed = 0.4;
controls.update();

const model = buildHall(scene);
model.clipPlanes = clipPlanes;
model.lineFade = (v) => { G.uLineFade.value = v; };
const real = buildReal(scene, renderer, model);
const load = buildLoadPaths(scene);
scene.updateMatrixWorld(true);

// ---------- 状态 ----------
const state = {
  B: reduceMotion ? 100 : 0,
  S: 0,
  playing: !reduceMotion,
  autoRotate: !reduceMotion,
  colorOn: false,
  wobble: true,
  narr: true,        // 讲解文字开关
  paint: 0,          // 上色进度 0–1，由上色滑杆或“播放上色”控制
  painting: false,   // 正在播放上色
  mode: 'free',      // free | count | load | history | caisson
  step: 0,
};
let colorMix = 0, sectionTween = null, camTween = null, buildAnim = null, fovTarget = 34;
let paintP = 0;
const textOn = () => state.narr && !state.playing && !buildAnim && !state.painting;

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

// ---------- 剖切：竖直面始终朝向观者，从台基外缘推到中轴 ----------
const ease = (t) => t * t * (3 - 2 * t);
const sec = { d: new THREE.Vector3(1, 0, 0), c: 1e5 };
function updateSection() {
  const d = new THREE.Vector3().subVectors(camera.position, controls.target); d.y = 0;
  if (d.lengthSq() < 1e-6) d.set(1, 0, 0);
  d.normalize();
  const c = state.S < 0.001 ? 1e5 : 47 - 47 * ease(state.S);
  sec.d.copy(d); sec.c = c;
  clipPlanes[0].normal.set(-d.x, 0, -d.z);
  clipPlanes[0].constant = c;
}
const isClipped = (p) => sec.d.x * p[0] + sec.d.z * p[2] > sec.c;

// ---------- 注记 ----------
const labelLayer = $('#labels'), leaderSvg = $('#leaders');
function makeLabel(a) {
  const el = document.createElement('div');
  el.className = 'note' + (a.red ? ' note-red' : '');
  el.innerHTML = a.sub ? `<b>${a.text}</b><span>${a.sub}</span>` : `<b>${a.text}</b>`;
  el.hidden = true;
  labelLayer.appendChild(el);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '2.2');
  if (a.red) { line.classList.add('red'); dot.classList.add('red'); }
  leaderSvg.append(line, dot);
  return { a, el, line, dot, v: new THREE.Vector3(...a.pos) };
}
const labels = ANNOTATIONS.map(makeLabel);
// 数柱子用的柱名
const colLabels = {};
for (const [key, c] of Object.entries(COLUMNS)) {
  colLabels[key] = colAngles(c).map((a) => {
    const p = polar(c.r, a, FLOOR + c.h + 0.8);
    const L = makeLabel({ text: '', pos: [p.x, p.y, p.z], off: [0, 0] });
    L.el.classList.add('tag');
    return L;
  });
}
const tmpV = new THREE.Vector3();

function place(L, show, w, h, sc) {
  if (show) {
    tmpV.copy(L.v).project(camera);
    if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.1 || Math.abs(tmpV.y) > 1.1) show = false;
  }
  if (!show) { L.el.hidden = true; L.line.style.display = 'none'; L.dot.style.display = 'none'; return; }
  const a = L.a;
  const x = (tmpV.x * 0.5 + 0.5) * w, y = (-tmpV.y * 0.5 + 0.5) * h;
  L.el.hidden = false;
  if (L.el.classList.contains('tag')) {
    L.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    L.line.style.display = 'none'; L.dot.style.display = 'none';
    return;
  }
  const lx = x + a.off[0] * sc, ly = y + a.off[1] * sc, right = a.off[0] < 0;
  L.el.style.transform = `translate(${lx}px, ${ly}px) translate(${right ? '-100%' : '0'}, -50%)`;
  L.el.classList.toggle('flip', right);
  L.line.setAttribute('d', `M${x},${y} L${x + (lx - x) * 0.55},${ly} L${lx + (right ? 4 : -4)},${ly}`);
  L.line.style.display = ''; L.dot.style.display = '';
  L.dot.setAttribute('cx', x); L.dot.setAttribute('cy', y);
}

function updateLabels() {
  const w = stage.clientWidth, h = stage.clientHeight, sc = w < 640 ? 0.55 : 1;
  const on = textOn();
  for (const L of labels) {
    const a = L.a;
    let show = on && (state.mode === 'free' || state.mode === 'caisson') && state.B >= a.at && !isClipped(a.pos);
    if (state.mode === 'caisson') show = show && !!a.inside;
    else if (a.inside) show = show && state.S > 0.6;
    place(L, show, w, h, sc);
  }
  const step = state.mode === 'count' ? COUNT_STEPS[state.step] : null;
  let base = 0;
  for (const key of ['dragon', 'gold', 'eave']) {
    const arr = colLabels[key];
    const inStep = !!step && step.groups.includes(key);
    arr.forEach((L, i) => {
      const names = inStep && step.names ? step.names : null;
      L.el.firstChild.textContent = names ? names[i] : String(base + i + 1);
      place(L, on && inStep, w, h, sc);
    });
    if (inStep) base += arr.length;
  }
}

// ---------- 动画工具 ----------
function flyTo(pos, target, dur = 1.8) {
  camTween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...target), s: performance.now(), d: reduceMotion ? 1 : dur * 1000 };
}
function tweenSection(to, dur = 1.4) {
  sectionTween = { from: state.S, to, s: performance.now(), d: reduceMotion ? 1 : dur * 1000 };
}
function animateBuild(to, dur, done) {
  buildAnim = { from: state.B, to, s: performance.now(), d: reduceMotion ? 1 : dur * 1000, done };
}

// ---------- 界面 ----------
const buildRange = $('#buildRange'), secRange = $('#secRange');
const buildOut = $('#buildOut'), secOut = $('#secOut');
const paintRange = $('#paintRange'), paintOut = $('#paintOut');
const PAINT_STAGES = [[0, '台基'], [0.1, '红柱槅扇'], [0.26, '鼓身彩画'], [0.34, '斗拱额枋'], [0.5, '下檐'], [0.62, '中檐'], [0.74, '上檐'], [0.84, '点金'], [1, '上色完成']];
const paintStage = (p) => { let n = PAINT_STAGES[0][1]; for (const [a, t] of PAINT_STAGES) if (p >= a - 1e-6) n = t; return p <= 0 ? '未上色' : n; };
function setPressed(sel, on) { $(sel).setAttribute('aria-pressed', on ? 'true' : 'false'); }
function syncUI() {
  buildRange.value = Math.round(state.B * 10);
  secRange.value = Math.round(state.S * 1000);
  buildOut.textContent = `${stageName(state.B)}　${String(Math.round(state.B)).padStart(3, '0')}%`;
  secOut.textContent = state.S < 0.01 ? '未剖切' : `剖切　${String(Math.round(state.S * 100)).padStart(3, '0')}%`;
  setPressed('#btnPlay', state.playing);
  setPressed('#btnRotate', state.autoRotate);
  setPressed('#btnColor', state.colorOn);
  setPressed('#btnWobble', state.wobble);
  setPressed('#btnNarr', state.narr);
  setPressed('#btnPaint', state.painting);
  const canPaint = state.B >= 99.5;
  paintRange.disabled = !canPaint;
  paintRange.value = Math.round(state.paint * 1000);
  paintOut.textContent = canPaint ? `${paintStage(state.paint)}　${String(Math.round(state.paint * 100)).padStart(3, '0')}%` : '先完成线描';
  for (const m of ['count', 'load', 'history', 'caisson']) setPressed(`#btn_${m}`, state.mode === m);
  panel.hidden = state.mode === 'free' || !textOn();
}

buildRange.addEventListener('input', () => { state.playing = false; buildAnim = null; state.B = buildRange.value / 10; syncUI(); });
secRange.addEventListener('input', () => { sectionTween = null; state.S = secRange.value / 1000; syncUI(); });
$('#btnPlay').addEventListener('click', () => {
  if (state.playing) state.playing = false;
  else { exitMode(); if (state.B >= 100) state.B = 0; state.playing = true; state.painting = false; state.paint = 0; }
  syncUI();
});
$('#btnRotate').addEventListener('click', () => { state.autoRotate = !state.autoRotate; syncUI(); });
$('#btnColor').addEventListener('click', () => { state.colorOn = !state.colorOn; syncUI(); });
$('#btnWobble').addEventListener('click', () => { state.wobble = !state.wobble; syncUI(); });
$('#btnNarr').addEventListener('click', () => { state.narr = !state.narr; syncUI(); });
$('#btnPaint').addEventListener('click', () => {
  if (state.painting) state.painting = false;
  else {
    if (state.B < 99.5) { state.playing = false; buildAnim = null; state.B = 100; }
    if (state.paint >= 1) state.paint = 0;
    state.painting = true;
  }
  syncUI();
});
paintRange.addEventListener('input', () => { state.painting = false; state.paint = paintRange.value / 1000; syncUI(); });
$('#btnReset').addEventListener('click', () => { exitMode(); flyTo(HOME.pos.toArray(), HOME.target.toArray()); tweenSection(0); });
$('#btn_count').addEventListener('click', () => (state.mode === 'count' ? exitMode() : enterMode('count')));
$('#btn_load').addEventListener('click', () => (state.mode === 'load' ? exitMode() : enterMode('load')));
$('#btn_history').addEventListener('click', () => (state.mode === 'history' ? exitMode() : enterMode('history')));
$('#btn_caisson').addEventListener('click', () => (state.mode === 'caisson' ? exitMode() : enterMode('caisson')));

// ---------- 讲解面板 ----------
const panel = $('#panel');
const pKicker = $('#pKicker'), pTitle = $('#pTitle'), pBody = $('#pBody'), pNav = $('#pNav'), pCount = $('#pCount');
$('#pClose').addEventListener('click', () => exitMode());
$('#pPrev').addEventListener('click', () => gotoStep(state.step - 1));
$('#pNext').addEventListener('click', () => gotoStep(state.step + 1));

const roofTints = model.roofs.map((r) => r.obj.children[0].material.uniforms.uTint.value.clone());
function setRoofTints(list) {
  model.roofs.forEach((r, i) => { const m = r.obj.children[0]; (m.userData.sk || m.material).uniforms.uTint.value.set(list ? list[i] : roofTints[i]); });
  real.setRoofColors(list);
}
function highlightColumns(groups) {
  for (const [key, g] of Object.entries(model.colGroups)) {
    const on = !groups || groups.includes(key);
    const [mesh, lines] = g.children;
    mesh.material.uniforms.uInkAmt.value = on ? 1 : 0.25;
    lines.material.uniforms.uAlpha.value = on ? 0.9 : 0.12;
    lines.material.uniforms.uUseRed.value = groups && on ? 1 : 0;
  }
}

function exitMode() {
  if (state.mode === 'count' || state.mode === 'history') { buildAnim = null; state.B = 100; }
  state.mode = 'free';
  fovTarget = 34;
  highlightColumns(null);
  setRoofTints(null);
  load.pathObj.visible = false; load.ringObj.visible = false;
  syncUI();
}

const MODE_STEPS = { count: COUNT_STEPS, load: LOAD_STEPS, history: HISTORY };
function enterMode(m) {
  exitMode();
  state.playing = false;
  state.narr = true; // 点讲解模式即打开讲解文字
  state.mode = m;
  state.autoRotate = false;
  if (m === 'caisson') {
    pNav.hidden = true;
    pKicker.textContent = '仰望';
    pTitle.textContent = '龙凤藻井';
    pBody.textContent = '站在殿中央往上看：三重檐对应殿内三层天花，正中的藻井一圈圈向上收进，顶心雕着龙凤。地面正中对应一块圆形的龙凤石。';
    state.B = 100;
    tweenSection(0);
    fovTarget = 74;
    flyTo([0.05, FLOOR + 1.6, 0.12], [0, 30, 0], 2.2);
  } else {
    pNav.hidden = false;
    gotoStep(0);
  }
  syncUI();
}

function gotoStep(i) {
  const steps = MODE_STEPS[state.mode];
  if (!steps) return;
  i = Math.max(0, Math.min(steps.length - 1, i));
  state.step = i;
  const st = steps[i];
  pCount.textContent = `${i + 1} / ${steps.length}`;
  $('#pPrev').disabled = i === 0;
  $('#pNext').disabled = i === steps.length - 1;
  pTitle.textContent = st.title;
  pBody.textContent = st.text;
  if (state.mode === 'count') {
    pKicker.textContent = st.kicker;
    state.B = 33;
    tweenSection(0);
    highlightColumns(st.groups);
    flyTo([30, 50, 40], [0, 12, 0]);
  } else if (state.mode === 'load') {
    pKicker.textContent = `受力 · ${i + 1}`;
    state.B = 100;
    tweenSection(1);
    load.pathObj.visible = true;
    load.ringObj.visible = st.rings;
    loadShow = st.show;
    flyTo(st.rings ? [34, 30, 6] : [44, 18, 4], st.rings ? [0, 14, 0] : [0, 17, 0]);
  } else if (state.mode === 'history') {
    if (state.paint < 1 && !state.painting) state.paint = 1;
    pKicker.textContent = st.kicker;
    tweenSection(0);
    setRoofTints(st.tiers);
    if (st.anim) animateBuild(st.B, st.B < state.B ? 3.5 : 7, () => syncUI());
    else { buildAnim = null; state.B = st.B; }
    flyTo([54, 22, 70], [0, 14, 0]);
  }
  syncUI();
}
let loadShow = 1, loadStart = performance.now();

// ---------- 主循环 ----------
let last = performance.now(), lastSig = '';
let video = false;
function frame(now) {
  if (video) { requestAnimationFrame(frame); return; }
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  G.uTime.value += dt;
  if (state.wobble) { G.uBoil.value = Math.floor(G.uTime.value * 5); G.uJit.value = 1.25; } else G.uJit.value = 0.7;

  if (state.playing) {
    state.B = Math.min(100, state.B + dt * 100 / 36);
    if (state.B >= 100) state.playing = false;
  }
  if (buildAnim) {
    const k = Math.min(1, (now - buildAnim.s) / buildAnim.d);
    state.B = buildAnim.from + (buildAnim.to - buildAnim.from) * ease(k);
    if (k >= 1) { const done = buildAnim.done; buildAnim = null; done && done(); }
  }
  if (sectionTween) {
    const k = Math.min(1, (now - sectionTween.s) / sectionTween.d);
    state.S = sectionTween.from + (sectionTween.to - sectionTween.from) * ease(k);
    if (k >= 1) sectionTween = null;
  }
  const sig = `${state.B.toFixed(1)}|${state.S.toFixed(3)}|${state.playing}|${!!buildAnim}|${state.paint.toFixed(3)}|${state.painting}`;
  if (sig !== lastSig) { lastSig = sig; syncUI(); }
  if (camTween) {
    const k = ease(Math.min(1, (now - camTween.s) / camTween.d));
    camera.position.lerpVectors(camTween.p0, camTween.p1, k);
    controls.target.lerpVectors(camTween.t0, camTween.t1, k);
    if (k >= 1) camTween = null;
  }
  if (Math.abs(camera.fov - fovTarget) > 0.05) {
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
    G.uFocal.value = G.uRes.value.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
  controls.autoRotate = state.autoRotate && !camTween;
  controls.update();

  // 写实开启时，线稿阶段保持黑白素描，颜色交给上色过程
  // 线描阶段保持黑白素描；“淡彩”按钮可以单独打开线稿上的水彩
  const autoColor = 0;
  const target = state.colorOn || state.mode === 'history' || state.mode === 'count' ? 1 : autoColor;
  colorMix += (target - colorMix) * Math.min(1, dt * 3);
  G.uColor.value = colorMix;

  applyBuild(model, state.B);
  if (state.painting) {
    state.paint = reduceMotion ? 1 : Math.min(1, state.paint + dt / 12);
    if (state.paint >= 1) state.painting = false;
  }
  // 上色：线稿完成后约 12 秒逐部位刷出颜色；关掉写实时快速退回
  // 上色只在线描完成后生效；数柱子、不用大梁两个模式固定显示线稿
  paintP = state.B >= 99.5 && state.mode !== 'count' && state.mode !== 'load' ? state.paint : 0;
  real.setProgress(paintP);
  if (load.pathObj.visible) {
    const t = ((now - loadStart) / 2600) % 1.25;
    load.local.uProg.value = Math.min(loadShow, t);
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
  needle.style.transform = `rotate(${-Math.atan2(-d.x, d.z) * 180 / Math.PI}deg)`;
}

syncUI();

// ---------- 录制演示视频：按固定时间轴逐帧渲染 ----------
// 0–3 秒片头；3–23 秒线描；25–37 秒上色；37–45 秒环绕成品，40 秒起片尾字
const VKEYS = [
  // [时间, 方位角(度，0=正南), 半径, 高度, 注视点高度]
  [0, -38, 74, 30, 11], [3, -38, 74, 30, 11], [13, -8, 70, 32, 14], [23, 26, 68, 33, 17],
  [25, 30, 72, 30, 17.5], [31, 12, 67, 27, 18], [37, -12, 63, 25, 18.5],
  [41, -36, 65, 26, 18], [45, -52, 69, 28, 17.5],
];
const vEase = (x) => x * x * (3 - 2 * x);
function vCam(t) {
  let i = 0;
  while (i < VKEYS.length - 2 && t > VKEYS[i + 1][0]) i++;
  const a = VKEYS[i], b = VKEYS[i + 1];
  const u = vEase(Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))));
  const L = (k) => a[k] + (b[k] - a[k]) * u;
  const ang = THREE.MathUtils.degToRad(L(1));
  return { pos: [Math.sin(ang) * L(2), L(3), Math.cos(ang) * L(2)], tgt: [0, L(4), 0] };
}
window.__qnVideo = {
  length: 45,
  start() {
    video = true;
    document.body.classList.add('video');
    Object.assign(state, { autoRotate: false, narr: false, playing: false, painting: false, mode: 'free', S: 0 });
    controls.enableDamping = false;
    syncUI();
  },
  frame(t) {
    G.uTime.value = t; G.uBoil.value = Math.floor(t * 5); G.uJit.value = 1.25;
    state.B = 100 * vEase(Math.max(0, Math.min(1, (t - 3) / 20)));
    state.paint = vEase(Math.max(0, Math.min(1, (t - 25) / 12)));
    const c = vCam(t);
    camera.position.set(...c.pos); controls.target.set(...c.tgt); controls.update();
    G.uColor.value = 0;
    applyBuild(model, state.B);
    real.setProgress(state.B >= 99.5 ? state.paint : 0);
    updateSection();
    renderer.render(scene, camera);
    const fade = (a, b, c2, d) => Math.max(0, Math.min(1, (t - a) / (b - a), (d - t) / (d - c2)));
    $('#vTitle').style.opacity = String(fade(0.2, 1.0, 2.4, 3.2));
    $('#vEnd').style.opacity = String(fade(40, 41.2, 99, 100));
  },
};
requestAnimationFrame(frame);
window.__qn = { state, camera, controls, model, flyTo, tweenSection, enterMode, gotoStep, exitMode, setPaint: (v) => { state.paint = v; } };
