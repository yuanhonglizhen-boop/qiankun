// 程序合成的古风配乐：古筝（主旋律、刮奏）、古琴（低音）、箫（长音）。D 宫五声音阶。
// 前 26 秒与铺砌动画同步，之后转为舒缓的随机散板。

const BPM = 72, BEAT = 60 / BPM;
const VOL = 1.7;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// D 宫：D E F# A B
const D3 = 50, E3 = 52, Fs3 = 54, A3 = 57, B3 = 59, D4 = 62, E4 = 64, Fs4 = 66, A4 = 69, B4 = 71, D5 = 74, E5 = 76, Fs5 = 78, A5 = 81, B5 = 83;
const A2 = 45, B2 = 47, D2 = 38, E2 = 40;
const SCALE = [D3, E3, Fs3, A3, B3, D4, E4, Fs4, A4, B4, D5, E5, Fs5, A5, B5];

// 旋律：[起拍, 音高, 时值(拍)]，拍从 0 计
const MELODY = [
  // 散起（起稿）
  [0.6, A4, 2], [2.4, D5, 2], [4.0, B4, 1],
  // 第一句（铺砌开始）
  [6, A4, 1], [7, B4, 0.5], [7.5, D5, 0.5], [8, B4, 1], [9, A4, 1],
  [10, Fs4, 1], [11, E4, 0.5], [11.5, Fs4, 0.5], [12, A4, 2],
  // 第二句
  [14, B4, 1], [15, A4, 0.5], [15.5, B4, 0.5], [16, D5, 1], [17, E5, 1],
  // 刮奏之后：高潮
  [19.5, Fs5, 1.5], [21, E5, 0.5], [21.5, D5, 1], [22.5, B4, 1],
  [23.5, D5, 1], [24.5, E5, 0.5], [25, D5, 0.5], [25.5, B4, 1], [26.5, A4, 1],
  // 收束
  [27.5, B4, 1], [28.5, A4, 1], [29.5, E4, 1], [30.5, D4, 3],
];
// 低音与分解和弦：每小节 [起拍, 根音, 和弦音]
const BASS = [
  [0, D2, []], [4, A2, []],
  [6, D3, [A3, D4, A3]], [8, B2, [Fs3, B3, Fs3]], [10, E3, [B3, E4, B3]], [12, A2, [E3, A3, E3]],
  [14, B2, [Fs3, B3, Fs3]], [16, E3, [B3, E4, B3]],
  [19.5, D3, [A3, D4, Fs4]], [21.5, B2, [Fs3, B3, D4]], [23.5, E3, [B3, E4, A3]], [25.5, A2, [E3, A3, E4]],
  [27.5, D2, [A2, D3, A3]], [30.5, D2, []],
];
const GLISS_AT = 17.6; // 拍，约 14.6 秒，金箔砖开始漫开
const FLUTE = [[19.5, A4, 4], [23.5, Fs4, 4], [27.5, D4, 6]];

export class Music {
  constructor() {
    this.ctx = null; this.on = true; this.sources = []; this.ambientTimer = null; this.cache = new Map();
  }
  init() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = VOL;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.dry = ctx.createGain(); this.dry.gain.value = 0.75; this.dry.connect(this.master);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(3.6, 2.4);
    const wet = ctx.createGain(); wet.gain.value = 0.42;
    this.verb.connect(wet).connect(this.master);
    this.bus = ctx.createGain(); this.bus.connect(this.dry); this.bus.connect(this.verb);
  }
  impulse(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1);
    }
    return b;
  }
  // Karplus–Strong 拨弦。bright 越大越亮（古筝），越小越闷（古琴）
  pluck(midi, bright, sec) {
    const key = `${midi}|${bright}|${sec}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const ctx = this.ctx, sr = ctx.sampleRate, f = mtof(midi);
    const n = Math.floor(sr * sec), out = ctx.createBuffer(1, n, sr), d = out.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f));
    const buf = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = prev + bright * (w - prev); buf[i] = prev; }
    const loss = 0.5 * (0.996 + 0.0035 * bright);
    let idx = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const cur = buf[idx];
      const nxt = buf[(idx + 1) % N];
      buf[idx] = (cur + nxt) * loss + (cur - last) * 0.0;
      last = cur;
      d[i] = cur;
      idx = (idx + 1) % N;
    }
    // 起音处加一点拨片噪声
    for (let i = 0; i < Math.min(n, 220); i++) d[i] += (Math.random() * 2 - 1) * 0.25 * (1 - i / 220) * bright;
    this.cache.set(key, out);
    return out;
  }
  playPluck(t, midi, { gain = 0.5, bright = 0.6, sec = 3.2, bend = 0, pan = 0 } = {}) {
    const ctx = this.ctx, src = ctx.createBufferSource();
    src.buffer = this.pluck(midi, bright, sec);
    if (bend) { src.playbackRate.setValueAtTime(1, t + 0.35); src.playbackRate.linearRampToValueAtTime(Math.pow(2, bend / 12), t + 0.6); }
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(g).connect(p).connect(this.bus);
    src.start(t);
    this.sources.push(src);
  }
  playFlute(t, midi, dur, gain = 0.09) {
    const ctx = this.ctx, f = mtof(midi);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sine'; o2.type = 'triangle';
    o1.frequency.value = f; o2.frequency.value = f * 2;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 4.8; lg.gain.value = f * 0.006;
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const g = ctx.createGain(), g2 = ctx.createGain();
    g2.gain.value = 0.18;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.5);
    g.gain.setValueAtTime(gain, t + dur - 0.6);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.4);
    // 气声
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    o1.connect(g); o2.connect(g2).connect(g); noise.connect(bp).connect(ng).connect(g);
    g.connect(this.bus);
    for (const s of [o1, o2, lfo, noise]) { s.start(t); s.stop(t + dur + 0.6); this.sources.push(s); }
  }
  // 与动画同步的主曲
  start() {
    this.init();
    this.stop();
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(this.on ? VOL : 0, ctx.currentTime);
    const t0 = ctx.currentTime + 0.1;
    for (const [b, m, len] of MELODY) {
      this.playPluck(t0 + b * BEAT, m, { gain: 0.55, bright: 0.72, sec: Math.max(2.2, len * BEAT + 1.6), bend: len >= 2 && m === A4 ? 2 : 0, pan: 0.15 });
    }
    for (const [b, root, chord] of BASS) {
      this.playPluck(t0 + b * BEAT, root, { gain: 0.6, bright: 0.25, sec: 4.5, pan: -0.2 });
      chord.forEach((m, k) => this.playPluck(t0 + (b + 0.5 + k * 0.5) * BEAT, m, { gain: 0.26, bright: 0.5, sec: 2.4, pan: -0.05 + k * 0.1 }));
    }
    // 刮奏：两个八度的五声音阶上行
    const g0 = t0 + GLISS_AT * BEAT;
    SCALE.forEach((m, k) => this.playPluck(g0 + k * 0.055, m, { gain: 0.22 + k * 0.012, bright: 0.8, sec: 2.6, pan: -0.5 + k / SCALE.length }));
    for (const [b, m, len] of FLUTE) this.playFlute(t0 + b * BEAT, m, len * BEAT);
    this.ambientFrom = t0 + 34 * BEAT;
    this.scheduleAmbient();
  }
  // 散板：每隔两三秒落一个五声音，偶尔两音相和
  scheduleAmbient() {
    clearInterval(this.ambientTimer);
    let next = this.ambientFrom;
    this.ambientTimer = setInterval(() => {
      const ctx = this.ctx;
      while (next < ctx.currentTime + 1.5) {
        const m = [D4, E4, Fs4, A4, B4, D5, E5, A4, D4][Math.floor(Math.random() * 9)];
        this.playPluck(next, m, { gain: 0.32, bright: 0.6, sec: 3.4, pan: Math.random() * 0.6 - 0.3 });
        if (Math.random() < 0.35) this.playPluck(next + 0.02, m - 12, { gain: 0.3, bright: 0.25, sec: 4.5, pan: -0.2 });
        next += BEAT * (2 + Math.floor(Math.random() * 3));
      }
      this.sources = this.sources.filter((s) => { try { return s.buffer ? s.buffer.duration + 1 > 0 : true; } catch { return false; } }).slice(-400);
    }, 400);
  }
  stop() {
    clearInterval(this.ambientTimer);
    for (const s of this.sources) { try { s.stop(); } catch { /* 已停止 */ } }
    this.sources = [];
  }
  setOn(on) {
    this.on = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? VOL : 0, t, 0.25);
    if (on && this.ctx.state === 'suspended') this.ctx.resume();
  }
}
