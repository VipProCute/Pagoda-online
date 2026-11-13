// T-091 · Lớp vẽ độc lập; chỉ đọc thế cờ công khai, không quyết định nước đi.
'use strict';

import * as THREE from '/vendor/three/three.module.js?v=0.187.0';

const FILES = 'abcdefghijklmno';
const GO_FILES = 'ABCDEFGHJKLMNOPQRST';
const HAN = { r: ['俥', '車'], n: ['傌', '馬'], b: ['相', '象'], a: ['仕', '士'], k: ['帥', '將'], c: ['炮', '砲'], p: ['兵', '卒'] };
const VIET = { r: 'Xe', n: 'Mã', b: 'Tượng', a: 'Sĩ', k: 'Tướng', c: 'Pháo', p: 'Tốt' };

export function boardLayout(game, size) {
  if (!['chess', 'xiangqi', 'jieqi', 'go', 'gomoku'].includes(game)) throw new Error('Môn cờ chưa hỗ trợ.');
  const chess = game === 'chess', stones = game === 'go' || game === 'gomoku';
  const n = stones ? (size || (game === 'go' ? 9 : 15)) : 0;
  if (stones && !(game === 'go' ? [9, 13, 19].includes(n) : Number.isInteger(n) && n >= 5 && n <= 15)) {
    throw new Error('Kích thước bàn không hợp lệ.');
  }
  return { game, chess, stones, cols: chess ? 8 : stones ? n : 9, rows: chess ? 8 : stones ? n : 10 };
}

export function squareAtWorld(layout, x, z, flip = false) {
  const { cols, rows, chess, game } = layout;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  let col = Math.round(x + (cols - 1) / 2), row = Math.round((rows - 1) / 2 - z);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  if (!chess && Math.hypot(x - (col - (cols - 1) / 2), z - ((rows - 1) / 2 - row)) > 0.62) return null;
  if (flip) { col = cols - 1 - col; row = rows - 1 - row; }
  return (game === 'go' ? GO_FILES : FILES)[col] + (row + (game === 'xiangqi' || game === 'jieqi' ? 0 : 1));
}

function squareIndex(layout, name) {
  if (typeof name !== 'string') return -1;
  const files = layout.game === 'go' ? GO_FILES : FILES;
  const col = files.indexOf(name[0]);
  const row = Number(name.slice(1)) - (layout.game === 'xiangqi' || layout.game === 'jieqi' ? 0 : 1);
  return col >= 0 && col < layout.cols && Number.isInteger(row) && row >= 0 && row < layout.rows ? row * layout.cols + col : -1;
}

// Ghép danh tính hình vẽ theo ô cũ và last, kể cả nhập thành, bắt tốt qua đường, phong cấp.
// Chỉ suy diễn hoạt ảnh cho một nước có from/to; ảnh chụp nhảy xa được dựng lại ngay.
export function transitionPieces(before, after, last, layout) {
  const from = squareIndex(layout, last && last[0]), to = squareIndex(layout, last && last[layout.stones ? 0 : 1]);
  const changed = after.reduce((out, ch, i) => { if ((before[i] || '') !== (ch || '')) out.push(i); return out; }, []);
  const move = layout.stones
    ? to >= 0 && !before[to] && !!after[to] && changed.every(i => i === to || !after[i])
    : from >= 0 && to >= 0 && from !== to && !!before[from] && !after[from] && !!after[to] && changed.length <= 4;
  const pairs = new Map(), used = new Set();
  after.forEach((ch, i) => { if (ch && ch === before[i] && !(move && i === to)) { pairs.set(i, i); used.add(i); } });
  if (move && !layout.stones) { pairs.set(to, from); used.add(from); }
  after.forEach((ch, i) => {
    if (!ch || pairs.has(i)) return;
    const old = move ? before.findIndex((value, j) => value === ch && !used.has(j) && !after[j] && j !== to) : -1;
    if (old >= 0) { pairs.set(i, old); used.add(old); }
  });
  return { move, pairs, captured: move ? before.flatMap((ch, i) => ch && !used.has(i) ? [i] : []) : [] };
}

/** createBoard3D({canvas, game}) → setState(o), onPick(fn), setFlip, resize, dispose.
 * o suit KydaoDraw.draw; vây thêm size, caro nhận board hoặc cells của luật (hàng trên trước).
 * Không dùng addon, mô hình hoặc ảnh bên thứ ba. Tài nguyên GPU được dùng chung trong mỗi bàn.
 */
export function createBoard3D({ canvas, game }) {
  let layout = boardLayout(game), state = {}, previous = [], pieces = new Map(), captured = [];
  let flip = false, pick = () => {}, stopped = false, frame = 0, drag = null, pinching = false;
  let yaw = 0.16, elevation = 0.93, zoom = 1, width = 0, height = 0, vi = null;
  const pointers = new Map(), resources = new Set(), templates = new Map();
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const oldTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';
  const keep = resource => { resources.add(resource); return resource; };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#28362f');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 180);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const board = new THREE.Group(), markers = new THREE.Group();
  scene.add(board); board.add(markers);
  scene.add(new THREE.HemisphereLight('#fff1d7', '#526556', 2.3));
  const key = new THREE.DirectionalLight('#ffe3b5', 3.4);
  key.position.set(-5, 12, 7); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -16;
  key.shadow.camera.right = key.shadow.camera.top = 16;
  key.shadow.camera.far = 45; key.shadow.normalBias = 0.035; key.shadow.bias = -0.00015;
  key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight('#dce8f2', 1.5); rim.position.set(5, 7, -7); scene.add(rim);

  const material = (color, roughness = 0.38, extra = {}) => keep(new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
  function texture(w, h, paint) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    const map = keep(new THREE.CanvasTexture(c)); map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  const grain = texture(512, 512, ctx => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = 'rgba(68,34,12,' + (0.018 + (i % 5) * 0.008) + ')';
      ctx.lineWidth = 0.4 + (i % 3) * 0.35; ctx.beginPath();
      for (let x = 0; x <= 512; x += 16) {
        const y = i * 3.4 + Math.sin(x / 85 + i * 0.75) * 3 + Math.sin(x / 39 + i) * 0.8;
        if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  const ivory = material('#f7dfae', 0.26, { map: grain, metalness: 0.04 });
  const ebony = material('#292d29', 0.25, { map: grain, metalness: 0.07 });
  const wood = material('#78462b', 0.34, { map: grain });
  const brass = material('#bd9355', 0.3, { metalness: 0.55 });
  const diskWood = material('#ddae69', 0.34, { map: grain });
  function mesh(geometry, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(keep(geometry), mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const floor = mesh(new THREE.PlaneGeometry(180, 180), material('#354b3e', 0.95), scene, 0, -0.5);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  let slab, trim, surface, boardMaterial;

  function boardTexture() {
    const w = layout.cols + (layout.chess ? 1.2 : 0.4), d = layout.rows + (layout.chess ? 1.2 : 0.4);
    return texture(1536, Math.round(1536 * d / w), (ctx, tw, th) => {
      ctx.scale(tw / w, th / d); ctx.translate(w / 2, d / 2);
      ctx.fillStyle = layout.chess ? '#9b683e' : '#e9c48a'; ctx.fillRect(-w / 2, -d / 2, w, d);
      if (layout.chess) for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (c + r) % 2 ? '#ecd5a4' : '#886044'; ctx.fillRect(c - 4, 3 - r, 1, 1);
      }
      ctx.lineWidth = 0.012;
      for (let i = 0; i < 220; i++) {
        const z = -d / 2 + d * i / 220;
        ctx.strokeStyle = 'rgba(75,39,13,.07)'; ctx.beginPath(); ctx.moveTo(-w / 2, z);
        ctx.bezierCurveTo(-w / 6, z + Math.sin(i) * 0.08, w / 6, z - 0.04, w / 2, z); ctx.stroke();
      }
      const x = c => c - (layout.cols - 1) / 2, z = r => (layout.rows - 1) / 2 - r;
      const line = (c, r, cc, rr) => { ctx.beginPath(); ctx.moveTo(x(c), z(r)); ctx.lineTo(x(cc), z(rr)); ctx.stroke(); };
      ctx.strokeStyle = '#654522'; ctx.lineWidth = 0.025;
      if (!layout.chess) {
        for (let r = 0; r < layout.rows; r++) line(0, r, layout.cols - 1, r);
        for (let c = 0; c < layout.cols; c++) {
          if (layout.stones || c === 0 || c === 8) line(c, 0, c, layout.rows - 1);
          else { line(c, 0, c, 4); line(c, 5, c, 9); }
        }
        if (!layout.stones) {
          for (const r of [0, 7]) { line(3, r, 5, r + 2); line(5, r, 3, r + 2); }
          ctx.font = 'bold .38px "SimSun", "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#71502e'; ctx.fillText(state.vi ? 'Sở Hà' : '楚河', -2, 0); ctx.fillText(state.vi ? 'Hán Giới' : '漢界', 2, 0);
          // Dấu chân pháo và tốt, ngắt ở đường biên.
          ctx.lineWidth = 0.018;
          for (const r of [2, 3, 6, 7]) for (const c of (r === 2 || r === 7 ? [1, 7] : [0, 2, 4, 6, 8])) {
            for (const dx of [-1, 1]) for (const dz of [-1, 1]) {
              if (c + dx < 0 || c + dx > 8) continue;
              ctx.beginPath(); ctx.moveTo(x(c) + dx * 0.22, z(r) + dz * 0.09);
              ctx.lineTo(x(c) + dx * 0.09, z(r) + dz * 0.09); ctx.lineTo(x(c) + dx * 0.09, z(r) + dz * 0.22); ctx.stroke();
            }
          }
        } else {
          const mid = (layout.cols - 1) / 2;
          const stars = layout.cols === 9 ? [2, mid, 6] : [3, mid, layout.cols - 4];
          for (const c of stars) for (const r of stars) {
            ctx.beginPath(); ctx.arc(x(c), z(r), 0.07, 0, Math.PI * 2); ctx.fillStyle = '#654522'; ctx.fill();
          }
        }
      }
      ctx.strokeStyle = '#e2bb72'; ctx.lineWidth = 0.025; ctx.strokeRect(-w / 2 + 0.12, -d / 2 + 0.12, w - 0.24, d - 0.24);
      ctx.strokeStyle = '#58361f'; ctx.lineWidth = 0.04; ctx.strokeRect(-w / 2 + 0.18, -d / 2 + 0.18, w - 0.36, d - 0.36);
      if (layout.chess) {
        ctx.fillStyle = '#f5dfaf'; ctx.font = 'bold .23px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < 8; i++) {
          ctx.fillText(FILES[i], i - 3.5, 4.32); ctx.fillText(String(i + 1), -4.32, 3.5 - i);
          ctx.save(); ctx.rotate(Math.PI); ctx.fillText(FILES[7 - i], i - 3.5, 4.32); ctx.fillText(String(8 - i), -4.32, 3.5 - i); ctx.restore();
        }
      }
    });
  }

  function rebuildBoard() {
    for (const m of [slab, trim, surface]) if (m) { board.remove(m); resources.delete(m.geometry); m.geometry.dispose(); }
    const w = layout.cols + (layout.chess ? 1.2 : 0.4), d = layout.rows + (layout.chess ? 1.2 : 0.4);
    slab = mesh(new THREE.BoxGeometry(w + 0.25, 0.32, d + 0.25), wood, board, 0, -0.22);
    trim = mesh(new THREE.BoxGeometry(w + 0.12, 0.045, d + 0.12), brass, board, 0, -0.043);
    if (boardMaterial) { resources.delete(boardMaterial.map); boardMaterial.map.dispose(); resources.delete(boardMaterial); boardMaterial.dispose(); }
    boardMaterial = material('#ffffff', 0.48, { map: boardTexture() });
    surface = mesh(new THREE.PlaneGeometry(w, d), boardMaterial, board);
    surface.rotation.x = -Math.PI / 2; surface.castShadow = false;
    vi = !!state.vi;
  }

  function lathe(points, mat, group) {
    return mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), 40), mat, group);
  }
  function ring(group, radius, y, mat, tube = 0.025) {
    const m = mesh(new THREE.TorusGeometry(radius, tube, 8, 40), mat, group, 0, y); m.rotation.x = Math.PI / 2;
  }
  function chessPiece(ch) {
    const group = new THREE.Group(), light = ch === ch.toUpperCase(), mat = light ? ivory : ebony, type = ch.toLowerCase();
    lathe([[0, 0.015], [0.27, 0.015], [0.31, 0.04], [0.32, 0.08], [0.31, 0.12], [0.26, 0.15],
      [0.26, 0.19], [0.22, 0.22], [0.18, 0.25], [0.14, 0.33], [0.115, 0.45], [0.13, 0.54],
      [0.19, 0.57], [0.195, 0.60], [0.16, 0.63], [0, 0.63]], mat, group);
    ring(group, 0.285, 0.115, mat, 0.018); ring(group, 0.17, 0.595, mat, 0.016);
    if (type === 'p') {
      mesh(new THREE.SphereGeometry(0.175, 24, 16), mat, group, 0, 0.77);
      group.scale.setScalar(0.87);
    } else if (type === 'n') {
      const shape = new THREE.Shape();
      shape.moveTo(-0.23, 0); shape.bezierCurveTo(-0.22, 0.18, -0.1, 0.24, -0.12, 0.36);
      shape.lineTo(-0.28, 0.30); shape.lineTo(-0.34, 0.37); shape.lineTo(-0.28, 0.48);
      shape.lineTo(-0.10, 0.66); shape.lineTo(-0.07, 0.79); shape.lineTo(0.02, 0.70);
      shape.lineTo(0.12, 0.75); shape.bezierCurveTo(0.32, 0.50, 0.22, 0.22, 0.26, 0); shape.closePath();
      const head = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.17, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 16 }), mat, group, 0, 0.55, -0.085);
      head.rotation.y = light ? -Math.PI / 2 : Math.PI / 2;
      // Mắt ngựa chạm nổi hai bên, không dùng ảnh ngoài.
      const eyeMat = light ? ebony : ivory;
      for (const side of [-1, 1]) {
        const eye = mesh(new THREE.SphereGeometry(0.023, 10, 8), eyeMat, head, -0.115, 0.57, side < 0 ? -0.038 : 0.208);
        eye.scale.z = 0.4;
      }
    } else if (type === 'r') {
      lathe([[0, 0.59], [0.19, 0.59], [0.22, 0.65], [0.23, 0.91], [0.27, 0.95], [0.27, 1.04], [0, 1.04]], mat, group);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        const tooth = mesh(new THREE.BoxGeometry(0.15, 0.14, 0.14), mat, group, Math.cos(a) * 0.2, 1.08, Math.sin(a) * 0.2); tooth.rotation.y = -a;
      }
    } else if (type === 'b') {
      lathe([[0, 0.60], [0.13, 0.60], [0.18, 0.70], [0.19, 0.80], [0.13, 0.94], [0.04, 1.08], [0, 1.10]], mat, group);
      mesh(new THREE.SphereGeometry(0.045, 16, 10), mat, group, 0, 1.13);
      const cut = mesh(new THREE.BoxGeometry(0.025, 0.20, 0.015), light ? wood : brass, group, 0.07, 0.96, 0.115); cut.rotation.z = -0.45;
    } else {
      lathe([[0, 0.61], [0.17, 0.61], [0.12, 0.72], [0.105, 0.86], [0.19, 0.90], [0.22, 0.96], [0.20, 1.01], [0, 1.01]], mat, group);
      if (type === 'q') {
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4, x = Math.cos(a) * 0.18, z = Math.sin(a) * 0.18;
          const tip = mesh(new THREE.ConeGeometry(0.06, 0.19, 12), mat, group, x, 1.08, z);
          tip.rotation.z = -Math.cos(a) * 0.3; tip.rotation.x = Math.sin(a) * 0.3;
          mesh(new THREE.SphereGeometry(0.045, 12, 8), mat, group, x * 1.15, 1.18, z * 1.15);
        }
        mesh(new THREE.SphereGeometry(0.07, 16, 12), mat, group, 0, 1.12);
      } else {
        mesh(new THREE.SphereGeometry(0.115, 20, 12), mat, group, 0, 1.08);
        mesh(new THREE.BoxGeometry(0.065, 0.31, 0.065), mat, group, 0, 1.29);
        mesh(new THREE.BoxGeometry(0.23, 0.065, 0.065), mat, group, 0, 1.33);
      }
      group.scale.y = 1.07;
    }
    return group;
  }

  function diskPiece(ch) {
    const group = new THREE.Group(), red = ch === ch.toUpperCase(), t = ch.toLowerCase();
    lathe([[0, 0.02], [0.35, 0.02], [0.40, 0.05], [0.425, 0.10], [0.425, 0.23], [0.40, 0.28], [0, 0.28]], diskWood, group);
    const map = texture(256, 256, ctx => {
      ctx.clearRect(0, 0, 256, 256); ctx.strokeStyle = red ? '#992e24' : '#302a20'; ctx.lineWidth = 3;
      for (const r of [110, 99]) { ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke(); }
      // X/x ne contient aucune identité cachée; seul le dos décoratif est dessiné.
      if (t === 'x') {
        ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = i * Math.PI / 8, r = i % 2 ? 28 : 57;
          if (!i) ctx.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); else ctx.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
        }
        ctx.stroke(); return;
      }
      const word = state.vi ? VIET[t] : HAN[t] && HAN[t][red ? 0 : 1];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + (state.vi ? (word && word.length > 4 ? 43 : 55) : 125) + 'px "SimSun", "Times New Roman", serif';
      ctx.fillStyle = '#fff1c8'; ctx.fillText(word || '?', 129, 136);
      ctx.fillStyle = red ? '#992e24' : '#302a20'; ctx.fillText(word || '?', 128, 133);
    });
    const face = mesh(new THREE.PlaneGeometry(0.80, 0.80), material('#ffffff', 0.42, { map, transparent: true, depthWrite: false }), group, 0, 0.285);
    face.rotation.x = -Math.PI / 2; face.castShadow = false;
    return group;
  }

  function template(ch) {
    const id = layout.game + ':' + ch + ':' + !!state.vi;
    if (!templates.has(id)) {
      let g;
      if (layout.stones) {
        g = new THREE.Group();
        const m = mesh(new THREE.SphereGeometry(0.43, 28, 16), ch === 'a' ? ebony : ivory, g, 0, 0.14); m.scale.y = 0.34;
        if (layout.game === 'gomoku') {
          const mat = ch === 'a' ? ivory : ebony;
          if (ch === 'a') for (const angle of [-Math.PI / 4, Math.PI / 4]) {
            const mark = mesh(new THREE.BoxGeometry(0.40, 0.008, 0.045), mat, g, 0, 0.289); mark.rotation.y = angle;
          }
          else ring(g, 0.17, 0.289, mat, 0.022);
        }
      } else g = layout.chess ? chessPiece(ch) : diskPiece(ch);
      templates.set(id, g);
    }
    return { id, group: templates.get(id).clone(true) };
  }
  const targetAt = index => new THREE.Vector3(index % layout.cols - (layout.cols - 1) / 2, 0.015, (layout.rows - 1) / 2 - Math.floor(index / layout.cols));
  function visual(ch, old) {
    const id = layout.game + ':' + ch + ':' + !!state.vi;
    if (old && old.id === id) return old;
    const v = template(ch), record = { ...v, ch, target: old ? old.target.clone() : new THREE.Vector3(), from: old ? old.from.clone() : new THREE.Vector3(), started: old ? old.started : 0 };
    if (old) {
      record.group.position.copy(old.group.position);
      if (old.ch === ch) record.group.scale.copy(old.group.scale);
      board.remove(old.group);
    }
    board.add(record.group); return record;
  }
  function travel(record, target, animate) {
    record.from.copy(record.group.position); record.target.copy(target);
    record.started = animate && !media.matches ? performance.now() : 0;
    if (!record.started) record.group.position.copy(target);
  }
  const markGeometry = keep(new THREE.PlaneGeometry(0.92, 0.92));
  const dotGeometry = keep(new THREE.CircleGeometry(0.12, 24));
  const captureGeometry = keep(new THREE.RingGeometry(0.43, 0.49, 40));
  const markMats = ['#e4b94d', '#5eae76', '#c43d30', '#33714d'].map(color => material(color, 0.7, { transparent: true, opacity: 0.58, depthWrite: false }));
  function updateMarks() {
    markers.clear();
    const add = (name, kind) => {
      const index = squareIndex(layout, name); if (index < 0) return;
      const occupied = kind === 3 && !!previous[index];
      const m = new THREE.Mesh(kind === 3 ? (occupied ? captureGeometry : dotGeometry) : markGeometry, markMats[occupied ? 2 : kind]);
      m.rotation.x = -Math.PI / 2; m.position.copy(targetAt(index)); m.position.y = 0.022 + kind * 0.002; markers.add(m);
    };
    (state.last || []).forEach(n => add(n, 0)); add(state.selected, 1); add(state.checkSq, 2);
    (state.targets || []).forEach(n => add(n, 3));
  }
  function orbit() {
    const aspect = width / height || 1;
    const distance = Math.max((layout.rows + 1) * 1.55, (layout.cols + 3) / aspect * 1.55) * zoom;
    camera.position.set(Math.sin(yaw) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, Math.cos(yaw) * Math.cos(elevation) * distance);
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  }
  function render(now) {
    frame = 0; if (stopped) return;
    let moving = false;
    for (const p of [...pieces.values(), ...captured]) if (p.started) {
      const t = media.matches ? 1 : Math.min(1, (now - p.started) / 360), eased = t * t * (3 - 2 * t);
      p.group.position.lerpVectors(p.from, p.target, eased);
      if (t === 1) p.started = 0; else moving = true;
    }
    renderer.render(scene, camera);
    if (moving) requestRender();
  }
  function requestRender() { if (!stopped && !frame) frame = requestAnimationFrame(render); }
  function resize() {
    if (stopped) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); orbit(); requestRender();
  }
  function setFlip(value) { flip = !!value; board.rotation.y = flip ? Math.PI : 0; requestRender(); }
  function setState(o) {
    if (stopped) return;
    if (o.game && o.game !== game) throw new Error('Môn cờ không khớp với bàn.');
    const nextLayout = boardLayout(game, o.size || (layout.stones && Math.sqrt((o.board || o.cells || []).length)) || undefined);
    const resized = nextLayout.cols !== layout.cols;
    state = { ...o }; layout = nextLayout;
    let next = Array.from(o.board || o.cells || []);
    if (game === 'gomoku' && !o.board) next = Array.from({ length: layout.rows }, (_, r) => next.slice((layout.rows - 1 - r) * layout.cols, (layout.rows - r) * layout.cols)).flat();
    if (next.length !== layout.cols * layout.rows) throw new Error('Số ô không khớp với bàn.');
    if (resized) { previous = []; for (const p of pieces.values()) board.remove(p.group); pieces.clear(); }
    const languageChanged = vi !== !!o.vi;
    if (!surface || resized || languageChanged) rebuildBoard();
    if (languageChanged) captured = captured.map(record => visual(record.ch, record));
    const delta = transitionPieces(previous, next, o.last, layout), updated = new Map(), retained = new Set();
    next.forEach((ch, index) => {
      if (!ch) return;
      const oldIndex = delta.pairs.get(index), old = pieces.get(oldIndex);
      const record = visual(ch, old); if (old) retained.add(old);
      if (!old) record.group.position.copy(targetAt(index));
      // Une sélection répétée ne redémarre pas une glissade en cours.
      const target = targetAt(index);
      if (!old || !record.target.equals(target)) travel(record, target, delta.move && !!old);
      updated.set(index, record);
    });
    if (!delta.move && next.some((ch, i) => ch !== previous[i])) {
      for (const p of captured) board.remove(p.group); captured = [];
    }
    for (const [index, record] of pieces) if (!retained.has(record)) {
      if (delta.captured.includes(index)) {
        captured.push(record);
        const side = layout.stones ? record.ch === 'a' : record.ch === record.ch.toUpperCase();
        const slot = captured.filter(p => (layout.stones ? p.ch === 'a' : p.ch === p.ch.toUpperCase()) === side).length - 1;
        const edge = (layout.cols / 2 + 0.95 + Math.floor(slot / layout.rows) * 0.65) * (side ? -1 : 1);
        travel(record, new THREE.Vector3(edge, -0.18, (slot % layout.rows) * 0.65 - (layout.rows - 1) * 0.325), true);
        record.group.scale.multiplyScalar(0.68);
      } else board.remove(record.group);
    }
    pieces = updated; previous = next; setFlip(o.flip == null ? flip : o.flip); updateMarks(); orbit(); requestRender();
  }

  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function choose(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      const name = squareAtWorld(layout, hit.x, hit.z, flip); if (name) pick(name);
    }
  }
  const gap = () => { const p = [...pointers.values()]; return p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0; };
  function down(e) {
    if (e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) { pinching = false; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, distance: 0 }; }
    else { pinching = true; drag = null; }
  }
  function move(e) {
    if (!pointers.has(e.pointerId)) return;
    const oldGap = gap(), p = pointers.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const newGap = gap(); if (oldGap > 0 && newGap > 0) zoom = THREE.MathUtils.clamp(zoom * oldGap / newGap, 0.65, 1.7);
    } else if (drag) {
      drag.distance = Math.max(drag.distance, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
      if (drag.distance > 6) { yaw -= dx * 0.008; elevation = THREE.MathUtils.clamp(elevation + dy * 0.006, 0.42, 1.49); }
    }
    orbit(); requestRender();
  }
  function up(e) {
    if (e.type === 'pointerup' && !pinching && drag && drag.id === e.pointerId && drag.distance <= 6) choose(e);
    pointers.delete(e.pointerId); drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  }
  function wheel(e) { e.preventDefault(); zoom = THREE.MathUtils.clamp(zoom * Math.exp(e.deltaY * 0.001), 0.65, 1.7); orbit(); requestRender(); }
  function keydown(e) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') yaw -= 0.12;
    if (e.key === 'ArrowRight') yaw += 0.12;
    if (e.key === 'ArrowUp') elevation = Math.min(1.49, elevation + 0.08);
    if (e.key === 'ArrowDown') elevation = Math.max(0.42, elevation - 0.08);
    if (e.key === '+' || e.key === '=') zoom = Math.max(0.65, zoom * 0.9);
    if (e.key === '-') zoom = Math.min(1.7, zoom / 0.9);
    orbit(); requestRender();
  }
  const events = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, lostpointercapture: up, wheel, keydown };
  for (const [name, fn] of Object.entries(events)) canvas.addEventListener(name, fn, name === 'wheel' ? { passive: false } : undefined);
  media.addEventListener('change', requestRender);
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return {
    setState, setFlip, resize,
    onPick(fn) { pick = typeof fn === 'function' ? fn : () => {}; },
    dispose() {
      if (stopped) return; stopped = true; cancelAnimationFrame(frame); observer.disconnect();
      for (const [name, fn] of Object.entries(events)) canvas.removeEventListener(name, fn);
      for (const id of pointers.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      pointers.clear(); media.removeEventListener('change', requestRender); canvas.style.touchAction = oldTouchAction;
      for (const resource of resources) resource.dispose();
      resources.clear(); templates.clear(); pieces.clear(); captured = []; scene.clear();
      key.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); pick = () => {};
    }
  };
}
