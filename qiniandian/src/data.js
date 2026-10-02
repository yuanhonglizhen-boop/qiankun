// 祈年殿数据。单位：米；y 轴向上，地面 y = 0；北为 -z，南为 +z，东为 +x。
// 有资料依据：台基三层共高 5.2 m，直径 68.2 / 79.3 / 90.3 m；殿高 31.6 m（连台基 36.8 m）；
// 龙井柱 4 根，高 19.2 m、直径 1.2 m；金柱 12 根；檐柱 12 根。其余尺寸为示意。

export const TIERS = [
  { r: 90.3 / 2, y0: 0, y1: 1.73 },
  { r: 79.3 / 2, y0: 1.73, y1: 3.47 },
  { r: 68.2 / 2, y0: 3.47, y1: 5.2 },
];
export const TOP = 5.2;          // 台基顶
export const FLOOR = 5.7;        // 殿内地面（台明顶，示意）
export const APEX = 36.8;        // 宝顶顶端

const deg = Math.PI / 180;
// 柱网：角度从 +x 轴起算，朝 +z（南）为 90°
export const COLUMNS = {
  dragon: { name: '龙井柱', n: 4, r: 3.9, a0: 45 * deg, d: 1.2, h: 19.2, top: FLOOR + 19.2 },
  gold: { name: '金柱', n: 12, r: 7.9, a0: 15 * deg, d: 0.86, h: 12.4, top: FLOOR + 12.4 },
  eave: { name: '檐柱', n: 12, r: 11.4, a0: 15 * deg, d: 0.62, h: 6.6, top: FLOOR + 6.6 },
};

export function colAngles(c) {
  return Array.from({ length: c.n }, (_, i) => c.a0 + i * 2 * Math.PI / c.n);
}

// 三重檐（示意）：lip 为檐口 (r, y)，top 为与上层鼓身相接处
export const ROOFS = [
  { name: '下檐', lip: [15.2, 13.1], top: [8.9, 15.7], bracketR: 11.4, bracketY: 12.3, n: 60 },
  { name: '中檐', lip: [11.8, 18.8], top: [6.5, 21.1], bracketR: 8.25, bracketY: 18.1, n: 48 },
  { name: '上檐', lip: [9.2, 25.6], top: [0.7, 33.2], bracketR: 6.1, bracketY: 24.9, n: 36 },
];
export const DRUMS = [
  { r: 8.6, y0: 15.6, y1: 18.1 },   // 中层鼓身（槛窗）
  { r: 6.3, y0: 21.0, y1: 24.9 },   // 上层鼓身
];

export const STAGES = [
  { at: 0, name: '三层台基' },
  { at: 8, name: '栏杆台阶' },
  { at: 14, name: '台明柱础' },
  { at: 17, name: '立龙井柱' },
  { at: 22, name: '立金柱' },
  { at: 28, name: '立檐柱' },
  { at: 33, name: '枋梁拉结' },
  { at: 40, name: '安斗拱' },
  { at: 47, name: '下檐' },
  { at: 55, name: '中层鼓身' },
  { at: 60, name: '中檐' },
  { at: 66, name: '上层鼓身' },
  { at: 71, name: '上檐' },
  { at: 78, name: '鎏金宝顶' },
  { at: 82, name: '天花藻井' },
  { at: 88, name: '槅扇门窗' },
  { at: 94, name: '着彩' },
  { at: 100, name: '竣工' },
];
export function stageName(p) {
  let s = STAGES[0].name;
  for (const st of STAGES) if (p >= st.at) s = st.name;
  return s;
}

// 注记（at：出现时的工程进度）
export const ANNOTATIONS = [
  { text: '祈谷坛', sub: '三层汉白玉台基，高 5.2 m', pos: [0, 3.4, 39.6], at: 8, off: [-130, 40] },
  { text: '台基直径', sub: '68.2 / 79.3 / 90.3 m', pos: [-34, 5.2, 0], at: 8, off: [-110, 30] },
  { text: '龙井柱 ×4', sub: '高 19.2 m · 直径 1.2 m', pos: [2.76, 16, 2.76], at: 22, off: [120, -80] },
  { text: '金柱 ×12', sub: '撑中檐', pos: [7.63, 12, 2.04], at: 28, off: [130, -40] },
  { text: '檐柱 ×12', sub: '撑下檐', pos: [11.0, 8, 2.95], at: 33, off: [130, 0] },
  { text: '斗拱', sub: '把屋檐的重量收到柱头', pos: [11.4, 12.7, 0], at: 47, off: [140, 30] },
  { text: '下檐', sub: '蓝琉璃瓦', pos: [13.3, 14, 0], at: 55, off: [140, 50] },
  { text: '中檐', sub: '蓝琉璃瓦', pos: [9.6, 19.7, 0], at: 66, off: [140, 20] },
  { text: '上檐', sub: '三重檐圆攒尖', pos: [6, 28.2, 0], at: 78, off: [140, -10] },
  { text: '鎏金宝顶', sub: '殿高 31.6 m，连台基 36.8 m', pos: [0, 35, 0], at: 82, off: [110, -40] },
  { text: '龙凤藻井', sub: '殿内正中，层层收进', pos: [0, 27, 0], at: 88, off: [-130, -40], inside: true },
  { text: '槅扇', sub: '十二间', pos: [0, 8, 11.4], at: 93, off: [-120, 30] },
  { text: '±0.00', sub: '地面', pos: [46, 0, 0], at: 0, off: [60, -10], red: true },
  { text: '+5.20', sub: '台基顶', pos: [34.5, 5.2, 0], at: 8, off: [70, -10], red: true },
];

// 数柱子
export const COUNT_STEPS = [
  { groups: ['dragon'], kicker: '4 根', title: '龙井柱 · 四季', text: '最里面一圈 4 根龙井柱，每根高 19.2 米、直径 1.2 米，象征春、夏、秋、冬四季。', names: ['春', '夏', '秋', '冬'] },
  { groups: ['gold'], kicker: '12 根', title: '金柱 · 十二个月', text: '中间一圈 12 根金柱，象征一年十二个月。', names: ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'] },
  { groups: ['eave'], kicker: '12 根', title: '檐柱 · 十二时辰', text: '最外一圈 12 根檐柱，象征一天十二个时辰。', names: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] },
  { groups: ['gold', 'eave'], kicker: '12 + 12 = 24', title: '二十四节气', text: '金柱和檐柱合起来 24 根，象征二十四节气。' },
  { groups: ['dragon', 'gold', 'eave'], kicker: '4 + 12 + 12 = 28', title: '二十八星宿', text: '三圈一共 28 根，象征天上的二十八星宿。一座殿，把四季、月份、时辰、节气和星空都装了进去。' },
];

// 不用大梁怎么立住
export const LOAD_STEPS = [
  { title: '屋顶的重量', text: '三重檐的琉璃瓦和木构很重。这些重量先顺着屋面落到檐下一圈圈的斗拱上。', show: 0.34, rings: false },
  { title: '斗拱收力', text: '斗拱一层层向外挑出，把屋檐的重量收拢到柱头和额枋上。', show: 0.6, rings: false },
  { title: '三圈柱子各管一层', text: '上檐压在龙井柱和童柱上，中檐压在金柱上，下檐压在檐柱上。每一圈只扛自己那一层。', show: 1, rings: false },
  { title: '枋和梁像箍桶', text: '三圈柱子之间用额枋连成环，再用梁从外往里拉住。整座殿像一只箍紧的木桶，不用横跨全殿的大梁，也不会散架。', show: 1, rings: true },
];

// 历史变迁
export const HISTORY = [
  { kicker: '1420 · 永乐十八年', title: '大祀殿', text: '明成祖在这里建大祀殿，是一座长方形大殿，天地合祀。这座殿今天已经不在了。', B: 14, tiers: null },
  { kicker: '1545 · 嘉靖二十四年', title: '大享殿', text: '大祀殿改建成三重檐圆殿，屋顶琉璃瓦上青、中黄、下绿，取名"大享殿"。', B: 100, tiers: ['#3f7d52', '#d1a43c', '#2d5596'] },
  { kicker: '1751 · 乾隆十六年', title: '祈年殿', text: '三色瓦统一换成蓝瓦金顶，大享殿改名"祈年殿"，象征蓝天。', B: 100, tiers: ['#2d5596', '#2d5596', '#2d5596'] },
  { kicker: '1889 · 光绪十五年八月二十四日', title: '雷火', text: '大殿遭雷击起火，整座焚毁，只剩台基。', B: 14, anim: true, tiers: ['#2d5596', '#2d5596', '#2d5596'] },
  { kicker: '1890—1896 · 光绪二十二年完工', title: '按原样重建', text: '次年动工，按原来的形制重建，历时 6 年完工。今天看到的就是这一次重建的祈年殿。', B: 100, anim: true, tiers: ['#2d5596', '#2d5596', '#2d5596'] },
];
