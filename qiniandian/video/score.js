// 祈年殿演示视频配乐（45 秒）。复用 qianli/src/music.js 的古筝、古琴、箫音色，D 宫五声音阶，72 拍/分。
// 结构与画面对应：0–3 秒片头散起；3–23 秒线描，旋律渐密；25 秒上色开始，古筝刮奏；37 秒后收束。
const BEAT = 60 / 72;
const D2 = 38, A2 = 45, B2 = 47, D3 = 50, E3 = 52, Fs3 = 54, A3 = 57, B3 = 59;
const D4 = 62, E4 = 64, Fs4 = 66, A4 = 69, B4 = 71, D5 = 74, E5 = 76, Fs5 = 78, A5 = 81, B5 = 83;
const SCALE = [D3, E3, Fs3, A3, B3, D4, E4, Fs4, A4, B4, D5, E5, Fs5, A5, B5];
const s2b = (sec) => sec / BEAT;

// [起始秒, 音高, 时值拍]
export const MELODY = [
  [0.5, A4, 2], [1.9, D5, 2],
  // 线描：两句旋律
  [3.4, A4, 1], [4.2, B4, 0.5], [4.6, D5, 0.5], [5.0, B4, 1], [5.8, A4, 1],
  [6.7, Fs4, 1], [7.5, E4, 0.5], [7.9, Fs4, 0.5], [8.3, A4, 2],
  [10.0, B4, 1], [10.8, A4, 0.5], [11.2, B4, 0.5], [11.6, D5, 1], [12.4, E5, 1],
  [13.4, D5, 1], [14.2, B4, 0.5], [14.6, A4, 0.5], [15.0, B4, 2],
  [16.8, A4, 1], [17.6, B4, 0.5], [18.0, D5, 0.5], [18.4, E5, 1], [19.2, D5, 1],
  [20.0, B4, 1], [20.8, A4, 1], [21.6, E4, 1], [22.4, D4, 2.5],
  // 上色：高潮
  [25.9, Fs5, 1.5], [27.1, E5, 0.5], [27.5, D5, 1], [28.3, B4, 1],
  [29.1, D5, 1], [29.9, E5, 0.5], [30.3, D5, 0.5], [30.7, B4, 1], [31.5, A4, 1],
  [32.4, B4, 1], [33.2, D5, 1], [34.0, E5, 1], [34.8, Fs5, 2],
  [36.4, A5, 1.5], [37.6, Fs5, 0.5], [38.0, E5, 1], [38.8, D5, 1],
  // 收束
  [39.8, B4, 1], [40.6, A4, 1], [41.4, E4, 1], [42.2, D4, 3],
];
export const BASS = [
  [0, D2, []], [3.3, D3, [A3, D4, A3]], [6.6, B2, [Fs3, B3, Fs3]], [9.9, E3, [B3, E4, B3]],
  [13.2, A2, [E3, A3, E3]], [16.5, B2, [Fs3, B3, Fs3]], [19.8, E3, [B3, E4, A3]], [22.4, D3, [A3, D4]],
  [25.9, D3, [A3, D4, Fs4]], [28.3, B2, [Fs3, B3, D4]], [30.7, E3, [B3, E4, A3]], [33.2, A2, [E3, A3, E4]],
  [35.6, D3, [A3, D4, Fs4]], [38.0, B2, [Fs3, B3, D4]], [40.6, A2, [E3, A3]], [42.2, D2, [A2, D3]],
];
export const FLUTE = [[25.9, A4, 4], [29.1, Fs4, 4], [32.4, A4, 4], [35.6, D5, 4], [39.0, A4, 3], [42.2, D4, 4]];
export const GLISS = 25.0;

export function schedule(m, t0) {
  for (const [sec, n, len] of MELODY) m.playPluck(t0 + sec, n, { gain: 0.55, bright: 0.72, sec: Math.max(2.2, len * BEAT + 1.6), bend: len >= 2 && n === A4 ? 2 : 0, pan: 0.15 });
  for (const [sec, root, chord] of BASS) {
    m.playPluck(t0 + sec, root, { gain: 0.6, bright: 0.25, sec: 4.5, pan: -0.2 });
    chord.forEach((n, k) => m.playPluck(t0 + sec + (0.5 + k * 0.5) * BEAT, n, { gain: 0.26, bright: 0.5, sec: 2.4, pan: -0.05 + k * 0.1 }));
  }
  SCALE.forEach((n, k) => m.playPluck(t0 + GLISS + k * 0.055, n, { gain: 0.22 + k * 0.012, bright: 0.8, sec: 2.6, pan: -0.5 + k / SCALE.length }));
  for (const [sec, n, len] of FLUTE) m.playFlute(t0 + sec, n, len * BEAT);
}
void s2b;
