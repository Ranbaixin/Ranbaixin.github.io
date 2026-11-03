/** Public reconstruction of feeder/terminal relationships. All identities and geometry are new. */
const port = (id, device, terminal, x, y, page, description) => ({ id, device, terminal, label: `${device}:${terminal}`, x, y, page, description });
const view = (page, zone, label, x, y, width, height) => ({ page, zone, label, bounds: { x, y, width, height } });
const reference = (id, a, b, x, row, zone) => ({
  id, a, b, kind: 'direct', status: 'verified', wire: `W20${row + 1}`,
  evidence: `P01 / ${zone} ↔ P02 / ${row < 2 ? 'B4' : 'C4'}`,
  note: '器件出线与端子行的双向引用已对应。',
  views: [view('P01', zone, '器件出线与去向标注', x - 35, 370, 105, 155), view('P02', row < 2 ? 'B4' : 'C4', `端子排第 ${row + 1} 行`, 135, 175 + row * 52, 440, 48)],
  strokes: [{ page: 'P01', d: `M${x} 390V510` }, { page: 'P02', d: `M160 ${202 + row * 52}H472` }],
});
const pending = (id, a, b, x, lampX, device) => ({
  id, a, b, kind: 'direct', status: 'pending', wire: '未核验', evidence: `P01 / ${x < 300 ? 'A1–C2' : 'A3–C4'} · 指示支路引用`,
  note: '已提取指示支路引用，指示灯端子身份尚待核对。',
  views: [view('P01', x < 300 ? 'A1–C2' : 'A3–C4', `${device} 指示支路待核`, Math.min(x, lampX) - 50, 100, Math.abs(x - lampX) + 100, 310)],
  strokes: [{ page: 'P01', d: `M${x} 390H${x < lampX ? x - 50 : x + 50}V145H${lampX}` }],
});
const boundary = (id, a, b, x) => ({ id, a, b, kind: 'component', status: 'boundary', wire: '—', evidence: '器件边界', note: '开关内部开闭状态不由端口查询推断。', views: [], strokes: [{ page: 'P01', d: `M${x} 280V312M${x - 10} 320L${x} 345V390` }] });
const membership = (id, a, x) => ({
  id, a, b: 'n1', kind: 'network', status: 'verified', wire: '同网关系', evidence: 'P01 / B5 · 辅助触点同网集合',
  note: '确认属于同一网络；不据此新增逐段物理直连。',
  views: [view('P01', 'B5', '辅助触点同网集合', 300, 225, 570, 85)],
  strokes: [{ page: 'P01', d: `M${x} 280V245H700` }],
});

export const wiringSample = {
  version: 'wiring-v3',
  disclosure: '参照项目已核对的开关出线、端子行、同网集合与待核引用重绘。器件、端子排、图号、线号和布局均已替换；未公开原图与设备规格。',
  pages: [
    { id: 'P01', title: '馈线开关接线', code: 'DEMO-EL-01', width: 1000, height: 640 },
    { id: 'P02', title: '端子排对照', code: 'DEMO-EL-02', width: 1000, height: 640 },
  ],
  ports: [
    port('p1', 'Q01', '2', 170, 390, 'P01', '馈线开关出线端'),
    port('p2', 'Q01', '4', 250, 390, 'P01', '馈线开关另一出线端'),
    port('p3', 'Q02', '2', 480, 390, 'P01', '第二组馈线出线端'),
    port('p4', 'XT01', '21', 500, 202, 'P02', '端子排第一行'),
    port('p5', 'Q01', '1', 170, 280, 'P01', '器件输入侧，内部关系独立判断'),
    port('p6', 'HL01', '1', 170, 145, 'P01', '指示灯端子，身份待核'),
    port('p7', 'HL01', '2', 250, 145, 'P01', '指示灯另一端，身份待核'),
    port('p8', 'Q02', '4', 560, 390, 'P01', '第二组馈线另一出线端'),
    port('p9', 'XT01', '22', 500, 254, 'P02', '端子排第二行'),
    port('p10', 'XT01', '23', 500, 306, 'P02', '端子排第三行'),
    port('p11', 'XT01', '24', 500, 358, 'P02', '端子排第四行'),
    port('p12', 'Q01', '3', 250, 280, 'P01', '器件另一输入侧'),
    port('p13', 'Q02', '1', 480, 280, 'P01', '第二组器件输入侧'),
    port('p14', 'Q02', '3', 560, 280, 'P01', '第二组器件另一输入侧'),
    port('p15', 'Q01', '95', 330, 280, 'P01', '辅助触点，同网成员'),
    port('p16', 'Q02', '95', 650, 280, 'P01', '辅助触点，同网成员'),
    port('p17', 'HL02', '1', 480, 145, 'P01', '第二组指示支路待核端'),
    port('p18', 'HL02', '2', 560, 145, 'P01', '第二组指示支路另一待核端'),
    port('p20', 'Q03', '95', 820, 280, 'P01', '辅助触点，同网成员'),
  ],
  nodes: [{ id: 'n1', label: 'N01', page: 'P01', x: 700, y: 245 }],
  edges: [
    reference('e1', 'p1', 'p4', 170, 0, 'C1'),
    reference('e2', 'p2', 'p9', 250, 1, 'C2'),
    reference('e3', 'p3', 'p10', 480, 2, 'C3'),
    reference('e4', 'p8', 'p11', 560, 3, 'C4'),
    pending('e5', 'p1', 'p6', 170, 170, 'HL01'),
    pending('e6', 'p2', 'p7', 250, 250, 'HL01'),
    pending('e7', 'p3', 'p17', 480, 480, 'HL02'),
    pending('e8', 'p8', 'p18', 560, 560, 'HL02'),
    boundary('b1', 'p5', 'p1', 170), boundary('b2', 'p12', 'p2', 250),
    boundary('b3', 'p13', 'p3', 480), boundary('b4', 'p14', 'p8', 560),
    membership('n-edge-1', 'p15', 330), membership('n-edge-2', 'p16', 650), membership('n-edge-3', 'p20', 820),
  ],
};
