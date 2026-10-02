import * as THREE from 'three';

// 全局共享 uniform：纸色、墨色、光照、时间、着彩程度等
export const G = {
  uPaper: { value: new THREE.Color('#ecebe6') },
  uInk: { value: new THREE.Color('#2b2d31') },
  uRed: { value: new THREE.Color('#b8463a') },
  uLight: { value: new THREE.Vector3(0.55, 0.78, 0.32).normalize() },
  uTime: { value: 0 },
  uBoil: { value: 0 },
  uJit: { value: 1.0 },
  uColor: { value: 0 },
  uDPR: { value: 1 },
  uRes: { value: new THREE.Vector2(1, 1) },
  uFocal: { value: 800 },
  uDark: { value: 0 },
};

// 两套剖切：殿身用一张竖直面；夯土与地上部分用"挖槽"（两面相交才剔除）
export const clipPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e5)];
export const clipEarth = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e5)];

function applyClip(m, opts) {
  if (opts.noClip) m.clippingPlanes = null;
  else if (opts.clip === 'earth') m.clippingPlanes = clipEarth;
  else m.clippingPlanes = clipPlanes;
}

const NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash11(float p){ p=fract(p*.1031); p*=p+33.33; p*=p+p; return fract(p); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y); }
`;

// 生长 / 落块的公共顶点逻辑
const BUILD_VERT = /* glsl */ `
attribute float aT;
uniform float uProg;
uniform float uMode;   // 0 自下而上生长；1 逐块落位；2 整体淡入
uniform float uDrop;
varying vec3 vW;
varying float vFade;
vec4 buildWorld(vec3 p, out bool hidden){
  vec4 wp = modelMatrix * vec4(p, 1.0);
  hidden = uProg <= 0.0001;
  vFade = 1.0;
  if (uMode > 0.5 && uMode < 1.5) {
    float k = clamp((uProg - aT * 0.82) / 0.18, 0.0, 1.0);
    if (k <= 0.0) hidden = true;
    float e = 1.0 - k;
    wp.y += e * e * uDrop;
  } else if (uMode > 1.5) {
    vFade = uProg;
  }
  return wp;
}
`;

const meshVert = /* glsl */ `
#include <common>
#include <clipping_planes_pars_vertex>
${BUILD_VERT}
varying vec3 vN;
void main(){
  bool hidden;
  vec4 wp = buildWorld(position, hidden);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  if (hidden) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
  #include <clipping_planes_vertex>
}
`;

const meshFrag = /* glsl */ `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uPaper, uInk, uTint, uLight;
uniform float uColor, uDPR, uKind, uGrowY, uMode, uInkAmt, uDark, uProg;
varying vec3 vW; varying vec3 vN; varying float vFade;
${NOISE}
float hatch(vec2 p, float ang, float sp, float w, float seed){
  float c = cos(ang), s = sin(ang);
  vec2 q = vec2(c*p.x + s*p.y, -s*p.x + c*p.y);
  float row = floor(q.y / sp);
  float wav = (vnoise(vec2(q.x*0.012, row*3.1 + seed)) - 0.5) * sp * 0.45;
  float d = abs(fract((q.y + wav) / sp) - 0.5) * sp;
  float ww = w * (0.55 + 0.9 * vnoise(vec2(q.x*0.045 + seed, row*1.7)));
  float line = 1.0 - smoothstep(ww, ww + 0.85, d);
  float gaps = smoothstep(0.16, 0.34, vnoise(vec2(q.x*0.022 + row*13.7, seed*5.0)));
  return line * gaps;
}
void main(){
  #include <clipping_planes_fragment>
  if (uMode < 0.5 && vW.y > uGrowY) discard;
  vec2 sp = gl_FragCoord.xy / uDPR;
  float grain = vnoise(sp*0.85)*0.5 + vnoise(sp*0.21)*0.5;
  vec3 paper = uPaper;
  if (!gl_FrontFacing) {
    // 剖切面：石材用密斜线，夯土用点与疏线
    float ink;
    if (uKind > 0.5) {
      float dots = smoothstep(0.82, 0.95, vnoise(sp * 0.55)) * smoothstep(0.3, 0.7, vnoise(sp * 0.05 + 3.0));
      ink = max(hatch(sp, 0.785, 9.0, 0.4, 9.0) * 0.35, dots * 0.45);
      vec3 base = mix(paper, mix(paper, uTint, 0.5), 0.3 + 0.7*uColor);
      gl_FragColor = vec4(mix(base, uInk, ink * 0.6), 1.0);
    } else {
      ink = hatch(sp, 0.785, 3.4, 0.5, 4.0);
      vec3 base = mix(paper, uInk, 0.10);
      base = mix(base, mix(paper, uTint, 0.6) * 0.82, uColor);
      gl_FragColor = vec4(mix(base, uInk, ink * 0.8), 1.0);
    }
    return;
  }
  vec3 n = normalize(vN);
  float diff = max(dot(n, uLight), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  float light = 0.16 + 0.56 * diff + 0.28 * hemi;
  float tone = 1.0 - light + (grain - 0.5) * 0.12;
  vec3 an = abs(n);
  float ang = an.y > max(an.x, an.z) ? 0.52 : (an.x > an.z ? 1.05 : 2.15);
  float h = 0.0;
  h = max(h, hatch(sp, ang, 5.6, 0.55, 1.0) * smoothstep(0.30, 0.42, tone));
  h = max(h, hatch(sp, ang + 1.22, 5.6, 0.5, 2.0) * smoothstep(0.47, 0.60, tone));
  h = max(h, hatch(sp, ang - 0.6, 3.7, 0.45, 3.0) * smoothstep(0.62, 0.76, tone));
  float ink = h * (0.62 - 0.28 * uColor) * uInkAmt;
  ink += (1.0 - grain) * 0.035;
  float wash = 0.74 * (0.86 + 0.32 * (vnoise(sp * 0.018 + vW.xz * 0.05) - 0.5));
  vec3 tinted = mix(paper, uTint, wash) * (0.74 + 0.30 * light);
  vec3 base = mix(paper, tinted, uColor);
  vec3 col = mix(base, uInk, clamp(ink, 0.0, 1.0));
  col = mix(paper, col, vFade);
  gl_FragColor = vec4(col, 1.0);
}
`;

const lineVert = /* glsl */ `
#include <common>
#include <clipping_planes_pars_vertex>
${BUILD_VERT}
attribute float aSeed;
uniform float uBoil, uJit, uDetail, uFocal;
uniform vec2 uRes;
varying float vDet;
${NOISE}
void main(){
  bool hidden;
  vec4 wp = buildWorld(position, hidden);
  vW = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  float px = uDetail * uFocal / max(0.1, -mvPosition.z);
  vDet = smoothstep(7.0, 24.0, px) * (fract(aSeed * 0.5) > 0.5 ? smoothstep(18.0, 46.0, px) : 1.0);
  vec2 o = vec2(hash11(aSeed * 7.13 + uBoil * 1.37), hash11(aSeed * 3.91 + uBoil * 2.11)) - 0.5;
  gl_Position.xy += o * 2.0 * uJit * 2.0 / uRes * gl_Position.w;
  gl_Position.z -= 0.0006 * gl_Position.w;
  if (hidden) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
  #include <clipping_planes_vertex>
}
`;

const lineFrag = /* glsl */ `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uInk, uLineColor;
uniform float uColor, uGrowY, uMode, uAlpha, uUseRed;
varying vec3 vW; varying float vFade; varying float vDet;
void main(){
  #include <clipping_planes_fragment>
  if (uMode < 0.5 && vW.y > uGrowY) discard;
  if (vDet < 0.01) discard;
  vec3 c = mix(uInk, uLineColor, uUseRed);
  float a = uAlpha * vFade * vDet * (1.0 - 0.3 * uColor * (1.0 - uUseRed));
  gl_FragColor = vec4(c, a);
}
`;

// 每个构件一份本地 uniform（进度、生长高度），其余引用全局
export function makeLocal(opts = {}) {
  return {
    uProg: { value: 0 },
    uMode: { value: opts.mode ?? 0 },
    uDrop: { value: opts.drop ?? 3 },
    uGrowY: { value: 1e4 },
  };
}

export function hatchMaterial(local, opts = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...local,
      uPaper: G.uPaper, uInk: G.uInk, uLight: G.uLight, uColor: G.uColor, uDPR: G.uDPR, uDark: G.uDark,
      uTint: { value: new THREE.Color(opts.tint ?? '#b9b4a6') },
      uKind: { value: opts.kind ?? 0 },
      uInkAmt: { value: opts.inkAmt ?? 1 },
    },
    vertexShader: meshVert,
    fragmentShader: meshFrag,
    side: THREE.DoubleSide,
    clipping: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  applyClip(m, opts);
  return m;
}

export function lineMaterial(local, opts = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...local,
      uInk: G.uInk, uColor: G.uColor, uBoil: G.uBoil, uJit: G.uJit, uRes: G.uRes, uFocal: G.uFocal,
      uDetail: { value: opts.detail ?? 200 },
      uLineColor: { value: G.uRed.value },
      uUseRed: { value: opts.red ? 1 : 0 },
      uAlpha: { value: opts.alpha ?? 0.82 },
    },
    vertexShader: lineVert,
    fragmentShader: lineFrag,
    transparent: true,
    depthWrite: false,
    clipping: true,
  });
  applyClip(m, opts);
  return m;
}
