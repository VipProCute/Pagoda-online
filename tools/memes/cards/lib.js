/*
 * lib.js — bộ vẽ SVG dùng chung cho các thẻ meme (tools/memes/cards/*.html).
 * Mọi hình đều vẽ bằng code (SVG path / gradient), không dùng ảnh ngoài.
 * Giấy phép: CC0 (cùng các thẻ).
 *
 * Cách dùng trong một thẻ:
 *   const R = rng(7);                 // bộ random có seed => ảnh luôn giống nhau
 *   add(E('rect', {width: 720, height: 720, fill: lg([[0,'#fff'],[1,'#000']])}));
 *   add(rose(200, 500, 80, ROSES.pink));
 *   add(fancy('Chúc Ngày Mới', {x: 360, y: 150, size: 100, font: 'Pacifico', ...}));
 *   finish();                         // nạp font, co chữ cho vừa, báo window.__ready
 */
(function () {
  'use strict';
  const W = 720, H = 720;
  let _n = 0;
  const D = [], B = [], TXT = [], FONTS = new Map();
  const uid = (p) => p + (++_n);
  const num = (v) => (typeof v === 'number' ? +v.toFixed(2) : v);

  function attrs(o) {
    let s = '';
    for (const k in o) {
      const v = o[k];
      if (v === undefined || v === null || v === false) continue;
      s += ' ' + k.replace(/_/g, '-') + '="' + num(v) + '"';
    }
    return s;
  }
  // E('circle', {cx: 1, ...}, 'inner?') => chuỗi SVG
  function E(tag, a, inner) {
    return '<' + tag + attrs(a || {}) + (inner == null ? '/>' : '>' + inner + '</' + tag + '>');
  }
  const G = (a, ...kids) => E('g', a, kids.join(''));
  const add = (s) => { B.push(s); };
  const def = (s) => { D.push(s); };

  // ---- random có seed ----
  function rng(seed) {
    let a = seed | 0;
    const r = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.between = (lo, hi) => lo + (hi - lo) * r();
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    return r;
  }

  // ---- gradient / filter ----
  const stopsStr = (st) => st.map((s) => E('stop', { offset: s[0], stop_color: s[1], stop_opacity: s[2] })).join('');
  // lg(stops, {x1,y1,x2,y2,u}) mặc định theo bbox, trên xuống dưới. u=true => toạ độ pixel
  function lg(stops, o = {}) {
    const id = uid('lg');
    def(E('linearGradient', {
      id, x1: o.x1 ?? 0, y1: o.y1 ?? 0, x2: o.x2 ?? 0, y2: o.y2 ?? 1,
      gradientUnits: o.u ? 'userSpaceOnUse' : undefined,
    }, stopsStr(stops)));
    return 'url(#' + id + ')';
  }
  function rg(stops, o = {}) {
    const id = uid('rg');
    def(E('radialGradient', {
      id, cx: o.cx ?? 0.5, cy: o.cy ?? 0.5, r: o.r ?? 0.5, fx: o.fx, fy: o.fy,
      gradientUnits: o.u ? 'userSpaceOnUse' : undefined,
    }, stopsStr(stops)));
    return 'url(#' + id + ')';
  }
  const _blur = {};
  function blur(sd) {
    if (!_blur[sd]) {
      const id = uid('bl');
      def(E('filter', { id, x: '-60%', y: '-60%', width: '220%', height: '220%' }, E('feGaussianBlur', { stdDeviation: sd })));
      _blur[sd] = 'url(#' + id + ')';
    }
    return _blur[sd];
  }
  // quầng sáng mềm (radial gradient từ màu -> trong suốt)
  function glow(cx, cy, r, color, op = 1, core = 0) {
    const g = rg([[core, color, op], [1, color, 0]], { cx: 0.5, cy: 0.5, r: 0.5 });
    return E('circle', { cx, cy, r, fill: g });
  }

  // ---- hình cơ bản ----
  // sao lấp lánh 4 cánh
  function sparkle(x, y, s, fill = '#fff', op = 1, rot = 0, halo = true) {
    const k = s;
    const p = `M0,${-k} Q${k * 0.1},${-k * 0.1} ${k},0 Q${k * 0.1},${k * 0.1} 0,${k} Q${-k * 0.1},${k * 0.1} ${-k},0 Q${-k * 0.1},${-k * 0.1} 0,${-k}Z`;
    return G({ transform: `translate(${x} ${y}) rotate(${rot})`, opacity: op },
      halo ? glow(0, 0, s * 1.15, fill, 0.55) : '',
      E('path', { d: p, fill }),
      E('circle', { r: s * 0.12, fill: '#fff' }));
  }
  // hạt kim tuyến rải ngẫu nhiên
  function glitter(R, n, box, o = {}) {
    const [x0, y0, x1, y1] = box;
    const cols = o.colors || ['#fff', '#ffe9a8', '#ffd1ea'];
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = R.between(x0, x1), y = R.between(y0, y1), c = R.pick(cols);
      if (R() < (o.stars ?? 0.3)) s += sparkle(x, y, R.between(o.smin ?? 5, o.smax ?? 14), c, R.between(0.6, 1), 0, R() < 0.5);
      else s += E('circle', { cx: x, cy: y, r: R.between(o.rmin ?? 1.2, o.rmax ?? 3.2), fill: c, opacity: R.between(0.5, 1) });
    }
    return s;
  }
  // bokeh: vòng tròn mờ
  function bokeh(R, n, box, o = {}) {
    const [x0, y0, x1, y1] = box;
    const cols = o.colors || ['#fff'];
    let s = '';
    for (let i = 0; i < n; i++) {
      const r = R.between(o.rmin ?? 8, o.rmax ?? 36), c = R.pick(cols);
      const op = R.between(o.omin ?? 0.12, o.omax ?? 0.4);
      const x = R.between(x0, x1), y = R.between(y0, y1);
      const g = rg([[0, c, op * 0.55], [0.8, c, op], [1, c, op * 0.2]]);
      s += E('circle', { cx: x, cy: y, r, fill: g });
    }
    return s;
  }
  // trái tim bóng
  const HEART = 'M0,.38 C-.58,-.04 -.46,-.52 -.21,-.52 C-.08,-.52 0,-.42 0,-.31 C0,-.42 .08,-.52 .21,-.52 C.46,-.52 .58,-.04 0,.38Z';
  function heart(x, y, s, c1 = '#ff9ec4', c2 = '#e0245e', rot = 0, op = 1) {
    const g = lg([[0, c1], [1, c2]], { x1: 0.2, y1: 0, x2: 0.8, y2: 1 });
    return G({ transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})`, opacity: op },
      E('path', { d: HEART, fill: g, stroke: c2, stroke_width: 0.02, stroke_opacity: 0.4, stroke_linejoin: 'round' }),
      E('ellipse', { cx: -0.2, cy: -0.28, rx: 0.1, ry: 0.06, fill: '#fff', opacity: 0.7, transform: 'rotate(-35 -.2 -.28)' }));
  }
  // lá cây (gốc ở 0,0, chỉ lên trên)
  function leaf(x, y, len, rot, c1 = '#7fd36a', c2 = '#1f8a45', op = 1) {
    const w = len * 0.3;
    const g = lg([[0, c1], [1, c2]], { x1: 0, y1: 0, x2: 1, y2: 0.2 });
    return G({ transform: `translate(${x} ${y}) rotate(${rot})`, opacity: op },
      E('path', { d: `M0,0 C${w},${-len * 0.25} ${w * 1.1},${-len * 0.72} 0,${-len} C${-w * 1.1},${-len * 0.72} ${-w},${-len * 0.25} 0,0Z`, fill: g, stroke: c2, stroke_width: len * 0.012, stroke_opacity: 0.5 }),
      E('path', { d: `M0,${-len * 0.04} Q${len * 0.02},${-len * 0.5} 0,${-len * 0.92}`, fill: 'none', stroke: '#fff', stroke_opacity: 0.35, stroke_width: len * 0.018, stroke_linecap: 'round' }));
  }

  // ---- hoa hồng ----
  const ROSES = {
    pink: { rim: '#ffe0ec', light: '#ff8db8', mid: '#ee4f8c', dark: '#bd1f60', deep: '#701040' },
    red: { rim: '#ffb0b0', light: '#ff5566', mid: '#d6213c', dark: '#971028', deep: '#560516' },
    hot: { rim: '#ffc2e0', light: '#ff5fb0', mid: '#e0207d', dark: '#a50e56', deep: '#600533' },
    peach: { rim: '#fff0e0', light: '#ffc3a0', mid: '#ff8f7a', dark: '#d9584c', deep: '#8a2a2c' },
    white: { rim: '#ffffff', light: '#fff6f2', mid: '#ffe0d8', dark: '#f0aca6', deep: '#b8625f' },
    yellow: { rim: '#fff6c2', light: '#ffe066', mid: '#f5b81c', dark: '#cc8208', deep: '#7a4a05' },
  };
  function rose(cx, cy, r, pal, rot = 0) {
    const g = lg([[0, pal.rim], [0.22, pal.light], [0.7, pal.mid], [1, pal.dark]]);
    const gi = lg([[0, pal.light], [0.55, pal.mid], [1, pal.deep]]);
    const ring = (n, d, rx, ry, off, grad) => {
      let o = '';
      for (let i = 0; i < n; i++) {
        o += E('ellipse', {
          cx: 0, cy: -d, rx, ry, fill: grad, stroke: pal.deep, stroke_opacity: 0.5, stroke_width: r * 0.02,
          transform: 'rotate(' + (off + (i * 360) / n) + ')',
        });
      }
      return o;
    };
    let s = glow(0, r * 0.1, r * 1.5, '#000', 0.22);
    s += E('circle', { r: r * 1.0, fill: pal.deep });
    s += ring(7, r * 0.52, r * 0.42, r * 0.47, 0, g);
    s += ring(5, r * 0.37, r * 0.33, r * 0.39, 26, g);
    s += ring(4, r * 0.21, r * 0.25, r * 0.29, 12, gi);
    s += ring(3, r * 0.09, r * 0.17, r * 0.21, 50, gi);
    s += E('path', {
      d: `M0,0 c${r * 0.07},${-r * 0.1} ${r * 0.2},${-r * 0.05} ${r * 0.17},${r * 0.08} c${-r * 0.03},${r * 0.14} ${-r * 0.22},${r * 0.12} ${-r * 0.26},${-r * 0.04}`,
      fill: 'none', stroke: pal.deep, stroke_opacity: 0.6, stroke_width: r * 0.035, stroke_linecap: 'round',
    });
    // viền sáng nhẹ
    s += E('circle', { r: r * 0.97, fill: 'none', stroke: pal.rim, stroke_opacity: 0.25, stroke_width: r * 0.04 });
    return G({ transform: `translate(${cx} ${cy}) rotate(${rot})` }, s);
  }
  function roseBud(cx, cy, r, pal, rot = 0) {
    const g = lg([[0, pal.light], [1, pal.dark]], { x1: 0, y1: 0, x2: 1, y2: 1 });
    const s = E('path', { d: `M0,${r * 0.9} C${-r * 0.9},${r * 0.3} ${-r * 0.7},${-r * 0.8} 0,${-r} C${r * 0.7},${-r * 0.8} ${r * 0.9},${r * 0.3} 0,${r * 0.9}Z`, fill: g, stroke: pal.deep, stroke_opacity: 0.5, stroke_width: r * 0.04 })
      + E('path', { d: `M${-r * 0.1},${r * 0.7} C${-r * 0.5},${-r * 0.1} ${-r * 0.2},${-r * 0.6} ${r * 0.1},${-r * 0.9}`, fill: 'none', stroke: pal.deep, stroke_opacity: 0.45, stroke_width: r * 0.05, stroke_linecap: 'round' })
      + E('path', { d: `M${-r * 0.45},${r * 0.55} Q${-r * 0.2},${r * 0.2} ${-r * 0.3},${-r * 0.4}`, fill: 'none', stroke: pal.rim, stroke_opacity: 0.5, stroke_width: r * 0.06, stroke_linecap: 'round' });
    return G({ transform: `translate(${cx} ${cy}) rotate(${rot})` }, s);
  }
  // cụm hoa hồng + lá, tâm ở (cx,cy), tỉ lệ k (1 => hoa lớn r≈70)
  function roseBunch(R, cx, cy, k, pal, o = {}) {
    const pal2 = o.pal2 || pal;
    let s = '';
    const leaves = o.leaves ?? 8;
    for (let i = 0; i < leaves; i++) {
      const a = -150 + (i * 300) / Math.max(1, leaves - 1) + R.between(-12, 12);
      const L = R.between(95, 150) * k;
      s += leaf(cx + Math.sin((a * Math.PI) / 180) * 20 * k, cy - Math.cos((a * Math.PI) / 180) * 20 * k, L, a, '#74d070', '#1b7d42', 1)
        .replace('translate(', 'translate(');
    }
    const spots = o.spots || [[0, 0, 70], [-85, 18, 50], [78, 22, 52], [-30, -72, 44], [38, -70, 40]];
    spots.forEach(([dx, dy, r], i) => {
      const p = i % 2 ? pal2 : pal;
      s += rose(cx + dx * k, cy + dy * k, r * k, p, R.between(0, 360));
    });
    if (o.bud) s += roseBud(cx + o.bud[0] * k, cy + o.bud[1] * k, 26 * k, pal2, o.bud[2] || 0);
    return s;
  }

  // ---- chim, mây, trăng ----
  function bird(x, y, s, fill = '#2b1b3a', rot = 0, op = 1) {
    return G({ transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})`, opacity: op },
      E('path', { d: 'M-34,2 C-26,-12 -10,-14 0,2 C10,-14 26,-12 34,2 C24,-4 10,-4 0,10 C-10,-4 -24,-4 -34,2Z', fill }));
  }
  function cloud(x, y, s, fill = '#fff', op = 1) {
    const g = rg([[0, fill, 1], [1, fill, 0.85]]);
    return G({ transform: `translate(${x} ${y}) scale(${s})`, opacity: op },
      E('path', { d: 'M-70,24 C-96,24 -96,-6 -70,-8 C-72,-34 -40,-44 -26,-26 C-20,-52 24,-56 32,-24 C58,-34 84,-12 70,10 C94,12 90,28 66,28 L-66,28Z', fill: g }));
  }
  // đám mây dễ thương có mặt
  function cuteCloud(x, y, s, o = {}) {
    const fill = o.fill || '#fff';
    return G({ transform: `translate(${x} ${y}) scale(${s})` },
      cloud(0, 0, 1, fill, 1),
      face(0, 6, 1, { eyes: 'dot', blush: '#ffb3c7', mouth: 'smile', ink: '#6a4a5a' }));
  }
  // mặt kawaii: eyes 'dot' | 'happy' (^ ^) ; mouth 'smile' | 'open'
  function face(x, y, s, o = {}) {
    const ink = o.ink || '#4a2a2a', bl = o.blush || '#ff9fb5', sep = o.sep ?? 26;
    let e;
    if (o.eyes === 'happy') {
      e = [-1, 1].map((d) => E('path', { d: `M${d * sep - 9},3 Q${d * sep},-10 ${d * sep + 9},3`, fill: 'none', stroke: ink, stroke_width: 4.5, stroke_linecap: 'round' })).join('');
    } else {
      e = [-1, 1].map((d) => E('ellipse', { cx: d * sep, cy: 0, rx: 5.5, ry: 7, fill: ink }) + E('circle', { cx: d * sep - 2, cy: -2.5, r: 2.2, fill: '#fff' })).join('');
    }
    const m = o.mouth === 'open'
      ? E('path', { d: 'M-9,12 Q0,32 9,12Z', fill: '#c0344f', stroke: ink, stroke_width: 3, stroke_linejoin: 'round' })
      : E('path', { d: 'M-8,13 Q0,24 8,13', fill: 'none', stroke: ink, stroke_width: 3.6, stroke_linecap: 'round' });
    const cheeks = [-1, 1].map((d) => E('ellipse', { cx: d * (sep + 15), cy: 15, rx: 10, ry: 6.5, fill: bl, opacity: 0.75 })).join('');
    return G({ transform: `translate(${x} ${y}) scale(${s})` }, cheeks, e, m);
  }
  function moon(cx, cy, r) {
    const g = rg([[0, '#fffbe0'], [0.6, '#ffe9a0'], [1, '#f6c75a']], { cx: 0.4, cy: 0.38, r: 0.7 });
    let s = glow(cx, cy, r * 2.6, '#ffd77a', 0.55) + glow(cx, cy, r * 1.6, '#fff1b8', 0.6, 0.4);
    s += E('circle', { cx, cy, r, fill: g });
    // mặt trăng: vài hố mờ
    [[-0.32, -0.2, 0.2], [0.28, 0.12, 0.26], [-0.1, 0.42, 0.14], [0.38, -0.38, 0.1]].forEach(([dx, dy, k]) => {
      s += E('circle', { cx: cx + dx * r, cy: cy + dy * r, r: k * r, fill: '#e8b64a', opacity: 0.16 });
    });
    return s;
  }

  // ---- hoa sen ----
  const LOTUS = {
    pink: { tip: '#fff1f6', mid: '#ffa9c8', base: '#e4559a', edge: '#c13a80' },
    white: { tip: '#ffffff', mid: '#ffeef3', base: '#ffc3d6', edge: '#e693b0' },
    gold: { tip: '#fff5c9', mid: '#ffd36b', base: '#f0a020', edge: '#c47a0c' },
  };
  function lotus(cx, cy, s, pal = LOTUS.pink, o = {}) {
    // mỗi cánh: hình giọt nước chỉ lên, gốc ở (0,0)
    const petal = (len, wid) => `M0,0 C${wid},${-len * 0.25} ${wid * 0.9},${-len * 0.75} 0,${-len} C${-wid * 0.9},${-len * 0.75} ${-wid},${-len * 0.25} 0,0Z`;
    const g = lg([[0, pal.tip], [0.45, pal.mid], [1, pal.base]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    const gd = lg([[0, pal.mid], [1, pal.base]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    const layer = (angles, len, wid, grad, dy = 0) =>
      angles.map((a) => E('path', {
        d: petal(len, wid), fill: grad, stroke: pal.edge, stroke_opacity: 0.55, stroke_width: 1.3,
        transform: `rotate(${a}) translate(0 ${dy})`,
      })).join('');
    let inner = '';
    inner += layer([-78, 78], 72, 26, gd, 0);
    inner += layer([-52, 52], 92, 30, g, 0);
    inner += layer([-26, 26], 108, 32, g, 0);
    inner += layer([0], 118, 34, g, 0);
    if (o.centerGlow !== false) inner += glow(0, -50, 46, '#fff7c9', 0.5);
    // vân cánh
    [-26, 0, 26].forEach((a) => {
      inner += E('path', { d: 'M0,-14 Q4,-60 0,-100', stroke: '#fff', stroke_opacity: 0.45, stroke_width: 2, fill: 'none', transform: `rotate(${a})` });
    });
    return G({ transform: `translate(${cx} ${cy}) scale(${s}) rotate(${o.rot || 0})` }, inner);
  }
  // lá sen (đĩa tròn nhìn nghiêng)
  function lilypad(cx, cy, rx, ry, c1 = '#58b86a', c2 = '#1f7a4a') {
    const g = rg([[0, c1], [1, c2]], { cx: 0.45, cy: 0.4, r: 0.7 });
    return G({}, E('ellipse', { cx, cy: cy + ry * 0.12, rx: rx * 1.02, ry: ry * 1.06, fill: '#000', opacity: 0.18 }),
      E('path', { d: `M${cx},${cy} L${cx + rx * 0.98},${cy - ry * 0.35} A${rx},${ry} 0 1 1 ${cx + rx * 0.98},${cy + ry * 0.35} Z`, fill: g, stroke: c2, stroke_width: 1.2 }),
      E('path', { d: `M${cx},${cy} L${cx - rx * 0.7},${cy - ry * 0.4} M${cx},${cy} L${cx - rx * 0.2},${cy + ry * 0.8} M${cx},${cy} L${cx + rx * 0.5},${cy + ry * 0.7} M${cx},${cy} L${cx - rx * 0.1},${cy - ry * 0.85}`, stroke: '#d6f5c0', stroke_opacity: 0.4, stroke_width: 1.5, fill: 'none' }));
  }

  // ---- đèn lồng đỏ ----
  function lantern(cx, cy, r, o = {}) {
    const ry = r * 0.84;
    const body = rg([[0, '#ffe08a'], [0.35, '#ff9a2e'], [0.75, '#e0301e'], [1, '#8f0e18']], { cx: 0.5, cy: 0.5, r: 0.62 });
    let s = glow(0, 0, r * 2.1, '#ff9a3c', 0.5, 0.3);
    // dây treo
    s += E('line', { x1: 0, y1: -ry - r * 0.55 - (o.rope ?? 400), x2: 0, y2: -ry - r * 0.2, stroke: '#e8b84a', stroke_width: 2.6 });
    // nắp trên/ dưới
    const cap = (y) => E('rect', { x: -r * 0.36, y: y - r * 0.09, width: r * 0.72, height: r * 0.18, rx: r * 0.05, fill: lg([[0, '#fff0a0'], [1, '#d99a1c']]), stroke: '#a8700c', stroke_width: 1.2 });
    s += E('rect', { x: -r * 0.05, y: -ry - r * 0.34, width: r * 0.1, height: r * 0.2, fill: '#e8b84a' });
    s += cap(-ry + 1);
    // thân
    s += E('ellipse', { cx: 0, cy: 0, rx: r, ry, fill: body, stroke: '#7d0b14', stroke_width: 1.5 });
    // gân dọc
    [0.82, 0.5, 0.18, -0.18, -0.5, -0.82].forEach((k) => {
      const w = r * k;
      s += E('path', { d: `M${w * 0.34},${-ry * 0.94} Q${w * 1.04},0 ${w * 0.34},${ry * 0.94}`, fill: 'none', stroke: '#8f0e18', stroke_opacity: 0.45, stroke_width: 2 });
    });
    s += E('ellipse', { cx: -r * 0.38, cy: -ry * 0.35, rx: r * 0.16, ry: ry * 0.3, fill: '#fff', opacity: 0.28, transform: `rotate(18 ${-r * 0.38} ${-ry * 0.35})` });
    s += cap(ry - 1);
    // tua rua
    const ty = ry + r * 0.08;
    s += E('rect', { x: -r * 0.05, y: ty, width: r * 0.1, height: r * 0.2, fill: '#e8b84a' });
    s += E('ellipse', { cx: 0, cy: ty + r * 0.28, rx: r * 0.11, ry: r * 0.12, fill: '#ffd24a', stroke: '#b57a10', stroke_width: 1 });
    for (let i = -5; i <= 5; i++) {
      s += E('path', { d: `M${i * r * 0.016},${ty + r * 0.36} Q${i * r * 0.05},${ty + r * 0.62} ${i * r * 0.07},${ty + r * 0.92}`, stroke: i % 2 ? '#ffd24a' : '#e0301e', stroke_width: 2.2, fill: 'none', stroke_linecap: 'round' });
    }
    return G({ transform: `translate(${cx} ${cy}) rotate(${o.rot || 0} 0 ${-ry - 40})` }, s);
  }

  // ---- hoa 5 cánh (hoa mai / hoa đào) ----
  function flower5(cx, cy, r, c1 = '#fff6b0', c2 = '#ffc41f', center = '#d8301c', rot = 0) {
    const g = rg([[0, c2], [0.55, c1], [1, c1]], { cx: 0.5, cy: 0.7, r: 0.75 });
    let s = '';
    for (let i = 0; i < 5; i++) {
      s += E('circle', { cx: 0, cy: -r * 0.56, r: r * 0.5, fill: g, stroke: c2, stroke_opacity: 0.55, stroke_width: r * 0.03, transform: `rotate(${i * 72})` });
    }
    s += E('circle', { r: r * 0.2, fill: center, opacity: 0.9 });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8;
      s += E('line', { x1: Math.cos(a) * r * 0.16, y1: Math.sin(a) * r * 0.16, x2: Math.cos(a) * r * 0.34, y2: Math.sin(a) * r * 0.34, stroke: center, stroke_width: r * 0.025 });
      s += E('circle', { cx: Math.cos(a) * r * 0.36, cy: Math.sin(a) * r * 0.36, r: r * 0.04, fill: '#fff3a0' });
    }
    return G({ transform: `translate(${cx} ${cy}) rotate(${rot})` }, s);
  }

  // ---- đồng xu vàng có lỗ vuông ----
  function coin(cx, cy, r, o = {}) {
    const g = lg([[0, '#fff4a8'], [0.45, '#ffcf3a'], [1, '#c98a08']], { x1: 0.15, y1: 0, x2: 0.85, y2: 1 });
    const g2 = lg([[0, '#c98a08'], [1, '#fff0a0']], { x1: 0.15, y1: 0, x2: 0.85, y2: 1 });
    let s = E('circle', { r, fill: g, stroke: '#a8680a', stroke_width: r * 0.04 });
    s += E('circle', { r: r * 0.8, fill: 'none', stroke: g2, stroke_width: r * 0.1 });
    s += E('rect', { x: -r * 0.2, y: -r * 0.2, width: r * 0.4, height: r * 0.4, fill: o.hole || '#8a1018', stroke: '#a8680a', stroke_width: r * 0.04 });
    s += E('path', { d: `M${-r * 0.7},${-r * 0.2} A${r * 0.74},${r * 0.74} 0 0 1 ${-r * 0.1},${-r * 0.72}`, stroke: '#fff', stroke_opacity: 0.7, stroke_width: r * 0.07, fill: 'none', stroke_linecap: 'round' });
    return G({ transform: `translate(${cx} ${cy}) rotate(${o.rot || 0}) scale(${o.sx ?? 1} 1)`, opacity: o.op }, s);
  }

  // ---- ngôi sao bo tròn 5 cánh ----
  function starPath(R0, r0, n = 5, rot = -90) {
    let p = '';
    for (let i = 0; i < n * 2; i++) {
      const a = ((rot + (i * 180) / n) * Math.PI) / 180, rr = i % 2 ? r0 : R0;
      p += (i ? 'L' : 'M') + (Math.cos(a) * rr).toFixed(2) + ',' + (Math.sin(a) * rr).toFixed(2);
    }
    return p + 'Z';
  }
  function star5(cx, cy, R0, c1 = '#fff3a0', c2 = '#ffb81c', rot = 0, o = {}) {
    const g = lg([[0, c1], [1, c2]], { x1: 0.2, y1: 0, x2: 0.8, y2: 1 });
    const edge = o.edge || c2;
    const round = R0 * 0.14;
    let s = glow(0, 0, R0 * 1.7, c1, 0.4);
    s += E('path', { d: starPath(R0 - round, (R0 - round) * 0.5), fill: g, stroke: edge, stroke_width: round * 2, stroke_linejoin: 'round' });
    s += E('path', { d: starPath(R0 - round, (R0 - round) * 0.5), fill: 'none', stroke: c1, stroke_opacity: 0.55, stroke_width: round * 0.7, stroke_linejoin: 'round', transform: 'scale(.86)' });
    s += E('ellipse', { cx: -R0 * 0.22, cy: -R0 * 0.38, rx: R0 * 0.12, ry: R0 * 0.07, fill: '#fff', opacity: 0.75, transform: `rotate(-40 ${-R0 * 0.22} ${-R0 * 0.38})` });
    return G({ transform: `translate(${cx} ${cy}) rotate(${rot})` }, s);
  }

  // ---- hoa hướng dương ----
  function sunflower(cx, cy, r, rot = 0) {
    const d = r * 0.5;
    const pg = lg([[0, '#fff27a'], [0.6, '#ffc71a'], [1, '#e89a08']], { x1: 0, y1: 0, x2: 0, y2: 1 });
    const pg2 = lg([[0, '#ffe45a'], [1, '#f2a30c']], { x1: 0, y1: 0, x2: 0, y2: 1 });
    let s = glow(0, 0, r * 1.5, '#ffe06a', 0.35);
    const ring = (n, off, len, wid, grad) => {
      let o = '';
      for (let i = 0; i < n; i++) {
        o += E('path', {
          d: `M0,${-d * 0.7} C${wid},${-d * 0.7 - len * 0.3} ${wid * 0.8},${-d * 0.7 - len * 0.8} 0,${-d * 0.7 - len} C${-wid * 0.8},${-d * 0.7 - len * 0.8} ${-wid},${-d * 0.7 - len * 0.3} 0,${-d * 0.7}Z`,
          fill: grad, stroke: '#c77a06', stroke_opacity: 0.5, stroke_width: r * 0.012, transform: `rotate(${off + (i * 360) / n})`,
        });
      }
      return o;
    };
    s += ring(18, 10, r - d * 0.7 - 2, r * 0.16, pg2);
    s += ring(18, 0, r - d * 0.7, r * 0.16, pg);
    s += E('circle', { r: d * 1.05, fill: '#7a3a10' });
    s += E('circle', { r: d, fill: rg([[0, '#5a2a0c'], [0.6, '#4a2008'], [1, '#6a3410']]) });
    // hạt xếp xoắn (Fibonacci)
    for (let i = 1; i < 150; i++) {
      const a = i * 2.39996, rr = d * 0.94 * Math.sqrt(i / 150);
      s += E('circle', { cx: Math.cos(a) * rr, cy: Math.sin(a) * rr, r: d * 0.045 + rr * 0.02, fill: i % 3 ? '#8a5020' : '#a8742e', opacity: 0.85 });
    }
    s += E('circle', { r: d, fill: 'none', stroke: '#c78a30', stroke_opacity: 0.5, stroke_width: r * 0.025 });
    return G({ transform: `translate(${cx} ${cy}) rotate(${rot})` }, s);
  }

  // ---- cỏ bốn lá ----
  function clover(cx, cy, s, rot = 0, c1 = '#8be07a', c2 = '#1c9a4a') {
    const g = lg([[0, c1], [1, c2]], { x1: 0.2, y1: 0, x2: 0.8, y2: 1 });
    // mỗi lá hình trái tim, đỉnh tim hướng ra ngoài
    const lf = `M0,-4 C-40,-18 -52,-62 -26,-74 C-12,-80 -2,-70 0,-60 C2,-70 12,-80 26,-74 C52,-62 40,-18 0,-4Z`;
    let o = '';
    for (let i = 0; i < 4; i++) {
      o += G({ transform: `rotate(${i * 90 + 45})` },
        E('path', { d: lf, fill: g, stroke: c2, stroke_width: 2 }),
        E('path', { d: 'M0,-10 Q2,-40 0,-64', fill: 'none', stroke: '#e9ffd8', stroke_opacity: 0.5, stroke_width: 2.4, stroke_linecap: 'round' }),
        E('ellipse', { cx: -17, cy: -52, rx: 7, ry: 4, fill: '#fff', opacity: 0.45, transform: 'rotate(-35 -17 -52)' }));
    }
    return G({ transform: `translate(${cx} ${cy}) rotate(${rot}) scale(${s})` }, o, E('circle', { r: 5, fill: c2 }));
  }

  // ---- bướm ----
  function butterfly(x, y, s, rot, c1, c2) {
    const w = (sx, sy, rx, ry, rr) => E('ellipse', { cx: sx, cy: sy, rx, ry, fill: lg([[0, c1], [1, c2]]), stroke: '#fff', stroke_width: 2, transform: `rotate(${rr} ${sx} ${sy})` });
    return G({ transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})` },
      w(-22, -12, 24, 15, -25), w(22, -12, 24, 15, 25), w(-16, 12, 16, 11, 20), w(16, 12, 16, 11, -20),
      E('ellipse', { cx: -24, cy: -14, rx: 6, ry: 4, fill: '#fff', opacity: 0.7 }), E('ellipse', { cx: 24, cy: -14, rx: 6, ry: 4, fill: '#fff', opacity: 0.7 }),
      E('ellipse', { cx: 0, cy: 0, rx: 3.6, ry: 17, fill: '#4a2a1a' }),
      E('path', { d: 'M-2,-16 Q-10,-30 -16,-30 M2,-16 Q10,-30 16,-30', fill: 'none', stroke: '#4a2a1a', stroke_width: 2, stroke_linecap: 'round' }));
  }

  // ---- hình cánh hoa (giọt nước chỉ lên) ----
  const petalPath = (len, wid) => `M0,0 C${wid},${-len * 0.25} ${wid * 0.9},${-len * 0.75} 0,${-len} C${-wid * 0.9},${-len * 0.75} ${-wid},${-len * 0.25} 0,0Z`;

  // ---- chữ có viền + bóng, tự co cho vừa khổ ----
  // o: x, y, size, font, weight, style, fill, out1/w1 (viền trong), out2/w2 (viền ngoài),
  //    shadow, sd (độ lệch bóng), maxW, anchor, rot, ls
  function fancy(text, o) {
    const id = uid('tx');
    const base = (extra) => E('text', Object.assign({
      x: o.x, y: o.y, font_family: "'" + o.font + "'", font_size: o.size,
      font_weight: o.weight || 400, font_style: o.style || 'normal',
      text_anchor: o.anchor || 'middle', letter_spacing: o.ls, stroke_linejoin: 'round', stroke_linecap: 'round',
    }, extra), text.replace(/&/g, '&amp;'));
    const w1 = o.w1 || 0, w2 = o.w2 || 0;
    let s = '';
    if (o.shadow) {
      s += E('g', { filter: blur(o.sb ?? 4), transform: `translate(${o.sx ?? 0} ${o.sd ?? 6})` },
        base({ fill: o.shadow, stroke: o.shadow, stroke_width: (w1 + w2) * 2 + 2, opacity: o.so ?? 0.55 }));
    }
    if (o.out2 && w2) s += base({ fill: o.out2, stroke: o.out2, stroke_width: (w1 + w2) * 2 });
    if (o.out1 && w1) s += base({ fill: o.out1, stroke: o.out1, stroke_width: w1 * 2 });
    s += base({ fill: o.fill, class: 'main' });
    if (o.shine) s += base({ fill: 'none', stroke: o.shine, stroke_width: 1.2, stroke_opacity: 0.6, transform: 'translate(0 -1.5)' });
    TXT.push({ id, maxW: o.maxW || 660, size: o.size, pad: (w1 + w2) });
    const key = `${o.style || 'normal'} ${o.weight || 400} ${o.size}px '${o.font}'`;
    FONTS.set(key, (FONTS.get(key) || '') + text);
    return E('g', { id, transform: o.rot ? `rotate(${o.rot} ${o.x} ${o.y})` : undefined }, s);
  }

  // ---- hoàn tất ----
  async function finish() {
    const svg = document.getElementById('c');
    svg.innerHTML = '<defs>' + D.join('') + '</defs>' + B.join('');
    try {
      await Promise.all([...FONTS].map(([spec, txt]) => document.fonts.load(spec, txt)));
      await document.fonts.ready;
    } catch (e) { /* tiếp tục */ }
    const warn = [];
    const cv = document.createElement('canvas').getContext('2d');
    for (const t of TXT) {
      const g = document.getElementById(t.id);
      const main = g.querySelector('text.main');
      let bb = main.getBBox();
      const room = t.maxW - 2 * t.pad;
      if (bb.width > room) {
        const k = room / bb.width;
        g.querySelectorAll('text').forEach((n) => n.setAttribute('font-size', (t.size * k).toFixed(2)));
        warn.push('co chữ "' + main.textContent + '" x' + k.toFixed(2));
      }
      // đo vùng mực thật (canvas measureText), tính cả xoay + bề dày viền
      const fs = parseFloat(main.getAttribute('font-size'));
      cv.font = `${main.getAttribute('font-style')} ${main.getAttribute('font-weight')} ${fs}px ${main.getAttribute('font-family')}`;
      cv.textAlign = 'center';
      const m = cv.measureText(main.textContent);
      const x = +main.getAttribute('x'), y = +main.getAttribute('y');
      const pts = [[x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent], [x + m.actualBoundingBoxRight, y - m.actualBoundingBoxAscent],
        [x - m.actualBoundingBoxLeft, y + m.actualBoundingBoxDescent], [x + m.actualBoundingBoxRight, y + m.actualBoundingBoxDescent]];
      const rot = ((/rotate\(([-\d.]+)/.exec(g.getAttribute('transform') || '') || [0, 0])[1] * Math.PI) / 180;
      const rp = pts.map(([px, py]) => [x + (px - x) * Math.cos(rot) - (py - y) * Math.sin(rot), y + (px - x) * Math.sin(rot) + (py - y) * Math.cos(rot)]);
      const L = Math.min(...rp.map((p) => p[0])) - t.pad, Rr = Math.max(...rp.map((p) => p[0])) + t.pad;
      const T = Math.min(...rp.map((p) => p[1])) - t.pad, Bb = Math.max(...rp.map((p) => p[1])) + t.pad;
      if (L < 12 || Rr > W - 12 || T < 8 || Bb > H - 8) warn.push('SÁT/TRÀN LỀ: "' + main.textContent + '" ' + [L, T, Rr, Bb].map(Math.round).join(','));
    }
    window.__warn = warn;
    window.__ready = true;
  }

  Object.assign(window, {
    W, H, E, G, add, def, rng, lg, rg, blur, glow, sparkle, glitter, bokeh, heart, HEART, leaf,
    ROSES, rose, roseBud, roseBunch, bird, cloud, cuteCloud, face, moon, LOTUS, lotus, lilypad, fancy, finish, uid,
    lantern, flower5, coin, starPath, star5, sunflower, clover, petalPath, butterfly,
  });
})();
