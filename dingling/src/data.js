// 定陵玄宫数据。坐标单位：米。y 轴向上，地面 y = 0；北为 -z，东为 +x。
// 有公开资料依据的尺寸写在注释里；地上部分与隧道走向为示意。

export const Y0 = -27; // 地宫地面标高（地下约 27 m）
export const C = { x: 0, z: -60 }; // 宝顶中心（示意）
export const R = 108; // 宝城外半径（示意）
export const WALL_T = 1.0; // 石券墙厚（示意）

// 殿与券洞。axis 'z'：自 zStart 向北延伸 len；axis 'x'：自 xStart 向东延伸 len。
// openings：墙上的门洞，side 为局部 u 方向（见 builders.js），w 为沿轴向的中心位置。
export const HALLS = [
  { id: 'tunnelVault', name: '隧道券', axis: 'z', cx: 0, zStart: -1.6, len: 6.4, W: 4, H: 5.5, T: 1.0 },
  // 前殿：长 20、宽 6、高 7.2 m
  { id: 'front', name: '前殿', axis: 'z', cx: 0, zStart: -10, len: 20, W: 6, H: 7.2, T: 1.0 },
  // 中殿：宽 6、高 7.2 m；与前殿合计长约 58 m（含门券）
  { id: 'middle', name: '中殿', axis: 'z', cx: 0, zStart: -33, len: 32, W: 6, H: 7.2, T: 1.0,
    openings: [ { side: -1, w: 18, width: 2.6, h: 3.6 }, { side: 1, w: 18, width: 2.6, h: 3.6 } ] },
  // 后殿（玄堂）：长 30.1、宽 9.1、高 9.5 m，横置于中轴北端
  { id: 'rear', name: '后殿', axis: 'x', cz: -72.55, xStart: -15.05, len: 30.1, W: 9.1, H: 9.5, T: 1.0,
    openings: [ { side: -1, w: 15.05, width: 3.8, h: 4.9 }, { side: -1, w: 28.05, width: 2.6, h: 3.6 }, { side: -1, w: 2.05, width: 2.6, h: 3.6 } ] },
  // 左右配殿：长 26、宽 6、高 7.1 m（左 = 东）
  { id: 'sideE', name: '左配殿', axis: 'z', cx: 13, zStart: -38, len: 26, W: 6, H: 7.1, T: 1.0,
    openings: [ { side: 1, w: 13, width: 2.6, h: 3.6 } ] },
  { id: 'sideW', name: '右配殿', axis: 'z', cx: -13, zStart: -38, len: 26, W: 6, H: 7.1, T: 1.0,
    openings: [ { side: -1, w: 13, width: 2.6, h: 3.6 } ] },
  // 甬道（示意尺寸）
  { id: 'passE', name: '东甬道', axis: 'x', cz: -51, xStart: 4, len: 5, W: 2.4, H: 3.6, T: 0.8 },
  { id: 'passW', name: '西甬道', axis: 'x', cz: -51, xStart: -9, len: 5, W: 2.4, H: 3.6, T: 0.8 },
  { id: 'passNE', name: '东北甬道', axis: 'z', cx: 13, zStart: -65, len: 2, W: 2.4, H: 3.6, T: 0.8 },
  { id: 'passNW', name: '西北甬道', axis: 'z', cx: -13, zStart: -65, len: 2, W: 2.4, H: 3.6, T: 0.8 },
];

// 券门墙 / 端墙（挤出体）。profile 指外轮廓所依的殿；hole 为门洞（宽、直墙高）。
export const END_WALLS = [
  { id: 'dw1', axis: 'z', cx: 0, zStart: -8, thick: 2, profile: { W: 6, H: 7.2, T: 1 }, hole: { w: 3.6, h: 3.3 } },
  { id: 'dw2', axis: 'z', cx: 0, zStart: -30, thick: 3, profile: { W: 6, H: 7.2, T: 1 }, hole: { w: 3.6, h: 3.3 } },
  { id: 'dw3', axis: 'z', cx: 0, zStart: -65, thick: 2, profile: { W: 6, H: 7.2, T: 1 }, hole: { w: 3.6, h: 3.3 } },
  { id: 'sideE_s', axis: 'z', cx: 13, zStart: -37, thick: 1, profile: { W: 6, H: 7.1, T: 1 } },
  { id: 'sideW_s', axis: 'z', cx: -13, zStart: -37, thick: 1, profile: { W: 6, H: 7.1, T: 1 } },
  { id: 'sideE_n', axis: 'z', cx: 13, zStart: -64, thick: 1, profile: { W: 6, H: 7.1, T: 1 }, hole: { w: 2.4, h: 2.4 } },
  { id: 'sideW_n', axis: 'z', cx: -13, zStart: -64, thick: 1, profile: { W: 6, H: 7.1, T: 1 }, hole: { w: 2.4, h: 2.4 } },
  { id: 'rear_w', axis: 'x', cz: -72.55, xStart: -16.05, thick: 1, profile: { W: 9.1, H: 9.5, T: 1 } },
  { id: 'rear_e', axis: 'x', cz: -72.55, xStart: 15.05, thick: 1, profile: { W: 9.1, H: 9.5, T: 1 } },
];

// 七道石门。c：门扇背面中线（地面高度），n：开门方向（朝门内），leaf：单扇宽、高、厚。
// 中轴三道：每扇高 3.3、宽 1.7 m，约 4 t。closeAt：工程进度中关门的时刻。
export const DOORS = [
  { id: 1, name: '第一道石门', c: [0, -10], n: [0, -1], leaf: [1.7, 3.3, 0.3], studs: true, closeAt: 0.92 },
  { id: 2, name: '前殿—中殿石门', c: [0, -33], n: [0, -1], leaf: [1.7, 3.3, 0.3], studs: true, closeAt: 0.78 },
  { id: 3, name: '中殿—后殿石门', c: [0, -68], n: [0, -1], leaf: [1.7, 3.3, 0.3], studs: true, closeAt: 0.06 },
  { id: 4, name: '东甬道石门', c: [10, -51], n: [1, 0], leaf: [1.1, 2.4, 0.22], studs: false, closeAt: 0.5 },
  { id: 5, name: '西甬道石门', c: [-10, -51], n: [-1, 0], leaf: [1.1, 2.4, 0.22], studs: false, closeAt: 0.64 },
  { id: 6, name: '东配殿—后殿石门', c: [13, -68], n: [0, -1], leaf: [1.1, 2.4, 0.22], studs: false, closeAt: 0.22 },
  { id: 7, name: '西配殿—后殿石门', c: [-13, -68], n: [0, -1], leaf: [1.1, 2.4, 0.22], studs: false, closeAt: 0.36 },
];

// 金刚墙：高 8.8 m、厚 1.6 m；下部 4 层条石，上部 56 层城砖
export const DIAMOND_WALL = { x0: -6, x1: 6, z0: 0, z1: -1.6, h: 8.8, stoneRows: 4, brickRows: 56 };

// 石隧道约 40 m；砖隧道两墙相距约 8 m，由宝城内侧的"隧道门"弯曲而下（走向示意）
export const STONE_TUNNEL = { z0: 0, z1: 40, halfW: 4, yA: Y0, yB: -14, wallH: 6 };
export const BRICK_TUNNEL = { start: [0, 40], ctrl: [-16, 50], end: [-38, 36.8], halfW: 4, yA: -14, yB: -3, wallH: 3 };
export const GUIDE_STONE = { pos: [-8.6, -11.2, 44.6] }; // 指路石，位置示意

// 工程阶段（百分比）
export const STAGES = [
  { at: 0, name: '开挖基坑' },
  { at: 8, name: '铺墁金砖' },
  { at: 15, name: '砌筑石券' },
  { at: 40, name: '安装石门' },
  { at: 48, name: '陈设入殿' },
  { at: 55, name: '关门落自来石' },
  { at: 61, name: '砌金刚墙' },
  { at: 67, name: '石隧道与砖隧道' },
  { at: 75, name: '回填夯土' },
  { at: 85, name: '宝城 · 宝顶 · 明楼' },
  { at: 94, name: '着彩' },
  { at: 100, name: '竣工' },
];

export function stageName(p) {
  let s = STAGES[0].name;
  for (const st of STAGES) if (p >= st.at) s = st.name;
  return s;
}

// 注记：at 为出现时的工程进度
export const ANNOTATIONS = [
  { text: '后殿（玄堂）', sub: '长 30.1 · 宽 9.1 · 高 9.5 m', pos: [-6, -18.5, -72.5], at: 36, off: [-150, -70] },
  { text: '中殿', sub: '宽 6 · 高 7.2 m', pos: [0, -20.5, -46], at: 30, off: [-120, -60] },
  { text: '前殿', sub: '长 20 · 宽 6 · 高 7.2 m', pos: [0, -20.5, -20], at: 26, off: [-120, -70] },
  { text: '左配殿', sub: '长 26 · 宽 6 · 高 7.1 m', pos: [13, -20.6, -44], at: 38, off: [90, -60] },
  { text: '右配殿', sub: '空棺床一座', pos: [-13, -20.6, -44], at: 38, off: [-100, -40] },
  { text: '汉白玉石门', sub: '每扇高 3.3 · 宽 1.7 m，约 4 t', pos: [0.8, -25.2, -33.2], at: 44, off: [110, 40] },
  { text: '自来石', sub: '门后斜撑，长约 1.6 m', pos: [0, -25.9, -33.6], at: 58, off: [120, 90] },
  { text: '宝座', sub: '汉白玉，帝一后二', pos: [0, -25.6, -61.6], at: 52, off: [100, -50] },
  { text: '青花云龙缸', sub: '长明灯', pos: [0, -26.4, -57.6], at: 52, off: [120, 30] },
  { text: '棺床 · 帝后棺椁', sub: '万历居中，孝端、孝靖分列左右', pos: [0, -25.4, -72.4], at: 54, off: [140, 60] },
  { text: '金刚墙', sub: '高 8.8 · 厚 1.6 m，4 层条石 + 56 层城砖', pos: [5, -21, 0.3], at: 64, off: [110, -40] },
  { text: '石隧道', sub: '长约 40 m', pos: [4.5, -16.5, 26], at: 71, off: [110, 0] },
  { text: '砖隧道', sub: '两墙相距约 8 m，走向示意', pos: [-24, -6.5, 46], at: 74, off: [-120, -40] },
  { text: '指路石', sub: '"此石至金刚墙前皮十六丈深三丈五尺"', pos: GUIDE_STONE.pos, at: 74, off: [-150, 60] },
  { text: '隧道门', sub: '宝城内侧券门（位置示意）', pos: [-38, 5, 36.8], at: 90, off: [-120, -50] },
  { text: '宝顶', sub: '夯土封顶（示意）', pos: [0, 16, -60], at: 90, off: [-90, -60] },
  { text: '宝城', sub: '环绕宝顶的城墙（示意）', pos: [-73.5, 7.6, 13.6], at: 90, off: [-90, -40] },
  { text: '方城明楼', sub: '示意', pos: [0, 24, 50], at: 92, off: [90, -60] },
  { text: '±0.00', sub: '地面', pos: [C.x + R + 16, 0, C.z], at: 0, off: [60, -16], red: true },
  { text: '−27.00', sub: '地宫地面', pos: [17, -27, -2], at: 8, off: [80, 10], red: true },
];

// 跟随考古队。cam/target 为相机位置与注视点；fig 为考古队员位置。
export const DIG_STEPS = [
  {
    date: '1956 年 5 月', title: '宝城上的"隧道门"',
    text: '发掘队在宝城内侧城墙上找到一处券门痕迹，门洞上方的石条刻着"隧道门"三个字。说明这里正是当年进出地宫的隧道起点。',
    cam: [-4, 26, 86], target: [-36, 4, 38], fig: [-35.5, 6.6, 33.5], section: 0,
  },
  {
    date: '1956 年夏', title: '第一条探沟：砖隧道',
    text: '顺着隧道门往里挖，挖出两道相距约 8 米的砖墙，弯弯曲曲伸向地下。这就是文献里记载的砖隧道。',
    cam: [-4, 18, 78], target: [-20, -8, 44], fig: [-22, -6.2, 45.5], section: 0.5,
  },
  {
    date: '1956 年 9 月', title: '指路石',
    text: '第二条探沟里挖出一块一尺来长的小石碑，刻着"此石至金刚墙前皮十六丈深三丈五尺"。定陵 1590 年完工，万历 1620 年才下葬，这块石头是明朝工部留给自己人重新找入口用的。它成了打开地宫的钥匙。',
    cam: [10, 2, 62], target: GUIDE_STONE.pos, fig: [-7.4, -11.2, 45.2], section: 0.5,
  },
  {
    date: '1957 年', title: '石隧道尽头的金刚墙',
    text: '按石碑指示挖到石隧道尽头，迎面是金刚墙：高 8.8 米、厚 1.6 米，下面 4 层条石，上面 56 层城砖。拆开墙上部的封砖，里面就是地宫。',
    cam: [17, -15, 19], target: [0, -22.5, -0.5], fig: [1.6, -25.2, 5], section: 1,
  },
  {
    date: '1957 年 5 月', title: '推不开的石门',
    text: '第一道汉白玉石门从里面被自来石顶死。考古队用粗铁丝弯成"拐钉钥匙"，从门缝伸进去套住自来石上端，慢慢推正，门才推开。',
    cam: [2.2, -24.3, -15.5], target: [-0.3, -25.6, -10], fig: [0.6, -26.88, -6], section: 1,
  },
  {
    date: '1957 年', title: '中殿：宝座与长明灯',
    text: '中殿摆着三座汉白玉宝座，每座前面有五供和一口青花云龙大缸。缸里盛灯油、放灯芯，就是长明灯。下葬封门后缺氧，灯很快就灭了。',
    cam: [10, -20, -50], target: [0, -25.6, -59], fig: [0.5, -26.88, -52], section: 1,
  },
  {
    date: '1957 年', title: '后殿：帝后棺椁',
    text: '后殿棺床正中是万历皇帝的棺椁，左右是孝端、孝靖两位皇后，周围堆放着装满随葬品的木箱。',
    cam: [9, -19, -65.5], target: [-1, -25.6, -73], fig: [1.6, -26.88, -69.6], section: 1,
  },
  {
    date: '1957 年', title: '空着的配殿',
    text: '左右配殿各有一座棺床，按规制是给皇后预备的，但下葬时都没有用上，殿里空空荡荡。',
    cam: [-31, -18, -41], target: [-13, -26, -51], fig: [-12, -26.88, -46], section: 1, cut: [-1, 0, 15.6],
  },
  {
    date: '1958 年以后', title: '代价',
    text: '定陵出土文物三千余件，但当时缺乏保护技术，大量丝织品很快褪色朽坏；1966 年，帝后遗骨被焚毁。此后国家不再批准主动发掘帝王陵。',
    cam: [110, 50, 30], target: [0, -12, -30], fig: null, section: 0.5,
  },
];

// 防盗讲解
export const DEFENSES = [
  { title: '深', text: '地宫地面在地下约 27 米，头顶是层层夯土和宝顶。', cam: [70, -10, 10], target: [0, -18, -40], section: 0.5 },
  { title: '藏', text: '隧道下葬后全部回填夯实，地面看不出入口和走向。', cam: [40, 40, 90], target: [-10, -6, 30], section: 0.22 },
  { title: '墙', text: '金刚墙高 8.8 米、厚 1.6 米，条石打底，上砌 56 层城砖。', cam: [17, -15, 19], target: [0, -22.5, -0.5], section: 1 },
  { title: '门', text: '七道石门，每扇约 4 吨，整块汉白玉雕成。', cam: [2.2, -24.3, -15.5], target: [-0.3, -25.6, -10], section: 1 },
  { title: '撑', text: '自来石从里面斜撑门背，外面越推，石条越往地槽里压。', demo: true },
  { title: '石', text: '五座大殿全用石料起券，不用一根木梁木柱，不怕腐朽，也不怕火。', cam: [40, -2, -30], target: [0, -22, -50], section: 1 },
];
