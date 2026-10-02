// 把一张图分析成镶嵌砖的排布：沿轮廓线一圈圈铺砌（andamento），并给每块砖定色、定材质、定出场顺序。
// 全部在浏览器里完成，不依赖外部库。

export function analyse(img, { cell = 2, tile = 11 } = {}) {
  // 分析网格：每格对应原图 cell×cell 像素
  const N = Math.round(img.naturalWidth / cell), M = Math.round(img.naturalHeight / cell);
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = M;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, N, M);
  const px = ctx.getImageData(0, 0, N, M).data;
  const R = new Float32Array(N * M), Gc = new Float32Array(N * M), B = new Float32Array(N * M), L = new Float32Array(N * M);
  for (let i = 0; i < N * M; i++) {
    R[i] = px[i * 4] / 255; Gc[i] = px[i * 4 + 1] / 255; B[i] = px[i * 4 + 2] / 255;
    L[i] = 0.3 * R[i] + 0.59 * Gc[i] + 0.11 * B[i];
  }
  const s = tile / cell; // 砖的间距（以分析格计）

  // 1. 轮廓：三通道 Sobel（先模糊，压掉绢丝纹理）
  const blurR = blur(R, N, M, 2), blurG = blur(Gc, N, M, 2), blurB = blur(B, N, M, 2);
  const E = new Float32Array(N * M);
  for (let y = 1; y < M - 1; y++) for (let x = 1; x < N - 1; x++) {
    let e = 0;
    for (const C of [blurR, blurG, blurB]) {
      const i = y * N + x;
      const gx = C[i - N + 1] + 2 * C[i + 1] + C[i + N + 1] - C[i - N - 1] - 2 * C[i - 1] - C[i + N - 1];
      const gy = C[i + N - 1] + 2 * C[i + N] + C[i + N + 1] - C[i - N - 1] - 2 * C[i - N] - C[i - N + 1];
      e += Math.hypot(gx, gy);
    }
    E[y * N + x] = e;
  }

  // 2. 天空（绢地）：取上方一条的颜色，从上沿洪泛，碰到山的轮廓就停
  const silk = meanColor(blurR, blurG, blurB, N, M, 0, Math.round(M * 0.05), N, Math.round(M * 0.14));
  const near = (i) => Math.abs(blurR[i] - silk[0]) + Math.abs(blurG[i] - silk[1]) + Math.abs(blurB[i] - silk[2]) < 0.24;
  const barrier = quantile(E, 0.8);
  const sky = new Uint8Array(N * M), stack = [];
  for (let y = 0; y < Math.round(M * 0.14); y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (near(i)) { sky[i] = 1; stack.push(i); } }
  while (stack.length) {
    const i = stack.pop(), x = i % N, y = (i / N) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < M - 1 ? i + N : -1]) {
      if (j < 0 || sky[j] || E[j] > barrier || !near(j)) continue;
      sky[j] = 1; stack.push(j);
    }
  }
  const skyS = blur(Float32Array.from(sky), N, M, 3);

  // 3. 轮廓 = 山体内部的强边 + 天空与山的分界；天空内部不算轮廓
  const thr = quantile(E, 0.88), strong = quantile(E, 0.95);
  const edge = new Uint8Array(N * M), sketch = new Uint8Array(N * M);
  for (let y = 1; y < M - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x;
    const inSky = skyS[i] > 0.5;
    const rim = (skyS[i] > 0.5) !== (skyS[i + 1] > 0.5) || (skyS[i] > 0.5) !== (skyS[i + N] > 0.5);
    if (rim || (!inSky && E[i] > thr)) edge[i] = 1;
    if (rim || (!inSky && E[i] > strong)) sketch[i] = 1;
  }
  const D = new Float32Array(N * M);
  for (let i = 0; i < N * M; i++) D[i] = edge[i] ? 0 : 1e6;
  for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x; let d = D[i];
    if (x > 0) d = Math.min(d, D[i - 1] + 3);
    if (y > 0) { d = Math.min(d, D[i - N] + 3); if (x > 0) d = Math.min(d, D[i - N - 1] + 4); if (x < N - 1) d = Math.min(d, D[i - N + 1] + 4); }
    D[i] = d;
  }
  for (let y = M - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) {
    const i = y * N + x; let d = D[i];
    if (x < N - 1) d = Math.min(d, D[i + 1] + 3);
    if (y < M - 1) { d = Math.min(d, D[i + N] + 3); if (x < N - 1) d = Math.min(d, D[i + N + 1] + 4); if (x > 0) d = Math.min(d, D[i + N - 1] + 4); }
    D[i] = d;
  }
  for (let i = 0; i < N * M; i++) D[i] /= 3;
  const Ds = blur(D, N, M, 2);

  // 4. 铺砌：先沿等距线放砖（轮廓优先），再补空
  const tiles = [];
  const hashS = s, HN = Math.ceil(N / hashS) + 1, HM = Math.ceil(M / hashS) + 1;
  const grid = Array.from({ length: HN * HM }, () => []);
  const tryPlace = (x, y, minD) => {
    const gx = (x / hashS) | 0, gy = (y / hashS) | 0;
    for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
      if (i < 0 || j < 0 || i >= HN || j >= HM) continue;
      for (const t of grid[j * HN + i]) if ((t.x - x) ** 2 + (t.y - y) ** 2 < minD * minD) return false;
    }
    const t = { x, y };
    grid[gy * HN + gx].push(t);
    tiles.push(t);
    return true;
  };
  const cand = [];
  for (let y = 1; y < M - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x, f = (Ds[i] / s) % 1;
    if (Math.abs(f - 0.5) < 0.12) cand.push(i);
  }
  cand.sort((a, b) => Ds[a] - Ds[b]);
  for (const i of cand) tryPlace(i % N + 0.5, ((i / N) | 0) + 0.5, s * 0.86);
  const rnd = mulberry(7);
  const fill = [];
  for (let y = 0.5; y < M; y += 1) for (let x = 0.5; x < N; x += 1) fill.push([x + (rnd() - 0.5) * 0.9, y + (rnd() - 0.5) * 0.9]);
  shuffle(fill, rnd);
  for (const [x, y] of fill) tryPlace(x, y, s * 0.9);

  // 5. 每块砖：方向、颜色、材质
  const out = [];
  for (const t of tiles) {
    const x = Math.min(N - 2, Math.max(1, t.x | 0)), y = Math.min(M - 2, Math.max(1, t.y | 0)), i = y * N + x;
    const gx = Ds[i + 1] - Ds[i - 1], gy = Ds[i + N] - Ds[i - N];
    const ang = Math.atan2(gy, gx);
    const rr = Math.max(1, Math.round(s * 0.45));
    const c = meanColor(R, Gc, B, N, M, x - rr, y - rr, x + rr + 1, y + rr + 1);
    const dSilk = Math.abs(c[0] - silk[0]) + Math.abs(c[1] - silk[1]) + Math.abs(c[2] - silk[2]);
    const isSky = skyS[i] > 0.55 || (dSilk < 0.17 && E[i] < barrier * 0.8 && t.y < M * 0.68);
    const [h, sat, lum] = hsl(c);
    let cls = 'stone';
    if (isSky) cls = 'gold';
    else if (sat > 0.18 && h > 175 && h < 255) cls = 'glass';
    else if (sat > 0.14 && h > 70 && h < 175) cls = 'glass';
    out.push({ u: t.x / N, v: t.y / M, ang, c, cls, d: Ds[i] / s, lum });
  }

  // 6. 调色板：每类材质各自聚成有限几种颜色，像真正的砖料
  for (const [cls, k] of [['gold', 6], ['glass', 16], ['stone', 14]]) {
    const list = out.filter((t) => t.cls === cls);
    if (!list.length) continue;
    const pal = kmeans(list.map((t) => t.c), k, 8);
    for (const t of list) t.c = pal[nearest(pal, t.c)];
  }

  // 7. 出场顺序：先按卷轴方向（自右向左）铺山石，轮廓先于填充；金地最后从主峰向四周漫开
  const peak = { u: 0.5, v: 0.05 };
  let maxR = 0;
  for (const t of out) if (t.cls === 'gold') maxR = Math.max(maxR, Math.hypot((t.u - peak.u) * 1.9, t.v - peak.v));
  for (const t of out) {
    const j = (rnd() - 0.5) * 0.02;
    if (t.cls === 'gold') t.order = 0.62 + 0.36 * Math.hypot((t.u - peak.u) * 1.9, t.v - peak.v) / (maxR || 1) + j;
    else t.order = 0.66 * (1 - t.u) * 0.85 + 0.66 * 0.15 * Math.min(1, t.d / 5) + j;
  }

  return { tiles: out, aspect: M / N, edge: sketch, N, M, sky };
}

// ---------- 工具 ----------
function blur(src, N, M, r) {
  const tmp = new Float32Array(N * M), out = new Float32Array(N * M), w = 2 * r + 1;
  for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
    let s = 0; for (let k = -r; k <= r; k++) s += src[y * N + Math.min(N - 1, Math.max(0, x + k))];
    tmp[y * N + x] = s / w;
  }
  for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
    let s = 0; for (let k = -r; k <= r; k++) s += tmp[Math.min(M - 1, Math.max(0, y + k)) * N + x];
    out[y * N + x] = s / w;
  }
  return out;
}
function quantile(arr, q) {
  const step = Math.max(1, Math.floor(arr.length / 20000));
  const s = []; for (let i = 0; i < arr.length; i += step) s.push(arr[i]);
  s.sort((a, b) => a - b);
  return s[Math.floor(q * (s.length - 1))];
}
function meanColor(R, G, B, N, M, x0, y0, x1, y1) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.max(0, y0); y < Math.min(M, y1); y++) for (let x = Math.max(0, x0); x < Math.min(N, x1); x++) {
    const i = y * N + x; r += R[i]; g += G[i]; b += B[i]; n++;
  }
  return [r / n, g / n, b / n];
}
function hsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-5) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function kmeans(pts, k, iters) {
  const rnd = mulberry(3);
  let cent = Array.from({ length: k }, () => pts[Math.floor(rnd() * pts.length)].slice());
  for (let it = 0; it < iters; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    for (const p of pts) { const j = nearest(cent, p); sum[j][0] += p[0]; sum[j][1] += p[1]; sum[j][2] += p[2]; sum[j][3]++; }
    cent = cent.map((c, j) => (sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c));
  }
  return cent;
}
function nearest(cent, p) {
  let best = 0, bd = 1e9;
  for (let j = 0; j < cent.length; j++) {
    const d = (cent[j][0] - p[0]) ** 2 + (cent[j][1] - p[1]) ** 2 + (cent[j][2] - p[2]) ** 2;
    if (d < bd) { bd = d; best = j; }
  }
  return best;
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
