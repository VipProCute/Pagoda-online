/*
 * Cảnh chánh điện vẽ bằng Canvas 2D: tượng Phật, bàn thờ, bát hương, khói nhang, tủ Tàng Kinh Các,
 * và nhân vật mặc áo dài của mọi người đang có mặt (tên trên đầu, bong bóng chat, thả tim, vái lạy,
 * mic khi đang nói chuyện, sách khi đang đọc kinh, hào quang cúng dường).
 * Toạ độ sàn: x 0..1 (trái → phải), z 0..1 (z = 0 sát bàn thờ, z = 1 phía trước).
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const COLORS = [
    { n: 'Đỏ son', c: '#c0392b' }, { n: 'Vàng nghệ', c: '#e2a93b' }, { n: 'Hồng sen', c: '#e48aa5' }, { n: 'Xanh ngọc', c: '#3fa58d' },
    { n: 'Tím Huế', c: '#8e5fb8' }, { n: 'Trắng ngà', c: '#efe8da' }, { n: 'Xanh lam', c: '#3b78c2' }, { n: 'Cam', c: '#e07b39' },
    { n: 'Áo tràng lam', c: '#7b8ea6' }, { n: 'Áo tràng nâu', c: '#8a6a4c' }, { n: 'Xanh lá', c: '#5f9a4a' }, { n: 'Đen tuyền', c: '#2c2a30' }
  ];
  const HAIRS = ['Tóc dài', 'Búi tóc', 'Tóc ngắn', 'Khăn vấn'];
  const SKIN = '#f0c9a4', HAIR = '#1f1612';
  const reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const f = c => Math.round((t - c) * p + c);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function rrect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }

  /* ---------------- nhân vật áo dài ---------------- */
  function drawHead(g, look, front, col) {
    const hy = -88, r = 11.5, h = look.h, male = look.g === 'nam';
    const turban = male ? '#1d1a1f' : shade(col, -0.32);
    if (!front) {
      g.fillStyle = HAIR; circle(g, 0, hy, r + 0.5);
      if (h === 0) { g.beginPath(); g.moveTo(-9, hy + 2); g.lineTo(-7.5, -57); g.quadraticCurveTo(0, -53, 7.5, -57); g.lineTo(9, hy + 2); g.closePath(); g.fill(); }
      if (h === 1) { g.fillStyle = '#2b1f19'; circle(g, 0, hy + 3, 6.2); }
      if (h === 3) { g.fillStyle = turban; g.beginPath(); g.ellipse(0, hy - 4, r + 2.6, 6.5, 0, 0, TAU); g.fill(); g.strokeStyle = shade(col, -0.5); g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, hy - 4, r + 1, 4, 0, 0, TAU); g.stroke(); }
      return;
    }
    g.fillStyle = SKIN; circle(g, 0, hy, r);
    g.fillStyle = HAIR;
    if (h === 3) {
      g.fillStyle = turban; g.beginPath(); g.ellipse(0, hy - 7, r + 2.6, 6.8, 0, 0, TAU); g.fill();
      g.strokeStyle = shade(col, -0.5); g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, hy - 7, r + 1, 4.2, 0, 0, TAU); g.stroke();
    } else {
      g.beginPath(); g.arc(0, hy, r + 0.6, Math.PI, 0); g.lineTo(r + 0.6, hy - 1); g.quadraticCurveTo(3, hy - 8, -r - 0.6, hy); g.closePath(); g.fill();
      if (h === 0) { g.fillRect(-r - 0.6, hy - 2, 3.6, 17); g.fillRect(r - 3, hy - 2, 3.6, 17); }
      if (h === 1) circle(g, 0, hy - r - 2, 5.6);
    }
    g.fillStyle = '#2a1a12'; circle(g, -4, hy + 1, 1.3); circle(g, 4, hy + 1, 1.3);
    g.fillStyle = 'rgba(232,120,110,.35)'; circle(g, -6.5, hy + 4.5, 2); circle(g, 6.5, hy + 4.5, 2);
    g.strokeStyle = '#9b4a3c'; g.lineWidth = 1; g.beginPath(); g.arc(0, hy + 4.6, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  // Tư thế luận võ (chỉ dùng ở Sân đấu): tay ra đòn, chân đá, thủ, khuỵu gối, nghiêng người về phía đối thủ.
  // pose = { dir: 1|-1 (đối thủ ở bên nào), arm, kick, guard, crouch: 0..1, lean: -1..1 (dương là nghiêng về phía đối thủ) }
  const plerp = (a, b, k) => a + (b - a) * k;
  function poseArms(g, pose, sw, sleeve, front) {
    const d = pose.dir < 0 ? -1 : 1, arm = clamp(pose.arm || 0, 0, 1), gd = clamp(pose.guard || 0, 0, 1);
    // tay trước (phía đối thủ): chắp tay → thủ trước mặt → duỗi thẳng ra đòn
    const lx = plerp(plerp(d * 2.5, d * 7, gd), d * (sw + 27), arm), ly = plerp(plerp(-60, -77, gd), -69, arm);
    // tay sau: thủ ngang ngực, ra đòn thì thu về sát sườn
    const rk = Math.max(gd, arm * 0.8), rx = plerp(-d * 2.5, d * 1, rk), ry = plerp(-60, -72, rk);
    const lsx = d * (sw - 1.5), rsx = -d * (sw - 1.5);
    g.strokeStyle = sleeve; g.lineWidth = front ? 5.5 : 5;
    g.beginPath(); g.moveTo(rsx, -71); g.quadraticCurveTo(-d * (sw + 1), -55 - 8 * rk, rx, ry); g.stroke();
    g.beginPath(); g.moveTo(lsx, -71); g.quadraticCurveTo(plerp(d * (sw + 1), d * (sw + 8), arm), plerp(-55, -72, Math.max(arm, gd)), lx, ly); g.stroke();
    if (!front) return;
    g.fillStyle = SKIN;
    if (arm < 0.2 && gd < 0.2) { g.beginPath(); g.ellipse(0, -63.5, 2.6, 4.6, 0, 0, TAU); g.fill(); return; }
    circle(g, lx + d * 1.2, ly, 3); circle(g, rx, ry, 2.8);
  }
  // Vẽ ở hệ đơn vị: chân tại (0,0), cao ~100 đơn vị
  function drawAvatar(g, look, front, t, bow, walking, pose) {
    const col = (COLORS[look.c] || COLORS[0]).c, dk = shade(col, -0.28), lt = shade(col, 0.2), sleeve = shade(col, -0.1);
    const male = look.g === 'nam', sw = male ? 15 : 13, ww = male ? 12 : 9.5, hem = male ? 14 : 16.5;
    const bob = walking ? Math.abs(Math.sin(t * 9)) * 2.2 : 0;
    let sway = walking ? Math.sin(t * 9) * 1.6 : Math.sin(t * 1.3) * 0.4;
    g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(0, 0, 17, 4.5, 0, 0, TAU); g.fill();
    g.save(); g.translate(0, -bob);
    const kick = pose ? clamp(pose.kick || 0, 0, 1) : 0, pd = pose && pose.dir < 0 ? -1 : 1;
    if (pose) {
      const c = clamp(pose.crouch || 0, 0, 1), ln = clamp(pose.lean || 0, -1, 1);
      if (ln) g.rotate(ln * pd * 0.22);
      if (c) g.scale(1 + 0.07 * c, 1 - 0.17 * c);
      sway += pd * 7 * kick;
    }
    g.fillStyle = '#f3eee4';
    if (kick > 0.02) {                                       // chân trụ đứng yên, chân đá vung về phía đối thủ
      g.fillRect(pd > 0 ? -7 : 1.5, -16, 5.5, 14);
      g.fillStyle = '#3a2418'; rrect(g, pd > 0 ? -8 : 1, -3.2, 7, 3.2, 1.5); g.fill();
      const fx = pd * (4.5 + 30 * kick), fy = -6 - 38 * kick, kx = pd * (6 + 14 * kick), ky = plerp(-14, -36, kick);
      g.strokeStyle = '#f3eee4'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(pd * 4, -30); g.quadraticCurveTo(kx, ky, fx, fy); g.stroke();
      g.save(); g.translate(fx, fy); g.rotate(Math.atan2(fy - ky, fx - kx)); g.fillStyle = '#3a2418'; rrect(g, -1.5, -2, 7.5, 4, 1.8); g.fill(); g.restore();
    } else {
      if (look.npcFashion) g.fillStyle = SKIN;
      g.fillRect(-7, look.npcFashion ? -36 : -16, 5.5, look.npcFashion ? 34 : 14); g.fillRect(1.5, look.npcFashion ? -36 : -16, 5.5, look.npcFashion ? 34 : 14);
      g.fillStyle = '#3a2418'; rrect(g, -8, -3.2, 7, 3.2, 1.5); g.fill(); rrect(g, 1, -3.2, 7, 3.2, 1.5); g.fill();
    }
    // tà áo
    g.fillStyle = col;
    const hemY = look.npcFashion ? -33 : -11;
    g.beginPath(); g.moveTo(-ww, -50); g.lineTo(ww, -50); g.lineTo(hem + sway, hemY); g.quadraticCurveTo(sway, hemY + 3, -hem + sway, hemY); g.closePath(); g.fill();
    g.strokeStyle = dk; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(-ww + 1, -50); g.lineTo(-hem + sway + 2.5, hemY - 0.5); g.moveTo(ww - 1, -50); g.lineTo(hem + sway - 2.5, hemY - 0.5); g.stroke();
    // thân trên (cúi khi vái)
    g.save();
    if (bow > 0) { g.translate(0, -50); g.scale(1, 1 - 0.2 * bow); g.translate(0, 50 + 13 * bow); }
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-sw, -73); g.quadraticCurveTo(0, -77, sw, -73); g.lineTo(ww + 0.5, -49); g.lineTo(-ww - 0.5, -49); g.closePath(); g.fill();
    g.lineCap = 'round';
    if (front) {
      if (pose) poseArms(g, pose, sw, sleeve, true);
      else {
        g.strokeStyle = sleeve; g.lineWidth = 5.5;
        g.beginPath(); g.moveTo(-sw + 1.5, -71); g.quadraticCurveTo(-sw - 1, -55, -2.5, -60); g.moveTo(sw - 1.5, -71); g.quadraticCurveTo(sw + 1, -55, 2.5, -60); g.stroke();
        g.fillStyle = SKIN; g.beginPath(); g.ellipse(0, -63.5, 2.6, 4.6, 0, 0, TAU); g.fill();
      }
      g.fillStyle = dk; g.fillRect(-3.5, -78, 7, 4.5);
      g.strokeStyle = lt; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -74); g.quadraticCurveTo(6, -72, 9, -66); g.stroke();
    } else {
      if (pose && (pose.arm > 0.05 || pose.guard > 0.05)) poseArms(g, pose, sw, sleeve, false);
      else {
        g.strokeStyle = sleeve; g.lineWidth = 5;
        g.beginPath(); g.moveTo(-sw + 1, -71); g.quadraticCurveTo(-sw - 2.5, -60, -sw + 3.5, -52); g.moveTo(sw - 1, -71); g.quadraticCurveTo(sw + 2.5, -60, sw - 3.5, -52); g.stroke();
      }
      g.fillStyle = dk; g.fillRect(-3.5, -78, 7, 3.5);
    }
    g.fillStyle = SKIN; g.fillRect(-3, -81, 6, 5);
    if (look.npcFashion) { // trang phục dạo chơi vai trần, chỉ dành riêng cho NPC
      g.fillStyle = SKIN;
      g.beginPath(); g.moveTo(-sw + 1, -73); g.lineTo(-6, -75); g.lineTo(0, -67); g.lineTo(6, -75); g.lineTo(sw - 1, -73); g.lineTo(sw - 2, -68); g.lineTo(-sw + 2, -68); g.closePath(); g.fill();
    }
    drawHead(g, look, front, col);
    g.restore();
    g.restore();
  }

  /* ---------------- tượng Phật ---------------- */
  const PATH = root.Path2D ? {
    torso: new Path2D('M352,160 Q400,142 448,160 Q470,170 468,205 L463,248 L337,248 L332,205 Q330,170 352,160 Z'),
    robe: new Path2D('M358,162 Q402,200 458,236'),
    lapFold: new Path2D('M338,252 Q400,270 462,252')
  } : null;
  function petal(b, x, base, tip, w, fill) {
    b.beginPath(); b.moveTo(x - w, base);
    b.quadraticCurveTo(x - w - 1, base - (base - tip) * 0.6, x, tip);
    b.quadraticCurveTo(x + w + 1, base - (base - tip) * 0.6, x + w, base); b.closePath();
    b.fillStyle = fill; b.fill(); b.strokeStyle = '#6e4b1f'; b.lineWidth = 1; b.stroke();
  }
  // Đầu tượng giữa: ảnh meme "Phật nhảy tường" (cả búi tóc), cắt theo dáng đầu, viền mờ.
  // Tải xong thì xóa nền đã vẽ (bg = null) để khung hình sau vẽ lại có đầu mới.
  const FACE = root.Image ? new Image() : null;
  if (FACE) { FACE.onload = () => { bg = null; }; FACE.src = '/img/fx/phat-nhay-tuong-dau.webp'; }
  function statue(b, cx, pedY, s, face) {
    b.save(); b.translate(cx - 400 * s, pedY - 338 * s); b.scale(s, s);
    let gr = b.createRadialGradient(400, 170, 0, 400, 170, 172);
    gr.addColorStop(0, 'rgba(245,210,124,.52)'); gr.addColorStop(0.45, 'rgba(217,164,65,.16)'); gr.addColorStop(1, 'rgba(217,164,65,0)');
    b.fillStyle = gr; b.beginPath(); b.arc(400, 170, 172, 0, TAU); b.fill();
    b.strokeStyle = 'rgba(212,171,82,.3)'; b.lineWidth = 1.2; b.beginPath();
    for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, r2 = i % 2 ? 150 : 162; b.moveTo(400 + Math.cos(a) * 128, 160 + Math.sin(a) * 128); b.lineTo(400 + Math.cos(a) * r2, 160 + Math.sin(a) * r2); }
    b.stroke();
    b.strokeStyle = 'rgba(212,171,82,.45)'; b.lineWidth = 1.5; b.beginPath(); b.arc(400, 160, 112, 0, TAU); b.stroke();
    gr = b.createRadialGradient(400, 106, 0, 400, 106, 50); gr.addColorStop(0, 'rgba(255,224,140,.55)'); gr.addColorStop(1, 'rgba(255,224,140,0)');
    b.fillStyle = gr; b.beginPath(); b.arc(400, 106, 50, 0, TAU); b.fill();
    b.strokeStyle = 'rgba(232,195,110,.55)'; b.lineWidth = 1.2; b.beginPath(); b.arc(400, 106, 44, 0, TAU); b.stroke();
    // bệ
    gr = b.createLinearGradient(0, 296, 0, 338); gr.addColorStop(0, '#93261d'); gr.addColorStop(1, '#55120d');
    b.fillStyle = gr; b.fillRect(290, 296, 220, 42); b.strokeStyle = '#d4ab52'; b.lineWidth = 1.5; b.strokeRect(290, 296, 220, 42);
    b.strokeStyle = 'rgba(212,171,82,.45)'; b.lineWidth = 1; b.strokeRect(300, 304, 200, 26);
    b.fillStyle = '#6e4b1f'; b.beginPath(); b.ellipse(400, 291, 122, 12, 0, 0, TAU); b.fill();
    [340, 370, 400, 430, 460].forEach(x => petal(b, x, 288, 256, 15, '#b78637'));
    const gold = b.createLinearGradient(0, 66, 0, 280); gold.addColorStop(0, '#f1d184'); gold.addColorStop(0.55, '#cf9f45'); gold.addColorStop(1, '#8e6424');
    const side = b.createLinearGradient(330, 0, 470, 0); side.addColorStop(0, '#9c702a'); side.addColorStop(0.45, '#f0cd7c'); side.addColorStop(1, '#946827');
    b.fillStyle = gold; b.fillRect(389, 130, 22, 20);
    if (PATH) { b.fillStyle = side; b.fill(PATH.torso); b.strokeStyle = 'rgba(142,100,36,.6)'; b.lineWidth = 2; b.stroke(PATH.robe); }
    b.fillStyle = gold; b.beginPath(); b.ellipse(400, 252, 94, 24, 0, 0, TAU); b.fill();
    if (PATH) { b.strokeStyle = 'rgba(142,100,36,.5)'; b.lineWidth = 1.5; b.stroke(PATH.lapFold); }
    b.fillStyle = '#f3d58c'; b.beginPath(); b.ellipse(400, 241, 28, 9, 0, 0, TAU); b.fill();
    b.fillStyle = gold;
    if (face && FACE && FACE.complete && FACE.naturalWidth) {
      b.drawImage(FACE, 356, 47, 76, 101);                   // thay nguyên đầu (cả búi tóc), cằm chạm cổ
    } else {
      b.beginPath(); b.ellipse(373, 116, 5, 13, 0, 0, TAU); b.fill();
      b.beginPath(); b.ellipse(427, 116, 5, 13, 0, 0, TAU); b.fill();
      b.beginPath(); b.ellipse(400, 109, 25, 30, 0, 0, TAU); b.fill();
      b.beginPath(); b.arc(400, 77, 10, 0, TAU); b.fill();
    }
    const pg = b.createLinearGradient(0, 266, 0, 299); pg.addColorStop(0, '#f1d184'); pg.addColorStop(1, '#a8782e');
    [312, 341, 370, 400, 430, 459, 488].forEach(x => petal(b, x, 299, 266, 16, pg));
    b.restore();
  }

  /* ---------------- module cảnh ---------------- */
  let cv, g, W = 0, H = 0, DPR = 1, bg = null, u = 1, au = 1;
  const G = {};
  const players = new Map();
  let me = 0, offset = 0, last = 0, scene = 'hall', yardDay = null;
  // Khách vãng lai là hình ảnh cục bộ, mỗi đợt chọn ngẫu nhiên cho từng khu.
  const npcDefs = [
    { name: 'Lão Ăn Mày', look: { g: 'nam', c: 9, h: 3 }, role: 'beggar', lines: ['Thí chủ cho xin chút duyên lành, cơm chay thì càng tốt!', 'Lão ăn xin nhưng không xin mật khẩu Wi-Fi đâu nha.', 'Tu cả ngày, bụng cũng muốn giác ngộ rồi.'] },
    { name: 'Khách Vãng Lai', look: { g: 'nam', c: 6, h: 2 }, role: 'visitor', lines: ['Tôi ghé chùa tìm bình an, tiện tìm luôn dép.', 'Cảnh đẹp quá, phiền não xin đứng ngoài cổng nhé!', 'Đi một vòng cho nhẹ lòng, không phải đang tìm đường đâu.'] },
    { name: 'Vạn Lý Độc Hành', look: { g: 'nam', c: 11, h: 3 }, role: 'wanderer', lines: ['Ta đi vạn dặm... mà vẫn lạc đường vào sân chùa.', 'Độc hành lâu quá, ai chỉ đường về với?', 'Giang hồ hiểm ác, may ở đây có cơm chay.'] },
    { name: 'Cô Nương Hồng', look: { g: 'nu', c: 2, h: 0, npcFashion: true }, role: 'lady', lines: ['Hoa rơi cửa Phật, vạn vật tùy duyên.', 'Mình có thói quen cardio tại ban công.', 'Thèm nhiêu anh đủ cắc?'] },
    { name: 'Cô Nương Đỏ', look: { g: 'nu', c: 0, h: 0, npcFashion: true }, role: 'lady', lines: ['Đi chùa cầu duyên, gặp Wi-Fi mạnh cũng là có duyên!', 'Hoa rơi cửa Phật, vạn vật tùy duyên.', 'Anh ơi, tu tâm trước rồi hãy thả tim nha!'] },
    { name: 'Đại Hiệp Giang Hồ', look: { g: 'nam', c: 0, h: 2 }, role: 'sword', lines: ['Tại hạ đến luận võ, nhưng xin uống trà trước.', 'Kiếm pháp của ta rất nhanh, rửa chén còn nhanh hơn.', 'Giang hồ đồn chùa này cao thủ nhiều hơn muỗi!'] },
    { name: 'Hắc Phong Ma Khách', look: { g: 'nam', c: 11, h: 2 }, role: 'sword', demon: true, lines: ['Quỷ sau lưng ta dữ lắm, nhưng nó sợ ăn chay.', 'Ta đi tìm đối thủ, quỷ đi tìm chỗ sạc pin.', 'Đừng nhìn ta, nhìn sau lưng ta kìa!'] },
    { name: 'Nữ Hiệp Áo Tím', look: { g: 'nu', c: 4, h: 1 }, role: 'sword', lines: ['Kiếm chưa rút mà bụng đã réo rồi.', 'Đại hiệp xin nhường đường, ta đang đi tìm trà đá.', 'Võ công cao mấy cũng phải cởi dép vào chùa.'] },
    { name: 'Tiểu Thư Mê Chùa', look: { g: 'nu', c: 5, h: 1 }, role: 'lady', lines: ['Xin Phật độ con qua deadline tuần này.', 'Chùa yên tĩnh, trừ cái bụng của tiểu nữ.', 'Hôm nay mang dép đôi, mong về vẫn đủ đôi.'] },
    { name: 'Thư Sinh Lạc Đường', look: { g: 'nam', c: 5, h: 3 }, role: 'visitor', lines: ['Đọc hết kinh rồi, có ai thấy kính của ta không?', 'Học võ dùng não, đừng dùng nồi cơm điện nhé.', 'Tại hạ đang suy ngẫm... mai ăn gì.'] },
    { name: 'Đạo Hữu Mê Thiền', look: { g: 'nam', c: 8, h: 2 }, role: 'visitor', lines: ['Thiền được năm phút, nghĩ tới bữa trưa mất bốn.', 'Hít vào bình an, thở ra deadline.', 'Tâm bất biến giữa dòng thông báo.'] },
    { name: 'Bà Bán Trà', look: { g: 'nu', c: 10, h: 1 }, role: 'visitor', lines: ['Trà nóng đây, uống xong nóng lòng đi tu!', 'Chén trà không giải được deadline, nhưng uống ngon.', 'Ngồi nghỉ chút rồi hẵng làm đại hiệp.'] },
    { name: 'Tiểu Đồng', look: { g: 'nam', c: 7, h: 2 }, role: 'visitor', lines: ['Sư phụ dặn quét sân, con đang quét bản đồ.', 'Ai thấy chổi của con chưa?', 'Con tu chưa cao, nhưng ngủ rất sâu.'] },
    { name: 'Kiếm Khách Lắm Lời', look: { g: 'nam', c: 6, h: 3 }, role: 'sword', lines: ['Đao kiếm vô tình, đồng đội nhớ hồi máu!', 'Ta có bí kíp: thua thì bảo đang thử chiêu.', 'Đợi ta khởi động xong rồi hẵng luận võ.'] },
    { name: 'Cô Nương Du Xuân', look: { g: 'nu', c: 7, h: 0, npcFashion: true }, role: 'lady', lines: ['Mình có thói quen cardio tại ban công.', 'Người đẹp vì lụa, ta đẹp nhờ ngủ đủ.', 'Duyên tới thì đón, dép mất thì tìm.'] }
  ];
  let npcs = [], npcRefresh = 0, npcNextSpeech = 0, sweeper = null;
  function randomizeNpcs(now) {
    const pool = npcDefs.filter(d => d.role !== 'beggar' && d.role !== 'wanderer');
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    npcs = [];
    ['hall', 'yard', 'library', 'arena'].forEach((place, n) => {
      for (let i = 0; i < 2; i++) {
        const def = pool[n * 2 + i], x = rand(0.18, 0.82), z = rand(0.48, 0.78);
        const p = { ...mk({ id: -100 - n * 2 - i, name: def.name + ' · NPC', look: def.look, x, z, scene: place, at: place === 'arena' ? 'arena' : 'hall', mt: def.demon ? -1000 : 0 }), npc: def, tx: x, tz: z, wait: 0 };
        npcs.push(p);
      }
    });
    // These three encounters have stable server-validated positions.
    const special = [
      { place: 'hall', x: 0.68, z: 0.67, def: npcDefs.find(d => d.role === 'beggar') },
      { place: 'yard', x: 0.32, z: 0.67, def: npcDefs.find(d => d.role === 'wanderer') },
      { place: 'library', x: 0.76, z: 0.68, def: { name: 'Obito', role: 'obito', look: { g: 'nam', c: 11, h: 2 }, lines: ['Không gian này có những bí mật riêng.'] } }
    ];
    special.forEach((v, i) => npcs.push({ ...mk({ id: -300 - i, name: v.def.name + ' · NPC', look: v.def.look, x: v.x, z: v.z, scene: v.place, at: 'hall', mt: 0 }), npc: v.def, tx: v.x, tz: v.z, wait: Infinity, secretEncounter: true }));
    npcRefresh = now + rand(90000, 150000);
  }
  function updateNpcs(now, dt) {
    if (!npcRefresh || now >= npcRefresh) randomizeNpcs(now);
    const visible = npcs.filter(p => viewOf(p) === scene);
    for (const p of visible) {
      if (reduceMotion) continue;
      if (now >= p.wait && Math.hypot(p.tx - p.x, p.tz - p.z) < 0.008) {
        p.tx = clamp(p.x + rand(-0.18, 0.18), 0.12, 0.88);
        p.tz = clamp(p.z + rand(-0.12, 0.12), 0.35, 0.82);
        p.wait = now + rand(2500, 6500);
      }
      if (now < p.wait) continue;
      const dx = p.tx - p.x, dz = p.tz - p.z, dist = Math.hypot(dx, dz);
      if (dist > 0.001) { const step = Math.min(dist, dt * 0.000025); p.x += dx / dist * step; p.z += dz / dist * step; }
    }
    if (!npcNextSpeech) npcNextSpeech = now + 3500;
    if (visible.length && now >= npcNextSpeech) {
      const p = visible[Math.floor(Math.random() * visible.length)];
      p.bubble = { text: p.npc.lines[Math.floor(Math.random() * p.npc.lines.length)], t: now };
      npcNextSpeech = now + rand(11000, 19000);
    }
    return visible;
  }
  const obitoArt = root.Image ? new Image() : null;
  if (obitoArt) obitoArt.src = '/img/obito-sprite.png';
  function drawNpcAccessory(g, role) {
    g.save(); g.lineCap = 'round';
    if (role === 'beggar') {
      g.fillStyle = '#705033'; g.beginPath(); g.ellipse(17, -33, 9, 4, 0, 0, TAU); g.fill();
      g.strokeStyle = '#d4b887'; g.lineWidth = 1; g.stroke();
    } else if (role === 'sweeper') {
      g.strokeStyle = '#94683e'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(18, -80); g.lineTo(27, -5); g.stroke();
      g.strokeStyle = '#d2ad70'; g.lineWidth = 5; g.beginPath(); g.moveTo(19, -9); g.lineTo(34, -2); g.stroke();
    } else if (role === 'wanderer') {
      g.fillStyle = '#ad8851'; g.beginPath(); g.moveTo(-23, -99); g.lineTo(0, -114); g.lineTo(23, -99); g.quadraticCurveTo(0, -94, -23, -99); g.fill();
      g.strokeStyle = '#735331'; g.lineWidth = 1.5; g.stroke();
    } else if (role === 'sword') {
      g.strokeStyle = '#b9bbc0'; g.lineWidth = 3; g.beginPath(); g.moveTo(-17, -82); g.lineTo(19, -24); g.stroke();
      g.strokeStyle = '#79502a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-19, -85); g.lineTo(-13, -76); g.stroke();
    } else if (role === 'lady') {
      g.fillStyle = '#f8d78f'; circle(g, 8, -98, 3); g.fillStyle = '#fff1da'; circle(g, 8, -98, 1.3);
    } else {
      g.fillStyle = '#b98a58'; rrect(g, 10, -50, 8, 12, 2); g.fill();
    }
    g.restore();
  }

  let incense = [];
  const parts = [], hearts = [], floaters = [], ripples = [];
  const altar = { lotus: 0, rose: 0, lamp: 0, fruit: 0 };
  const handlers = {};
  let clickMark = null;
  const serverNow = () => Date.now() + offset;
  // Giờ Việt Nam (UTC+7), không phụ thuộc múi giờ trên thiết bị người xem.
  const yardInDaylight = time => { const hour = new Date(time + 7 * 3600000).getUTCHours(); return hour >= 6 && hour < 18; };

  function geo() {
    u = Math.min(W / 960, H / 600);
    au = Math.max(u, 0.5);
    G.hb = Math.round(H * 0.5); G.hf = H;
    G.wb = W * 0.36; G.wf = W * 0.64;
    if (scene === 'arena' && H > W * 1.1) {                 // Sân đấu trên điện thoại (khung dọc): hạ bầu trời, sân rộng hơn, người to hơn
      G.hb = Math.round(H * 0.36); G.wb = W * 0.44; G.wf = W * 0.8;
      au = Math.max(au, Math.min(0.72, W / 540));
    }
    G.pedY = G.hb - 22 * u;
    G.tw = Math.min(W * 0.22, G.wb * 0.62);
    G.ty = G.hb - 16 * u;
    G.bowl = { x: W / 2, y: G.ty - 24 * u, rx: 46 * u, ry: 6 * u };
    G.statueTop = G.pedY - 280 * 0.64 * u;
    // Tàng Kinh Các: tủ kinh dựa vách trái, ngoài hàng cột
    const xl = 8 * u, xr = W / 2 - G.wb - 30 * u, lw = Math.min(xr - xl, 168 * u);
    if (lw >= 30) {
      const lh = Math.min(G.hb - 40 * u, lw * 2.05);
      G.lib = { x: xl + (xr - xl - lw) / 2, y: G.hb + 2 * u - lh, w: lw, h: lh };
    } else G.lib = null;
    libGeo();
  }
  function proj(x, z) {
    const y = G.hb + (G.hf - G.hb) * z, hw = G.wb + (G.wf - G.wb) * z;
    return [W / 2 + (x - 0.5) * 2 * hw, y, 0.62 + 0.55 * z];
  }
  function unproj(sx, sy) {
    const z = (sy - G.hb) / (G.hf - G.hb), hw = G.wb + (G.wf - G.wb) * z;
    return [0.5 + (sx - W / 2) / (2 * hw), z];
  }

  function pillar(b, x, w, bottom) {
    const gr = b.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(0, '#3e0c09'); gr.addColorStop(0.5, '#9a271c'); gr.addColorStop(1, '#3e0c09');
    b.fillStyle = gr; b.fillRect(x - w / 2, 0, w, bottom);
    b.fillStyle = '#c99a45'; b.fillRect(x - w / 2 - 2 * u, 58 * u, w + 4 * u, 5 * u); b.fillRect(x - w / 2 - 2 * u, bottom - 34 * u, w + 4 * u, 5 * u);
    b.fillStyle = '#2e2119'; b.fillRect(x - w / 2 - 5 * u, bottom - 10 * u, w + 10 * u, 12 * u);
  }
  function lantern(b, x) {
    const y = 52 * u;
    b.strokeStyle = '#7a5a2a'; b.lineWidth = 1.2 * u; b.beginPath(); b.moveTo(x, 12 * u); b.lineTo(x, y - 18 * u); b.stroke();
    const gl = b.createRadialGradient(x, y, 0, x, y, 46 * u); gl.addColorStop(0, 'rgba(255,140,60,.35)'); gl.addColorStop(1, 'rgba(255,140,60,0)');
    b.fillStyle = gl; b.beginPath(); b.arc(x, y, 46 * u, 0, TAU); b.fill();
    const lg = b.createRadialGradient(x - 4 * u, y - 4 * u, 2 * u, x, y, 18 * u); lg.addColorStop(0, '#ff6b3d'); lg.addColorStop(1, '#a3180f');
    b.fillStyle = lg; b.beginPath(); b.ellipse(x, y, 14 * u, 18 * u, 0, 0, TAU); b.fill();
    b.strokeStyle = 'rgba(255,200,120,.35)'; b.lineWidth = 0.8 * u; b.beginPath(); b.ellipse(x, y, 7 * u, 18 * u, 0, 0, TAU); b.stroke();
    b.fillStyle = '#d4ab52'; b.fillRect(x - 7 * u, y - 20 * u, 14 * u, 4 * u); b.fillRect(x - 7 * u, y + 16 * u, 14 * u, 4 * u);
    b.strokeStyle = '#d4ab52'; b.beginPath(); b.moveTo(x, y + 20 * u); b.lineTo(x, y + 34 * u); b.stroke();
  }
  function drawBg() {
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
    const b = bg.getContext('2d'); b.setTransform(DPR, 0, 0, DPR, 0, 0);
    let gr = b.createRadialGradient(W / 2, H * 0.22, 10, W / 2, H * 0.3, Math.max(W, H) * 0.75);
    gr.addColorStop(0, '#5a2e18'); gr.addColorStop(0.45, '#2a140b'); gr.addColorStop(1, '#0d0705');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    b.strokeStyle = 'rgba(120,70,40,.16)'; b.lineWidth = 1; b.beginPath();
    for (let x = (W / 2) % (30 * u); x < W; x += 30 * u) { b.moveTo(x, 14 * u); b.lineTo(x, G.hb); }
    b.stroke();
    b.fillStyle = '#5e1610'; b.fillRect(0, 0, W, 11 * u); b.fillStyle = '#c99a45'; b.fillRect(0, 11 * u, W, 2 * u);
    const sideX = G.wb * 0.64;
    statue(b, W / 2 - sideX, G.pedY + 4 * u, 0.5 * u);
    statue(b, W / 2 + sideX, G.pedY + 4 * u, 0.5 * u);
    statue(b, W / 2, G.pedY, 0.64 * u, true);
    lantern(b, W / 2 - G.wb * 0.82); lantern(b, W / 2 + G.wb * 0.82);
    for (const [px, pw] of [[-0.34, 24], [0.34, 24], [-1, 36], [1, 36]]) pillar(b, W / 2 + G.wb * px, pw * u, G.hb + 4 * u);
    libraryCase(b);
    // hoành phi
    const hw = 112 * u, hy = 18 * u;
    gr = b.createLinearGradient(0, hy, 0, hy + 40 * u); gr.addColorStop(0, '#93261d'); gr.addColorStop(1, '#55120d');
    b.fillStyle = gr; b.fillRect(W / 2 - hw, hy, hw * 2, 40 * u);
    b.strokeStyle = '#d4ab52'; b.lineWidth = 2 * u; b.strokeRect(W / 2 - hw, hy, hw * 2, 40 * u);
    b.strokeStyle = 'rgba(212,171,82,.5)'; b.lineWidth = 1; b.strokeRect(W / 2 - hw + 5 * u, hy + 5 * u, hw * 2 - 10 * u, 30 * u);
    b.fillStyle = '#e9c674'; b.font = `600 ${Math.round(22 * u)}px "Cormorant Garamond", Georgia, serif`; b.textAlign = 'center'; b.textBaseline = 'middle';
    if ('letterSpacing' in b) b.letterSpacing = `${Math.round(4 * u)}px`;
    b.fillText('TỪ BI HỶ XẢ', W / 2, hy + 21 * u);
    if ('letterSpacing' in b) b.letterSpacing = '0px';
    // sàn
    b.fillStyle = '#140904'; b.fillRect(0, G.hb, W, H - G.hb);
    b.save();
    b.beginPath(); b.moveTo(W / 2 - G.wb, G.hb); b.lineTo(W / 2 + G.wb, G.hb); b.lineTo(W / 2 + G.wf, H); b.lineTo(W / 2 - G.wf, H); b.closePath(); b.clip();
    gr = b.createLinearGradient(0, G.hb, 0, H); gr.addColorStop(0, '#3d2115'); gr.addColorStop(1, '#1f0f09');
    b.fillStyle = gr; b.fillRect(0, G.hb, W, H - G.hb);
    // thảm đỏ giữa lối đi
    const c1 = proj(0.4, 0), c2 = proj(0.6, 0), c3 = proj(0.6, 1), c4 = proj(0.4, 1);
    b.fillStyle = '#5e1610'; b.beginPath(); b.moveTo(c1[0], c1[1]); b.lineTo(c2[0], c2[1]); b.lineTo(c3[0], c3[1]); b.lineTo(c4[0], c4[1]); b.closePath(); b.fill();
    b.strokeStyle = 'rgba(212,171,82,.55)'; b.lineWidth = 1.5;
    for (const x of [0.41, 0.59]) { const a = proj(x, 0), c = proj(x, 1); b.beginPath(); b.moveTo(a[0], a[1]); b.lineTo(c[0], c[1]); b.stroke(); }
    b.strokeStyle = 'rgba(201,154,69,.1)'; b.lineWidth = 1; b.beginPath();
    for (let i = 0; i <= 16; i++) { const a = proj(i / 16, 0), c = proj(i / 16, 1); b.moveTo(a[0], a[1]); b.lineTo(c[0], c[1]); }
    for (let j = 1; j <= 10; j++) { const y = proj(0, Math.pow(j / 10, 1.35))[1]; b.moveTo(0, y); b.lineTo(W, y); }
    b.stroke();
    b.restore();
    // bàn thờ
    const tw = G.tw, ty = G.ty, fb = G.hb + 22 * u;
    b.fillStyle = 'rgba(0,0,0,.35)'; b.beginPath(); b.ellipse(W / 2, fb + 4 * u, tw + 20 * u, 8 * u, 0, 0, TAU); b.fill();
    gr = b.createLinearGradient(0, ty + 8 * u, 0, fb); gr.addColorStop(0, '#93261d'); gr.addColorStop(1, '#55120d');
    b.fillStyle = gr; b.fillRect(W / 2 - tw, ty + 8 * u, tw * 2, fb - ty - 8 * u);
    b.strokeStyle = '#d4ab52'; b.lineWidth = 1; b.strokeRect(W / 2 - tw, ty + 8 * u, tw * 2, fb - ty - 8 * u);
    b.strokeStyle = 'rgba(212,171,82,.45)'; b.strokeRect(W / 2 - tw + 6 * u, ty + 13 * u, tw * 2 - 12 * u, fb - ty - 19 * u);
    b.strokeStyle = 'rgba(212,171,82,.7)'; b.beginPath(); b.arc(W / 2, (ty + fb) / 2 + 4 * u, 8 * u, 0, TAU); b.stroke();
    for (const k of [-0.5, 0.5]) { const x = W / 2 + tw * k, y = (ty + fb) / 2 + 4 * u, d = 6 * u; b.beginPath(); b.moveTo(x, y - d); b.lineTo(x + d, y); b.lineTo(x, y + d); b.lineTo(x - d, y); b.closePath(); b.stroke(); }
    b.fillStyle = '#6e1a13'; b.fillRect(W / 2 - tw - 6 * u, ty, tw * 2 + 12 * u, 8 * u);
    b.strokeStyle = '#d4ab52'; b.lineWidth = 1.2; b.strokeRect(W / 2 - tw - 6 * u, ty, tw * 2 + 12 * u, 8 * u);
    // nến
    for (const k of [-0.62, 0.62]) {
      const x = W / 2 + tw * k;
      b.fillStyle = '#b8925a'; b.fillRect(x - 8 * u, ty - 4 * u, 16 * u, 4 * u);
      b.fillStyle = '#efe2c4'; b.fillRect(x - 4 * u, ty - 32 * u, 8 * u, 28 * u);
    }
    // bình men ngọc
    for (const k of [-0.86, 0.86]) {
      const x = W / 2 + tw * k, s = u;
      b.fillStyle = '#6f9b8c'; b.beginPath();
      b.moveTo(x - 7 * s, ty); b.quadraticCurveTo(x - 13 * s, ty - 14 * s, x - 5 * s, ty - 20 * s); b.lineTo(x - 4 * s, ty - 27 * s); b.lineTo(x + 4 * s, ty - 27 * s); b.lineTo(x + 5 * s, ty - 20 * s); b.quadraticCurveTo(x + 13 * s, ty - 14 * s, x + 7 * s, ty); b.closePath(); b.fill();
    }
    // mâm ngũ quả
    for (const k of [-0.36, 0.36]) {
      const x = W / 2 + tw * k, s = u;
      b.fillStyle = '#8fae4a'; circle(b, x, ty - 15 * s, 8 * s);
      b.fillStyle = '#c8443a'; circle(b, x - 10 * s, ty - 11 * s, 5 * s);
      b.fillStyle = '#e8c33a'; circle(b, x + 10 * s, ty - 11 * s, 5 * s);
      b.fillStyle = '#e08a2e'; circle(b, x - 5 * s, ty - 7 * s, 6 * s); circle(b, x + 5 * s, ty - 7 * s, 6 * s);
      b.fillStyle = '#b8925a'; b.beginPath(); b.ellipse(x, ty - 1.5 * s, 20 * s, 3.5 * s, 0, 0, TAU); b.fill();
    }
    // bát hương
    const bw = G.bowl;
    b.strokeStyle = '#d4ab52'; b.lineWidth = 2 * u;
    b.beginPath(); b.moveTo(bw.x - bw.rx - 3 * u, bw.y + 4 * u); b.quadraticCurveTo(bw.x - bw.rx - 11 * u, bw.y + 5 * u, bw.x - bw.rx - 8 * u, bw.y + 13 * u); b.stroke();
    b.beginPath(); b.moveTo(bw.x + bw.rx + 3 * u, bw.y + 4 * u); b.quadraticCurveTo(bw.x + bw.rx + 11 * u, bw.y + 5 * u, bw.x + bw.rx + 8 * u, bw.y + 13 * u); b.stroke();
    gr = b.createLinearGradient(0, bw.y, 0, ty); gr.addColorStop(0, '#a06e38'); gr.addColorStop(1, '#4f2d14');
    b.fillStyle = gr; b.beginPath(); b.moveTo(bw.x - bw.rx, bw.y); b.quadraticCurveTo(bw.x - bw.rx + 2 * u, ty - 2 * u, bw.x - bw.rx * 0.5, ty); b.lineTo(bw.x + bw.rx * 0.5, ty); b.quadraticCurveTo(bw.x + bw.rx - 2 * u, ty - 2 * u, bw.x + bw.rx, bw.y); b.closePath(); b.fill();
    b.strokeStyle = '#d4ab52'; b.lineWidth = 1; b.stroke();
    b.fillStyle = '#2b1a10'; b.beginPath(); b.ellipse(bw.x, bw.y, bw.rx, bw.ry + 1.5 * u, 0, 0, TAU); b.fill(); b.stroke();
    b.fillStyle = '#55463a'; b.beginPath(); b.ellipse(bw.x, bw.y + 0.5 * u, bw.rx * 0.86, bw.ry * 0.7, 0, 0, TAU); b.fill();
    b.strokeStyle = 'rgba(212,171,82,.8)'; b.beginPath(); b.arc(bw.x, bw.y + 12 * u, 5 * u, 0, TAU); b.stroke();
  }

  /* ----- tủ Tàng Kinh Các ----- */
  function libraryCase(b) {
    const L = G.lib; if (!L) return;
    const { x, y, w, h } = L, cx = x + w / 2, k = w / 120;
    let gr = b.createRadialGradient(cx, y + h * 0.5, 4, cx, y + h * 0.5, w * 1.15);
    gr.addColorStop(0, 'rgba(255,186,104,.2)'); gr.addColorStop(1, 'rgba(255,186,104,0)');
    b.fillStyle = gr; b.fillRect(x - w * 0.7, y - 20 * k, w * 2.4, h + 30 * k);
    // mái cong
    const rh = 15 * k, rx0 = x - 12 * k, rx1 = x + w + 12 * k;
    b.fillStyle = '#2b1510'; b.strokeStyle = '#c99a45'; b.lineWidth = Math.max(1, 1.3 * k);
    b.beginPath(); b.moveTo(rx0, y + rh - 5 * k); b.quadraticCurveTo(x + 8 * k, y + rh * 0.55, x + 14 * k, y);
    b.lineTo(x + w - 14 * k, y); b.quadraticCurveTo(x + w - 8 * k, y + rh * 0.55, rx1, y + rh - 5 * k);
    b.lineTo(x + w - 4 * k, y + rh); b.lineTo(x + 4 * k, y + rh); b.closePath(); b.fill(); b.stroke();
    b.fillStyle = '#d4ab52'; circle(b, cx, y - 2 * k, 3 * k);
    // biển tên
    const py = y + rh + 3 * k, ph = 17 * k;
    gr = b.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, '#93261d'); gr.addColorStop(1, '#55120d');
    b.fillStyle = gr; b.fillRect(x + 5 * k, py, w - 10 * k, ph);
    b.strokeStyle = '#d4ab52'; b.lineWidth = Math.max(1, k); b.strokeRect(x + 5 * k, py, w - 10 * k, ph);
    let fs = ph * 0.66;
    b.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`;
    while (fs > 5 && b.measureText('TÀNG KINH CÁC').width > w - 18 * k) { fs -= 0.5; b.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`; }
    b.fillStyle = '#efcd7c'; b.textAlign = 'center'; b.textBaseline = 'middle';
    if (fs >= 6) b.fillText('TÀNG KINH CÁC', cx, py + ph / 2 + 0.5);
    // thân tủ sơn son
    const by = py + ph + 4 * k, bh = y + h - by - 7 * k;
    gr = b.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#4a0f0a'); gr.addColorStop(0.5, '#7a1c14'); gr.addColorStop(1, '#4a0f0a');
    b.fillStyle = gr; b.fillRect(x, by, w, bh);
    b.strokeStyle = '#c99a45'; b.lineWidth = Math.max(1, 1.4 * k); b.strokeRect(x, by, w, bh);
    const rows = 4, ix = x + 7 * k, iw = w - 14 * k, rhh = (bh - 10 * k) / rows;
    const COLS = ['#d9b45a', '#2f4a7a', '#8e2a20', '#3f6b55', '#c8b28a', '#5a3b6e'];
    for (let r = 0; r < rows; r++) {
      const sy = by + 5 * k + r * rhh, base = sy + rhh - 3 * k;
      b.fillStyle = '#1c0907'; b.fillRect(ix, sy, iw, rhh - 3 * k);
      b.fillStyle = '#b8873c'; b.fillRect(ix - 2 * k, base, iw + 4 * k, 3 * k);
      let cxx = ix + 2 * k, i = r * 3;
      while (cxx < ix + iw - 6 * k) {
        const kind = (i * 7 + r) % 5, col = COLS[(i * 5 + r * 2) % COLS.length];
        if (kind === 4) {                          // cuộn kinh nằm
          const sw = Math.min(16 * k, ix + iw - cxx - 2 * k), sh = 6 * k;
          b.fillStyle = '#e8dcc0'; b.fillRect(cxx, base - sh, sw, sh);
          b.fillStyle = col; circle(b, cxx + 1 * k, base - sh / 2, sh / 2); circle(b, cxx + sw - 1 * k, base - sh / 2, sh / 2);
          cxx += sw + 3 * k;
        } else {                                   // hộp kinh đứng
          const bw = (4.5 + (i % 3) * 1.2) * k, bh2 = rhh - (7 + (i % 4) * 2.5) * k;
          b.fillStyle = col; b.fillRect(cxx, base - bh2, bw, bh2);
          b.fillStyle = 'rgba(255,230,170,.55)'; b.fillRect(cxx + bw * 0.25, base - bh2 + 2 * k, bw * 0.5, Math.max(1, bh2 * 0.32));
          cxx += bw + 1 * k;
        }
        i++;
      }
    }
    b.fillStyle = '#2e2119'; b.fillRect(x - 4 * k, y + h - 8 * k, w + 8 * k, 9 * k);
    b.strokeStyle = 'rgba(201,154,69,.6)'; b.lineWidth = 1; b.strokeRect(x - 4 * k, y + h - 8 * k, w + 8 * k, 9 * k);
  }

  /* ----- hào quang cúng dường (9 cảnh giới) ----- */
  // Đài sen, vầng sáng sau đầu và quang bối là hình thiết kế trên Canva (public/img/fx/aura/, dựng bằng
  // tools/fx/prepare_aura_assets.py). Hình chưa tải xong hay tải lỗi thì tạm vẽ bằng mã như trước.
  const RAINBOW = ['#ff6b6b', '#ffb84d', '#ffe66b', '#6be08a', '#6bb8ff', '#b98bff'];
  const ELEM = ['#f2d16b', '#7fd38a', '#6bb8ff', '#ff7a5c', '#c9a27a'];   // kim, mộc, thủy, hỏa, thổ
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`; }
  function glow(c, x, y, r, col, a) {
    if (a <= 0.003 || r <= 0) return;
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.55, rgba(col, a * 0.35)); gr.addColorStop(1, rgba(col, 0));
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  const tierColor = t => (root.AURA && root.AURA.TIERS[t - 1] ? root.AURA.TIERS[t - 1].color : '#ffd36b');
  const FX = {};
  function fx(name) {
    let im = FX[name];
    if (!im) {
      if (typeof Image === 'undefined') return null;
      im = FX[name] = new Image(); im.decoding = 'async'; im.src = '/img/fx/aura/' + name + '.webp';
    }
    return im.complete && im.naturalWidth ? im : null;
  }
  ['lotus-gold', 'lotus-pink', 'lotus-rainbow', 'halo-gold', 'mandorla-violet', 'mandorla-gold'].forEach(fx);   // tải sẵn
  // Vẽ hình `name` rộng w, điểm neo (ax, ay) (tỉ lệ 0..1 trong hình) đặt tại (x, y). Chưa có hình thì trả false.
  function sprite(c, name, x, y, w, ax, ay, alpha, mode) {
    const im = fx(name);
    if (!im) return false;
    if (alpha <= 0.003) return true;
    const h = w * im.naturalHeight / im.naturalWidth;
    c.save(); c.globalAlpha *= Math.min(1, alpha); if (mode) c.globalCompositeOperation = mode;
    c.drawImage(im, x - w * ax, y - h * ay, w, h); c.restore();
    return true;
  }
  function flame(c, x, y, s, col, a) {                    // ngọn lửa hình giọt nước, đầu nhọn hướng lên
    if (a <= 0.01 || s <= 0) return;
    const gr = c.createRadialGradient(x, y + s * 0.3, 0, x, y, s * 1.5);
    gr.addColorStop(0, rgba('#ffffff', 0.85 * a)); gr.addColorStop(0.35, rgba(col, 0.65 * a)); gr.addColorStop(1, rgba(col, 0));
    c.fillStyle = gr; c.beginPath(); c.moveTo(x, y - s * 1.7);
    c.quadraticCurveTo(x + s * 0.95, y - s * 0.2, x + s * 0.55, y + s * 0.55);
    c.quadraticCurveTo(x, y + s * 1.05, x - s * 0.55, y + s * 0.55);
    c.quadraticCurveTo(x - s * 0.95, y - s * 0.2, x, y - s * 1.7); c.fill();
  }
  function sparkle(c, x, y, r, col, a) {                  // sao bốn cánh lấp lánh
    if (a <= 0.01) return;
    glow(c, x, y, r * 1.8, col, 0.55 * a);
    c.fillStyle = rgba('#ffffff', 0.95 * a); c.beginPath(); c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill();
  }
  function wisps(c, T, t, seed, col, a, back) {           // sợi khí lành bay vòng quanh người, có đuôi mờ dần
    const mo = reduceMotion ? 0 : 1, n = 3 + Math.min(T, 6), R = 20 + T * 1.5, tail = 4;
    for (let i = 0; i < n; i++) {
      const base = t * 0.9 * mo + i * TAU / n + seed, yy = -24 - (i % 3) * 24;
      for (let k = 0; k < tail; k++) {
        const an = base - k * 0.16;
        if ((Math.sin(an) < 0) !== back) continue;
        glow(c, Math.cos(an) * R, yy + Math.sin(an) * 6, (4 + T * 0.4) * (1 - k * 0.15), col, (back ? 0.32 : 0.5) * a * (1 - k / tail));
      }
    }
  }
  const LOTUS_FEET = 0.22;     // chân đứng trên mặt đài: 22% chiều cao hình đài sen, tính từ mép trên
  // Vẽ trong hệ toạ độ nhân vật (chân ở 0,0; đầu ở y = -88). front = phần vẽ đè lên người.
  function aura(c, T, t, a, seed, front) {
    const col = tierColor(T), mo = reduceMotion ? 0 : 1;
    const pulse = 0.82 + 0.18 * Math.sin(t * 2.2 + seed) * mo;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    if (!front) {
      if (T >= 8) {                                                   // Đại Thừa: cột sáng từ trời
        const gr = c.createLinearGradient(0, -300, 0, 0);
        gr.addColorStop(0, rgba('#fff2c0', 0)); gr.addColorStop(0.6, rgba('#ffe7a0', 0.16 * a)); gr.addColorStop(1, rgba('#ffd36b', 0.28 * a));
        c.fillStyle = gr; c.beginPath(); c.moveTo(-14, -300); c.lineTo(14, -300); c.lineTo(34, 0); c.lineTo(-34, 0); c.closePath(); c.fill();
      }
      if (T >= 6) {                                                   // Luyện Hư: quang bối lá đề đầy sao sau lưng (Đại Thừa trở lên: kim quang)
        const w = (92 + (T - 6) * 4) * (1 + 0.012 * Math.sin(t * 1.3 + seed) * mo);
        if (!sprite(c, T >= 8 ? 'mandorla-gold' : 'mandorla-violet', 0, 7, w, 0.5, 1, (T >= 8 ? 0.55 : 0.78) * (0.8 + 0.2 * pulse) * a)) {
          const H = 72 + (T - 6) * 8, Wd = 34 + (T - 6) * 4;
          const gr = c.createLinearGradient(0, -H * 1.55, 0, 0);
          gr.addColorStop(0, rgba(T >= 8 ? '#ffd36b' : '#6f5bd6', 0.32 * a)); gr.addColorStop(1, rgba(T >= 8 ? '#ff9f43' : '#2c3a8c', 0.12 * a));
          c.fillStyle = gr; c.strokeStyle = rgba(T >= 8 ? '#ffe39a' : col, 0.75 * a); c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(0, -H * 1.55); c.bezierCurveTo(Wd * 1.2, -H * 1.1, Wd, -H * 0.1, 0, 2); c.bezierCurveTo(-Wd, -H * 0.1, -Wd * 1.2, -H * 1.1, 0, -H * 1.55); c.fill(); c.stroke();
        }
        for (let i = 0; i < 9; i++) {                                 // sao lấp lánh trong quang bối
          const sx = Math.sin(i * 12.9 + seed) * w * 0.3, sy = -16 - ((i * 0.37 + seed) % 1) * w * 1.2;
          sparkle(c, sx, sy, 2.4, T >= 8 ? '#ffe39a' : '#c9b8ff', (0.5 + 0.5 * Math.sin(t * 3 * mo + i * 2.1)) * 0.8 * a);
        }
      }
      if (T >= 4) {                                                   // Nguyên Anh: tia sáng xoay chậm, mờ dần ra ngoài
        const n = 12 + (T - 4) * 2, rot = t * 0.18 * mo + seed, cy = -62, r1 = 58 + T * 7, rc = T >= 8 ? '#ffe7a0' : col, ra = T >= 8 ? 0.2 : 0.32;
        for (let i = 0; i < n; i++) {
          const an = rot + i * TAU / n, L = r1 * (i % 2 ? 0.7 : 1), w = i % 2 ? 0.045 : 0.075;
          const ex = Math.cos(an) * L, ey = cy + Math.sin(an) * L, gr = c.createLinearGradient(0, cy, ex, ey);
          gr.addColorStop(0, rgba(rc, ra * a)); gr.addColorStop(0.45, rgba(rc, ra * 0.38 * a)); gr.addColorStop(1, rgba(rc, 0));
          c.fillStyle = gr; c.beginPath();
          c.moveTo(Math.cos(an - w) * 14, cy + Math.sin(an - w) * 14); c.lineTo(ex, ey); c.lineTo(Math.cos(an + w) * 14, cy + Math.sin(an + w) * 14);
          c.closePath(); c.fill();
        }
      }
      const gT = Math.min(T, 6);                                      // cảnh giới cao đã có quang bối, quầng sáng không to thêm để khỏi chói
      glow(c, 0, -52, 40 + gT * 7, col, (0.2 + gT * 0.03) * a * pulse);  // Luyện Khí trở lên: khí lành quanh thân
      wisps(c, T, t, seed, col, a, true);                             // nửa sau của sợi khí
      if (T >= 3) {                                                   // Kim Đan: vầng sáng viền cánh sen sau đầu, xoay rất chậm
        c.save(); c.translate(0, -88); c.rotate(t * 0.06 * mo);
        if (!sprite(c, 'halo-gold', 0, 0, 66 + (T - 3) * 2.5, 0.5, 0.5, (0.78 + 0.22 * pulse) * a)) {
          glow(c, 0, 0, 22 + T, '#fff0b0', 0.42 * a);
          c.strokeStyle = rgba('#ffd36b', 0.85 * a); c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.stroke();
        }
        c.restore();
      }
      if (T >= 9) {                                                   // Độ Kiếp: vòng ngũ sắc quanh đầu
        RAINBOW.forEach((rc, i) => {
          c.strokeStyle = rgba(rc, 0.6 * a); c.lineWidth = 1.4;
          c.beginPath(); c.arc(0, -88, 23 + i * 2.6, t * (0.6 + i * 0.1) * mo + i, t * (0.6 + i * 0.1) * mo + i + Math.PI * 1.4); c.stroke();
        });
      }
      if (T >= 2) {                                                   // Trúc Cơ: đứng trên đài sen (Đại Thừa: sen hồng; Độ Kiếp: sen pha lê ngũ sắc)
        const w = 72 + (T - 2) * 3.5, name = T >= 9 ? 'lotus-rainbow' : T >= 8 ? 'lotus-pink' : 'lotus-gold';
        c.save(); c.scale(1, 0.32); glow(c, 0, 10, w * 0.62, T >= 8 ? '#ffc2d6' : '#ffd77a', 0.5 * a * pulse); c.restore();
        if (sprite(c, name, 0, 1.5, w, 0.5, LOTUS_FEET, a, 'source-over')) {
          sprite(c, name, 0, 1.5, w, 0.5, LOTUS_FEET, 0.3 * a * (pulse - 0.64) / 0.36);   // đài sen sáng lên rồi dịu xuống
        } else {
          c.save(); c.scale(1, 0.3); glow(c, 0, 0, 30 + T * 3.5, '#ffd77a', 0.55 * a * pulse);
          c.strokeStyle = rgba('#ffe29a', 0.55 * a); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 24 + T * 1.5, 0, TAU); c.stroke(); c.restore();
        }
      }
    } else {
      wisps(c, T, t, seed, col, a, false);                            // nửa trước của sợi khí
      if (T >= 2) {                                                   // đốm sáng bay lên từ đài sen
        const n = 4 + T, mc = T >= 8 ? '#ffd6e4' : '#ffe29a';
        for (let i = 0; i < n; i++) {
          const ph = (t * 0.35 * mo + i * 0.37 + seed) % 1;
          glow(c, Math.sin(i * 9.7 + seed) * (22 + T * 1.6), -2 - ph * (38 + T * 4), 2.6, mc, Math.sin(ph * Math.PI) * 0.75 * a);
        }
      }
      if (T >= 3) { glow(c, 0, -47, 10, '#ffd36b', 0.7 * a * pulse); sparkle(c, 0, -47, 3.4 + 1.4 * pulse, '#ffd36b', 0.9 * a); }   // kim đan
      if (T >= 4) {                                                   // nguyên anh bay vòng, kéo đuôi sáng
        for (let k = 5; k >= 0; k--) {
          const an = t * 1.3 * mo + seed - k * 0.13, ox = Math.cos(an) * 30, oy = -66 + Math.sin(an) * 9;
          glow(c, ox, oy, 11 - k * 1.4, '#f2a6ff', (k ? 0.28 : 0.7) * a * (1 - k / 7));
          if (!k) { c.fillStyle = rgba('#fff0ff', 0.95 * a); circle(c, ox, oy, 2.4); }
        }
      }
      if (T >= 5) {                                                   // Hóa Thần: thần hỏa xanh bốc lên quanh thân (Đại Thừa trở lên: lửa trắng ngà, nhẹ hơn)
        const n = 6 + Math.min(T, 7) * 2, fc = T >= 8 ? '#fff1c9' : '#7fd0ff', fa = T >= 8 ? 0.45 : 0.75;
        for (let i = 0; i < n; i++) {
          const ph = ((t * (0.32 + T * 0.02) * mo) + i * 0.618 + seed) % 1;
          const px = Math.sin(i * 7.31 + seed) * (17 + T * 2.2) + Math.sin(t * 3 + i) * 2 * mo, py = -4 - ph * (64 + T * 8);
          flame(c, px, py, (3.2 + T * 0.3) * (1 - ph * 0.55), i % 4 ? fc : '#e8f7ff', Math.sin(ph * Math.PI) * fa * a);
        }
      }
      if (T >= 7) {                                                   // Hợp Thể: ngũ hành châu xoay quanh, có đuôi
        for (let i = 0; i < 5; i++) {
          for (let k = 3; k >= 0; k--) {
            const an = t * 0.8 * mo + i * TAU / 5 + seed - k * 0.12, ox = Math.cos(an) * 36, oy = -50 + Math.sin(an) * 12;
            glow(c, ox, oy, 8 - k * 1.3, ELEM[i], (k ? 0.25 : 0.65) * a * (1 - k / 5));
            if (!k) { c.fillStyle = rgba(ELEM[i], 0.95 * a); circle(c, ox, oy, 2.6); }
          }
        }
      }
      if (T >= 8) {                                                   // Đại Thừa: cánh sen hồng rơi nhẹ
        for (let i = 0; i < 7; i++) {
          const ph = (t * 0.12 * mo + i / 7 + seed * 0.1) % 1, x = Math.sin(i * 4.1 + seed) * 42 + Math.sin(t * 1.1 + i) * 6 * mo, y = -150 + ph * 150;
          c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.7 + i) * 0.8 * mo + i);
          c.fillStyle = rgba(i % 2 ? '#ffb3cc' : '#ffe0ea', Math.sin(ph * Math.PI) * 0.7 * a);
          c.beginPath(); c.moveTo(0, -4.5); c.quadraticCurveTo(3.4, 0, 0, 4.5); c.quadraticCurveTo(-3.4, 0, 0, -4.5); c.fill(); c.restore();
        }
      }
      if (T >= 9 && mo) {                                             // Độ Kiếp: lôi kiếp
        const cyc = (t + seed) % 2.6;
        if (cyc < 0.32) {
          const fl = 1 - cyc / 0.32, sx = Math.sin(Math.floor((t + seed) / 2.6) * 3.7) * 18;
          glow(c, 0, -90, 70, '#cfe3ff', 0.35 * fl * a);
          c.strokeStyle = rgba('#e8f2ff', 0.95 * fl * a); c.lineWidth = 2.2; c.beginPath();
          let lx = sx, ly = -240; c.moveTo(lx, ly);
          for (let j = 1; j <= 7; j++) { lx = sx * (1 - j / 7) + Math.sin(j * 5.1 + seed + Math.floor(t / 2.6)) * 9; ly = -240 + j * 20; c.lineTo(lx, ly); }
          c.stroke();
          c.strokeStyle = rgba('#8fb8ff', 0.6 * fl * a); c.lineWidth = 5; c.stroke();
        }
      }
    }
    c.restore();
  }

  /* ----- pháp tướng công đức (6 mốc, vẽ sau lưng) ----- */
  // tint: màu hào quang cúng dường đang sáng (nếu có) để hai lớp bổ trợ nhau: ngọc và viền pháp tướng nhuộm theo hào quang.
  function wing(c, side, t, cols, len, n, flap) {
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), an = -0.25 - k * 1.25 + Math.sin(t * 1.6) * flap * (0.4 + k);
      const L = len * (0.62 + 0.38 * Math.sin(Math.PI * (0.25 + k * 0.6)));
      const bx = side * 9, by = -70, tx = bx + side * Math.cos(an) * L, ty = by + Math.sin(an) * L;
      const gr = c.createLinearGradient(bx, by, tx, ty);
      gr.addColorStop(0, rgba(cols[0], 0.85)); gr.addColorStop(0.55, rgba(cols[1], 0.6)); gr.addColorStop(1, rgba(cols[2] || cols[1], 0));
      c.fillStyle = gr;
      const dx = (tx - bx) / L, dy = (ty - by) / L, nx = -dy * side, ny = dx * side, w = 8 - k * 2.5;
      const mx = (bx + tx) / 2, my = (by + ty) / 2;
      c.beginPath(); c.moveTo(bx, by);
      c.quadraticCurveTo(mx + nx * w, my + ny * w, tx, ty);
      c.quadraticCurveTo(mx - nx * w * 0.5, my - ny * w * 0.5, bx, by + 2);
      c.fill();
    }
  }
  function crown(c, t, tint, a) {                         // vương miện sen pha lê sau đầu
    for (let i = 0; i < 9; i++) {
      const an = -Math.PI * (0.12 + 0.76 * i / 8), L = 30 + (i % 2 ? 0 : 9), w = 6.5;
      const cx = Math.cos(an), cy = Math.sin(an), x0 = cx * 12, y0 = -86 + cy * 12, x1 = cx * (12 + L), y1 = -86 + cy * (12 + L);
      const gr = c.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, rgba('#e9fffa', 0.55 * a)); gr.addColorStop(1, rgba('#7fe0cf', 0.18 * a));
      c.fillStyle = gr; c.strokeStyle = rgba(tint || '#f3e1a0', 0.75 * a); c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(x0, y0);
      c.quadraticCurveTo((x0 + x1) / 2 - cy * w, (y0 + y1) / 2 + cx * w, x1, y1);
      c.quadraticCurveTo((x0 + x1) / 2 + cy * w, (y0 + y1) / 2 - cx * w, x0, y0); c.fill(); c.stroke();
    }
  }
  function headRing(c, r, t, tint, spin) {
    c.strokeStyle = rgba('#ffd36b', 0.9); c.lineWidth = 2.2; c.beginPath(); c.arc(0, -88, r, 0, TAU); c.stroke();
    const n = 8, rot = spin ? t * 0.6 : 0;
    for (let i = 0; i < n; i++) {
      const an = rot + i * TAU / n, x = Math.cos(an) * r, y = -88 + Math.sin(an) * r;
      if (tint) glow(c, x, y, 5, tint, 0.8);
      c.fillStyle = tint || '#7fe0c4'; circle(c, x, y, 1.8);
    }
    if (spin) {                                           // vòng phù văn xoay
      c.save(); c.translate(0, -88); c.rotate(-t * 0.45);
      c.strokeStyle = rgba(tint || '#ffe7a0', 0.7); c.lineWidth = 1.1; c.setLineDash([3, 4]);
      c.beginPath(); c.arc(0, 0, r + 6, 0, TAU); c.stroke(); c.setLineDash([]);
      for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(r + 3, 0); c.lineTo(r + 9, 0); c.stroke(); }
      c.restore();
    }
  }
  function meritHalo(c, R, t, tint) {
    const mo = reduceMotion ? 0 : 1, tt = t * mo;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    if (tint) glow(c, 0, -62, 70 + R * 10, tint, 0.16);   // cộng hưởng với hào quang cúng dường
    if (R >= 6) {                                         // Cửu Tiêu Thánh Luân: mặt trời gai vàng + cánh ngũ sắc
      c.save(); c.translate(0, -66); c.rotate(tt * 0.12);
      for (let i = 0; i < 28; i++) {
        const an = i * TAU / 28, L = i % 2 ? 84 : 118, w = i % 2 ? 0.05 : 0.07;
        const gr = c.createLinearGradient(0, 0, Math.cos(an) * L, Math.sin(an) * L);
        gr.addColorStop(0, rgba('#fff3c4', 0.7)); gr.addColorStop(1, rgba('#ffb52e', 0));
        c.fillStyle = gr; c.beginPath();
        c.moveTo(Math.cos(an - w) * 40, Math.sin(an - w) * 40); c.lineTo(Math.cos(an) * L, Math.sin(an) * L); c.lineTo(Math.cos(an + w) * 40, Math.sin(an + w) * 40); c.fill();
      }
      c.restore();
      wing(c, -1, tt, ['#c9a2ff', '#6ad6ff', '#ff6b9a'], 92, 7, 0.08); wing(c, 1, tt, ['#c9a2ff', '#6ad6ff', '#ff6b9a'], 92, 7, 0.08);
    }
    if (R >= 5) {                                         // Kim Long Pháp Tướng: hai vòng hoa văn xoay ngược, lửa son
      c.save(); c.translate(0, -64);
      c.save(); c.rotate(tt * 0.3);
      c.strokeStyle = rgba('#ffcf5a', 0.95); c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 70, 0, TAU); c.stroke();
      for (let i = 0; i < 16; i++) {
        c.rotate(TAU / 16);
        c.strokeStyle = rgba('#ffe39a', 0.85); c.lineWidth = 1.4; c.beginPath(); c.arc(70, 0, 5, Math.PI * 0.5, Math.PI * 2.2); c.stroke();
        if (i % 2 === 0) {
          const f = 0.8 + 0.2 * Math.sin(tt * 6 + i);
          c.fillStyle = rgba('#ff5a36', 0.7 * f); c.beginPath(); c.moveTo(74, -4); c.quadraticCurveTo(90 * f, 0, 74, 4); c.fill();
        }
      }
      c.restore();
      c.save(); c.rotate(-tt * 0.45);
      c.strokeStyle = rgba(tint || '#ff9a5c', 0.85); c.lineWidth = 1.6; c.setLineDash([10, 5, 2, 5]);
      c.beginPath(); c.arc(0, 0, 54, 0, TAU); c.stroke(); c.setLineDash([]);
      c.restore(); c.restore();
      if (R < 6) { wing(c, -1, tt, ['#fff1b0', '#ff7a3c', '#c0181a'], 80, 6, 0.07); wing(c, 1, tt, ['#fff1b0', '#ff7a3c', '#c0181a'], 80, 6, 0.07); }
    }
    if (R >= 4) {                                         // Vạn Kiếm Quy Tông: bánh xe kiếm bạch kim xoay
      c.save(); c.translate(0, -60); c.rotate(-tt * 0.22);
      const n = 14;
      for (let i = 0; i < n; i++) {
        c.rotate(TAU / n);
        const gr = c.createLinearGradient(26, 0, 80, 0);
        gr.addColorStop(0, rgba('#ffffff', R >= 5 ? 0.35 : 0.85)); gr.addColorStop(1, rgba('#cfe0ff', 0.05));
        c.fillStyle = gr; c.beginPath(); c.moveTo(30, -2.6); c.lineTo(80, 0); c.lineTo(30, 2.6); c.closePath(); c.fill();
        c.fillStyle = rgba(tint || '#ffd36b', 0.9); c.fillRect(27, -4, 2.2, 8);
      }
      c.restore();
    }
    if (R === 3 || R === 4) { wing(c, -1, tt, ['#fff6c8', '#ffc23a', '#ff8a1a'], 70, 6, 0.08); wing(c, 1, tt, ['#fff6c8', '#ffc23a', '#ff8a1a'], 70, 6, 0.08); }
    if (R >= 2) crown(c, tt, tint, R >= 4 ? 0.75 : 1);
    glow(c, 0, -88, 26 + R * 2, '#ffe9a8', 0.28);
    headRing(c, R >= 2 ? 19 : 21, tt, tint, R >= 3);
    c.restore();
  }

  /* ----- quỷ theo sau người công đức âm (4 dạng) -----
     Hình vẽ trên Canva (img/fx/demon-N.webp, nền trong suốt, tools/fx/prepare_demon_sprites.py) kèm quầng lửa,
     lửa bốc, tàn lửa và mắt rực chớp. Ảnh chưa tải được (hay hỏng) thì vẽ hình giọt mực cũ bên dưới.
     h: cao bao nhiêu đơn vị (người cao ~100), ar: rộng/cao của ảnh, eyes: tâm mắt trong ảnh (0..1),
     er: cỡ quầng mắt theo h (mắt sát nhau thì nhỏ kẻo dính thành một cục), fire: màu lửa, rim: viền sáng quanh hình */
  const DEMON_ART = [null,
    { h: 64, ar: 0.544, er: 0.07, eyes: [[0.331, 0.359], [0.666, 0.358]], fire: ['#ff5a1f', '#ff2848'], rim: 'rgba(255,70,30,.9)' },
    { h: 82, ar: 1.155, er: 0.05, eyes: [[0.449, 0.422], [0.55, 0.422]], fire: ['#ff3a1a', '#ff2848'], rim: 'rgba(255,50,30,.9)' },
    { h: 106, ar: 0.757, er: 0.03, eyes: [[0.453, 0.357], [0.548, 0.357], [0.501, 0.329]], fire: ['#8a2cff', '#ff3355'], rim: 'rgba(160,60,255,.9)' },
    { h: 168, ar: 1.161, er: 0.035, eyes: [[0.445, 0.38], [0.544, 0.381], [0.493, 0.317]], fire: ['#ff4a14', '#a020ff'], rim: 'rgba(255,60,20,.85)' }
  ];
  // vị trí quỷ so với chân người (đơn vị nhân vật): Ma Vương đứng sừng sững ngay sau lưng (mắt cao hơn bảng tên), các dạng khác lơ lửng sau vai trái
  function demonOffset(n) {
    if (n >= 4) return [0, demonImg(4) ? -114 : -92];
    const A = DEMON_ART[n];
    return A && demonImg(n) ? [-(10 + A.h * A.ar * 0.42), -(40 + A.h / 2)] : [-30, -(64 + n * 6)];
  }
  const demonImgs = [];
  function demonImg(n) {
    let im = demonImgs[n];
    if (im === undefined) {                                   // tải lần đầu cần tới; hỏng thì thôi, dùng hình vẽ cũ
      im = demonImgs[n] = new Image(); im.decoding = 'async';
      im.onerror = () => { demonImgs[n] = null; };
      im.src = '/img/fx/demon-' + n + '.webp';
    }
    return im && im.complete && im.naturalWidth ? im : null;
  }
  const hash = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  function demonArt(c, n, t, a, img) {
    const A = DEMON_ART[n], mo = reduceMotion ? 0 : 1, tt = t * mo;
    const h = A.h * (1 + 0.025 * Math.sin(tt * 2.2)), w = h * A.ar;   // thở nhẹ
    c.save(); c.globalAlpha = a;
    c.globalCompositeOperation = 'lighter';
    glow(c, 0, 0, h * 0.62, A.fire[0], 0.3);                 // quầng lửa sau lưng
    glow(c, 0, h * 0.12, h * 0.42, A.fire[1], 0.22);
    // lửa bốc lên sau lưng: vị trí tính thẳng từ thời gian, không cần nhớ hạt
    const flames = n >= 3 ? 12 : 7;
    for (let i = 0; i < flames; i++) {
      const ph = (tt * (0.32 + 0.12 * hash(i, 1)) + hash(i, 2)) % 1;
      const x = (hash(i, 3) - 0.5) * w * 0.85 + Math.sin(tt * 2 + i) * 3, y = h * 0.32 - ph * h * 0.9;
      glow(c, x, y, (h * 0.075 + 3) * (1 - ph * 0.6), A.fire[i % 2], 0.42 * Math.sin(Math.PI * ph));
    }
    c.globalCompositeOperation = 'source-over';
    c.save(); c.rotate(Math.sin(tt * 1.3) * 0.035);           // lắc lư
    // viền sáng quanh hình để quỷ nổi lên trên nền chánh điện tối (shadowBlur tính theo điểm ảnh thật nên nhân với tỉ lệ đang vẽ)
    const px = Math.abs(c.getTransform ? c.getTransform().a : 1);
    c.shadowColor = A.rim; c.shadowBlur = Math.min(40, Math.max(4, h * 0.09 * px * (0.85 + 0.15 * Math.sin(tt * 3))));
    c.drawImage(img, -w / 2, -h / 2, w, h);
    c.shadowBlur = 0; c.shadowColor = 'transparent';
    // mắt rực, thỉnh thoảng chớp; từ Ác Quỷ trở lên có thêm vệt sáng ngang như ánh mắt lóe
    c.globalCompositeOperation = 'lighter';
    const blink = (tt % 4.3) < 0.12 ? 0.1 : 1, pulse = 0.72 + 0.28 * Math.sin(tt * 5 + n);
    for (const [ex, ey] of A.eyes) {
      const x = -w / 2 + ex * w, y = -h / 2 + ey * h;
      glow(c, x, y, h * A.er + 2, '#ff9a1a', 0.65 * blink * pulse);
      glow(c, x, y, h * A.er * 0.38 + 0.8, '#fff1c0', 0.9 * blink);
      if (n >= 2) { c.save(); c.translate(x, y); c.scale(3, 0.3); glow(c, 0, 0, h * A.er * 0.8 + 1.5, '#ffc04a', 0.5 * blink * pulse); c.restore(); }
    }
    c.restore();
    // tàn lửa bay lên từ thân
    const sparks = 6 + n * 3;
    for (let i = 0; i < sparks; i++) {
      const ph = (tt * (0.45 + 0.3 * hash(i, 4)) + hash(i, 5)) % 1;
      const x = (hash(i, 6) - 0.5) * w * 0.9 + Math.sin(tt * 3 + i * 1.7) * 4, y = h * 0.28 - ph * h * 1.05;
      c.globalAlpha = a * (1 - ph) * 0.9; c.fillStyle = i % 3 ? '#ffb347' : '#ffe6a0';
      circle(c, x, y, 0.6 + hash(i, 7) * 0.9);
    }
    c.restore();
  }
  function demon(c, n, t, a) {
    const img = DEMON_ART[n] ? demonImg(n) : null;
    if (img) { demonArt(c, n, t, a, img); return; }
    const mo = reduceMotion ? 0 : 1, tt = t * mo, S = [0, 1, 1.45, 2.1, 3.6][n];
    c.save(); c.scale(S, S); c.globalAlpha = a;
    c.globalCompositeOperation = 'lighter';
    glow(c, 0, 0, 30, n >= 3 ? '#a020ff' : '#ff2848', 0.35);
    if (n >= 3) for (let i = 0; i < 7; i++) {               // lửa đen tím bốc lên
      const ph = (tt * 0.9 + i * 0.37) % 1, x = (i - 3) * 5;
      glow(c, x + Math.sin(i + tt * 3) * 2, 6 - ph * 34, 6 * (1 - ph) + 2, i % 2 ? '#7a1cff' : '#ff3355', 0.5 * (1 - ph));
    }
    c.globalCompositeOperation = 'source-over';
    // cánh dơi
    if (n >= 2) for (const sd of [-1, 1]) {
      const f = Math.sin(tt * 5) * 0.25;
      c.fillStyle = '#16080d'; c.strokeStyle = 'rgba(255,60,80,.55)'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(sd * 6, -4);
      c.lineTo(sd * 26, -16 - f * 10); c.lineTo(sd * 22, -6); c.lineTo(sd * 30, -2 - f * 6); c.lineTo(sd * 21, 2); c.lineTo(sd * 24, 9 - f * 4); c.lineTo(sd * 8, 5);
      c.closePath(); c.fill(); c.stroke();
    }
    // thân: hình giọt mực, đuôi khói lượn
    const sw = Math.sin(tt * 3) * 2;
    c.fillStyle = '#12060b';
    c.beginPath(); c.moveTo(0, -14);
    c.bezierCurveTo(11, -14, 12, -2, 9, 6); c.quadraticCurveTo(5 + sw, 12, 2 + sw, 17); c.quadraticCurveTo(-1 + sw, 13, -3, 15);
    c.quadraticCurveTo(-6, 10, -9, 6); c.bezierCurveTo(-12, -2, -11, -14, 0, -14); c.fill();
    c.strokeStyle = 'rgba(255,50,70,.6)'; c.lineWidth = 0.8; c.stroke();
    // sừng
    c.fillStyle = '#2a0b10';
    const horns = n >= 3 ? [[-7, -12, -12, -24], [7, -12, 12, -24], [-3, -14, -4, -25], [3, -14, 4, -25], [0, -14, 0, -27]] : [[-6, -12, -10, -21], [6, -12, 10, -21]];
    if (n >= 2) horns.forEach(h => { h[2] *= 1.15; h[3] *= 1.1; });
    for (const [x0, y0, x1, y1] of horns) { c.beginPath(); c.moveTo(x0 - 2.2, y0); c.quadraticCurveTo(x1 * 0.9, (y0 + y1) / 2, x1, y1); c.quadraticCurveTo(x1 * 0.75 + x0 * 0.25, (y0 + y1) / 2 + 2, x0 + 2.2, y0); c.fill(); }
    if (n >= 3) { c.strokeStyle = 'rgba(255,190,90,.7)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-9, -13); c.lineTo(9, -13); c.stroke(); }
    // mắt đỏ
    c.globalCompositeOperation = 'lighter';
    const blink = (tt % 4) < 0.12 ? 0.15 : 1, eyes = n >= 4 ? [[-4, -6], [4, -6], [0, -10]] : [[-4, -6], [4, -6]];
    for (const [x, y] of eyes) { glow(c, x, y, 4, '#ff2a2a', 0.9 * blink); c.fillStyle = `rgba(255,220,180,${blink})`; circle(c, x, y, 1.1); }
    c.globalCompositeOperation = 'source-over';
    // miệng nhe nanh
    c.strokeStyle = 'rgba(255,90,90,.85)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(0, 3.5, 4, 0); c.stroke();
    if (n >= 2) { c.fillStyle = '#f2e6d8'; c.beginPath(); c.moveTo(-2.5, 0.8); c.lineTo(-1.7, 3); c.lineTo(-0.9, 1.3); c.moveTo(2.5, 0.8); c.lineTo(1.7, 3); c.lineTo(0.9, 1.3); c.fill(); }
    // móng vuốt
    if (n >= 2) { c.strokeStyle = 'rgba(255,70,90,.7)'; c.lineWidth = 0.8; for (const sd of [-1, 1]) { c.beginPath(); for (let k = 0; k < 3; k++) { c.moveTo(sd * (8 + k), 6); c.lineTo(sd * (10 + k * 1.4), 10); } c.stroke(); } }
    c.restore();
  }

  /* ----- phần động trên bàn thờ ----- */
  function drawAltar(now) {
    const tw = G.tw, ty = G.ty;
    // ngọn nến
    for (const k of [-0.62, 0.62]) {
      const x = W / 2 + tw * k, y = ty - 32 * u, fl = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(now / 90 + k * 7) + 0.06 * Math.sin(now / 37);
      const gl = g.createRadialGradient(x, y - 6 * u, 0, x, y - 6 * u, 30 * u); gl.addColorStop(0, `rgba(255,180,80,${0.42 * fl})`); gl.addColorStop(1, 'rgba(255,180,80,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y - 6 * u, 30 * u, 0, TAU); g.fill();
      g.fillStyle = '#ffd36b'; g.beginPath(); g.ellipse(x, y - 6 * u, 3 * u, 7 * u * fl, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff6d2'; g.beginPath(); g.ellipse(x, y - 4.5 * u, 1.4 * u, 3.4 * u * fl, 0, 0, TAU); g.fill();
    }
    // sen trong bình
    const buds = clamp(2 + Math.ceil(Math.log2(1 + altar.lotus) * 1.3), 2, 7);
    const tips = [[0, -22], [-7, -18], [7, -19], [-12, -11], [12, -12], [-4, -27], [5, -26]];
    for (const k of [-0.86, 0.86]) {
      const x = W / 2 + tw * k, y = ty - 27 * u;
      for (let i = 0; i < buds; i++) {
        const [dx, dy] = tips[i], tx = x + dx * u, tyy = y + dy * u;
        g.strokeStyle = '#5f8a54'; g.lineWidth = 1.2 * u; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx * 0.4 * u, y + dy * 0.5 * u, tx, tyy + 4 * u); g.stroke();
        g.fillStyle = '#e7a1ad'; g.beginPath(); g.moveTo(tx, tyy - 6 * u); g.quadraticCurveTo(tx + 4.5 * u, tyy - 1 * u, tx, tyy + 4 * u); g.quadraticCurveTo(tx - 4.5 * u, tyy - 1 * u, tx, tyy - 6 * u); g.fill();
      }
    }
    // hoa hồng dâng lên mép bàn
    const roses = Math.min(14, altar.rose);
    for (let i = 0; i < roses; i++) {
      const side = i % 2 ? 1 : -1, j = Math.floor(i / 2);
      const x = W / 2 + side * (G.bowl.rx + 12 * u + j * ((tw - G.bowl.rx - 20 * u) / 7)), y = ty + 3 * u;
      g.fillStyle = '#3f7a3a'; g.fillRect(x - 0.6 * u, y, 1.2 * u, 5 * u);
      g.fillStyle = '#d42a4a'; circle(g, x, y, 3.4 * u); g.fillStyle = '#f0607a'; circle(g, x - 0.8 * u, y - 0.8 * u, 1.5 * u);
    }
    // hàng đèn dầu trước bàn thờ
    const lamps = Math.min(12, altar.lamp);
    for (let i = 0; i < lamps; i++) {
      const x = W / 2 - tw * 0.92 + (lamps === 1 ? tw * 0.92 : (i * tw * 1.84) / (lamps - 1)), y = G.hb + 32 * u;
      const fl = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(now / 80 + i * 1.7);
      const gl = g.createRadialGradient(x, y - 5 * u, 0, x, y - 5 * u, 14 * u); gl.addColorStop(0, `rgba(255,170,70,${0.5 * fl})`); gl.addColorStop(1, 'rgba(255,170,70,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y - 5 * u, 14 * u, 0, TAU); g.fill();
      g.fillStyle = '#c79a45'; g.beginPath(); g.moveTo(x - 6 * u, y - 2 * u); g.lineTo(x + 6 * u, y - 2 * u); g.quadraticCurveTo(x + 4 * u, y + 3 * u, x, y + 3 * u); g.quadraticCurveTo(x - 4 * u, y + 3 * u, x - 6 * u, y - 2 * u); g.fill();
      g.fillStyle = '#ffd36b'; g.beginPath(); g.ellipse(x, y - 6 * u, 1.8 * u, 4 * u * fl, 0, 0, TAU); g.fill();
    }
  }

  /* ----- nhang & khói ----- */
  function drawIncense(now, dt) {
    const bw = G.bowl, L0 = 74 * u, red = 16 * u;
    const lit = [];
    const list = incense.length > 45 ? incense.slice(-45) : incense;
    for (const s of list) {
      if (now < s.litAt || now > s.until) continue;
      const p = (now - s.litAt) / (s.until - s.litAt);
      const L = L0 * (1 - 0.74 * p), sx = Math.sin(s.tilt), cy = Math.cos(s.tilt);
      const bx = bw.x + s.x * bw.rx * 0.82, by = bw.y + Math.sin(s.id * 12.9898) * 2 * u;
      const rx = bx + sx * red, ry = by - cy * red, tx = bx + sx * L, ty = by - cy * L;
      g.lineCap = 'round';
      g.strokeStyle = '#b8322a'; g.lineWidth = 1.6 * u; g.beginPath(); g.moveTo(bx, by); g.lineTo(rx, ry); g.stroke();
      g.strokeStyle = s.pid === me ? '#cfa868' : '#a9804f'; g.lineWidth = 2.2 * u; g.beginPath(); g.moveTo(rx, ry); g.lineTo(tx, ty); g.stroke();
      const ex = tx + sx * 2 * u, ey = ty - cy * 2 * u, age = now - s.litAt, flare = age < 900 ? 1 - age / 900 : 0;
      const fl = 0.78 + 0.22 * Math.sin(now / 170 + s.id), R = (6 + flare * 14) * u;
      const gr = g.createRadialGradient(ex, ey, 0, ex, ey, R);
      gr.addColorStop(0, `rgba(255,170,80,${Math.min(1, 0.9 * fl + flare)})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(ex, ey, R, 0, TAU); g.fill();
      g.fillStyle = '#ffd590'; circle(g, ex, ey, 1.2 * u);
      lit.push([ex, ey, s]);
    }
    const rate = reduceMotion ? 2 : 7;
    for (const [x, y, s] of lit) {
      s.acc = (s.acc || Math.random()) + dt * rate / 1000;
      while (s.acc >= 1) { s.acc -= 1; if (parts.length < 520) parts.push({ x, y: y - u, vx: rand(-4, 4) * u, vy: -rand(20, 32) * u, r: rand(0.9, 1.6) * u, life: 0, max: rand(4200, 6600), ph: rand(0, 6.28), amp: rand(4, 11) * u }); }
    }
    g.globalCompositeOperation = 'screen';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt;
      if (p.life > p.max) { parts.splice(i, 1); continue; }
      const k = p.life / p.max;
      p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000;
      const sway = reduceMotion ? 0 : Math.sin(p.ph + p.life / 850) * p.amp * k;
      g.fillStyle = `rgba(228,218,204,${(0.14 * (1 - k) * Math.min(1, p.life / 260)).toFixed(3)})`;
      g.beginPath(); g.arc(p.x + sway, p.y, p.r + k * 14 * u, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  /* ----- người ----- */
  function heartPath(x, y, s) {
    g.beginPath(); g.moveTo(x, y + s * 0.35);
    g.bezierCurveTo(x - s * 0.1, y + s * 0.25, x - s * 0.5, y + s * 0.05, x - s * 0.5, y - s * 0.15);
    g.bezierCurveTo(x - s * 0.5, y - s * 0.45, x - s * 0.1, y - s * 0.5, x, y - s * 0.25);
    g.bezierCurveTo(x + s * 0.1, y - s * 0.5, x + s * 0.5, y - s * 0.45, x + s * 0.5, y - s * 0.15);
    g.bezierCurveTo(x + s * 0.5, y + s * 0.05, x + s * 0.1, y + s * 0.25, x, y + s * 0.35);
  }
  function wrap(text, maxW, maxLines) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (g.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && lines.join(' ').length < text.length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return lines.map(l => { while (g.measureText(l).width > maxW && l.length > 2) l = l.slice(0, -2) + '…'; return l; });
  }
  function drawPlayers(now, dt) {
    const k = 1 - Math.exp(-dt / 90);
    // mỗi người chỉ hiện ở đúng cảnh mình đang ở (chánh điện, sân chùa, Tàng Kinh Các, Sân đấu); ở Võ Học Các thì không hiện
    const list = [...players.values()].filter(p => viewOf(p) === scene);
    list.push(...updateNpcs(now, dt));
    if (scene === 'library' && sweeper && sweeper.until > serverNow()) list.push(sweeper);
    const kl = 1 - Math.exp(-dt / 80);
    for (const p of list) {
      const ox = p.dx, oz = p.dz;
      p.dx += (p.x - p.dx) * k; p.dz += (p.z - p.dz) * k;
      const vx = p.dx - ox, vz = p.dz - oz, sp = Math.hypot(vx * 1.6, vz);
      p.walking = sp > 0.0003;
      if (p.walking) { p.idleT = now; if (vz > 0.0004) p.front = true; else if (vz < -0.0004) p.front = false; }
      else if (now - (p.idleT || 0) > 700) p.front = false;
      // tới bồ đoàn thì ngồi xuống
      const st = scene === 'library' && p.sit >= 0 ? LIB_SEATS[p.sit] : null;
      p.seated = !!st && Math.hypot((p.dx - st[0]) * 1.6, p.dz - st[1]) < 0.025;
      if (p.seated) { p.dx = st[0]; p.dz = st[1]; p.walking = false; if (!p.sitT) p.sitT = now; } else p.sitT = 0;
      p.hy = p.seated ? 104 - SIT_LIFT : 104;
      p.lift = (p.lift || 0) + ((scene === 'arena' && onPlat(p.dx, p.dz) ? platH(p.dz) : 0) - (p.lift || 0)) * kl;   // bước lên võ đài
    }
    const items = list.map(p => ({ z: p.dz, p }));
    if (scene === 'arena') for (const pr of ARENA_PROPS) items.push({ z: pr.z, pr });
    items.sort((a, b) => a.z - b.z);
    const t = now / 1000, srvNow = serverNow();
    for (const it of items) {
      if (it.pr) { const q = proj(it.pr.x, it.pr.z); it.pr.draw(g, q[0], q[1], q[2] * au * 0.78, now); continue; }
      const p = it.p;
      const [sx, sy0, sc] = proj(p.dx, p.dz), s = sc * au * 0.78, sy = sy0 - (p.lift || 0);
      let bow = 0;
      if (p.bowAt) { const q = (now - p.bowAt) / 1500; if (q >= 1) p.bowAt = 0; else bow = Math.sin(Math.PI * q); }
      if (p.id === me) {
        const pulse = reduceMotion ? 0.6 : 0.5 + 0.3 * Math.sin(now / 300);
        g.strokeStyle = `rgba(255,211,107,${pulse})`; g.lineWidth = 2; g.beginPath(); g.ellipse(sx, sy, 22 * s, 6 * s, 0, 0, TAU); g.stroke();
      }
      if (p.talk > 0.05) {                                    // đang nói: vòng sóng xanh ngọc dưới chân
        const q = reduceMotion ? 0.5 : (now / 700 + p.id * 0.3) % 1;
        g.strokeStyle = `rgba(134,227,180,${(0.25 + 0.55 * p.talk) * (1 - q)})`; g.lineWidth = 2;
        g.beginPath(); g.ellipse(sx, sy, (18 + q * 16) * s, (5 + q * 4.5) * s, 0, 0, TAU); g.stroke();
      }
      const aur = p.au && p.au.t && p.au.until > srvNow ? p.au : null;
      const aa = aur ? Math.min(1, (aur.until - srvNow) / 20000) : 0;   // mờ dần 20 giây cuối
      const dm = root.MERIT ? root.MERIT.visualDemonOf(p.mt) : null, rk = root.MERIT && p.mt !== 666 ? root.MERIT.rankOf(p.mt) : 0;
      if (dm) {                                               // quỷ lẽo đẽo theo sau, trễ một nhịp
        const [ox, oy] = demonOffset(dm.n), tx = sx + ox * s, ty = sy + oy * s + Math.sin(now / 520 + p.id) * 4 * s;
        if (!p.dmp) p.dmp = { x: tx, y: ty };
        const fk = 1 - Math.exp(-dt / 380);
        p.dmp.x += (tx - p.dmp.x) * fk; p.dmp.y += (ty - p.dmp.y) * fk;
        g.save(); g.translate(p.dmp.x, p.dmp.y); g.scale(s, s); demon(g, dm.n, t + p.id, dm.alpha); g.restore();
      } else p.dmp = null;
      g.save(); g.translate(sx, sy); g.scale(s, s);
      if (p.seated) {                                         // ngồi thiền: hào quang, pháp tướng thu thấp theo dáng ngồi; đang tu thì có linh khí
        const cc = p.cm ? cultCol(p.cm) : null, sa = Math.min(1, (now - p.sitT) / 700);
        if (cc) cultBack(g, t + p.id, cc, sa);
        g.save(); g.scale(1, (104 - SIT_LIFT) / 104);
        if (rk) meritHalo(g, rk, t + p.id * 0.3, aur && aa > 0.3 ? tierColor(aur.t) : null);
        if (aur) aura(g, aur.t, t, aa, p.id * 1.7, false);
        g.restore();
        drawSitting(g, p.look, t + p.id * 0.7);
        g.save(); g.scale(1, (104 - SIT_LIFT) / 104); if (aur) aura(g, aur.t, t, aa, p.id * 1.7, true); g.restore();
        if (cc) cultFront(g, t + p.id, cc, sa, p.id * 0.37);
      } else {
      if (rk) meritHalo(g, rk, t + p.id * 0.3, aur && aa > 0.3 ? tierColor(aur.t) : null);
      if (aur) aura(g, aur.t, t, aa, p.id * 1.7, false);
      if (p.npc && p.npc.role === 'obito' && obitoArt && obitoArt.complete && obitoArt.naturalWidth) {
        g.fillStyle = 'rgba(0,0,0,.32)'; g.beginPath(); g.ellipse(0, 0, 17, 4.5, 0, 0, TAU); g.fill();
        g.drawImage(obitoArt, -34, -104, 68, 104);
      } else {
        drawAvatar(g, p.look, p.front, t + p.id, bow, p.walking);
        if (p.npc) drawNpcAccessory(g, p.npc.role);
      }
      if (aur) aura(g, aur.t, t, aa, p.id * 1.7, true);
      }
      if (p.rburst) {                                         // vừa lên mốc pháp tướng
        const q = (now - p.rburst) / 2200;
        if (q >= 1) p.rburst = 0;
        else { g.globalCompositeOperation = 'lighter'; glow(g, 0, -70, 30 + q * 140, '#ffe39a', 0.6 * (1 - q)); g.globalCompositeOperation = 'source-over'; }
      }
      if (p.burst) {                                          // vừa đột phá: vòng sáng bung ra
        const q = (now - p.burst.t) / 1800;
        if (q >= 1) p.burst = null;
        else {
          g.globalCompositeOperation = 'lighter';
          const bc = tierColor(p.burst.tier);
          g.strokeStyle = rgba(bc, 0.9 * (1 - q)); g.lineWidth = 3;
          g.beginPath(); g.arc(0, -55, 20 + q * 120, 0, TAU); g.stroke();
          glow(g, 0, -55, 40 + q * 90, bc, 0.5 * (1 - q));
          g.globalCompositeOperation = 'source-over';
        }
      }
      g.restore();
      p.sx = sx; p.sy = sy; p.s = s;
    }
    // tên + bong bóng chat vẽ sau cùng để không bị che
    const fs = Math.round(clamp(8 + 4 * au, 10, 13));
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of list) {
      const top = p.sy - (p.hy || 104) * p.s;
      g.font = `600 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`;
      const label = p.mod ? '✿ ' + p.name : p.name;
      const w = g.measureText(label).width + 10, h = fs + 6, y = top - h / 2 - 2;
      const aur = p.au && p.au.t && p.au.until > serverNow() ? p.au : null;
      g.fillStyle = p.id === me ? 'rgba(60,35,8,.82)' : 'rgba(12,7,5,.6)';
      rrect(g, p.sx - w / 2, y - h / 2, w, h, h / 2); g.fill();
      if (p.talk > 0.05) { g.strokeStyle = `rgba(134,227,180,${0.5 + 0.5 * p.talk})`; g.lineWidth = 1.5; g.stroke(); }
      else if (aur) { g.strokeStyle = rgba(tierColor(aur.t), 0.95); g.lineWidth = 1.3; g.stroke(); }
      else if (p.id === me || p.mod) { g.strokeStyle = 'rgba(255,211,107,.8)'; g.lineWidth = 1; g.stroke(); }
      g.fillStyle = p.id === me || p.mod ? '#ffd36b' : '#f6eddc';
      g.fillText(label, p.sx, y + 0.5);
      if (p.pens && p.pens.length) {                        // −công đức bay lên khi nói tục
        g.font = `700 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`;
        p.pens = p.pens.filter(e => now - e.t < 2600);
        for (const e of p.pens) {
          const q = (now - e.t) / 2600;
          g.globalAlpha = q < 0.1 ? q / 0.1 : 1 - (q - 0.1) / 0.9;
          g.fillStyle = '#ff6b6b'; g.fillText(`−${e.n} công đức`, p.sx, y - h - q * 34);
        }
        g.globalAlpha = 1;
        g.font = `600 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`;
      }
      if (p.v) micBadge(p.sx - w / 2 - h / 2 - 2, y, h / 2, p.v === 2, p.talk);
      if (p.rd) bookBadge(p.sx + w / 2 + h / 2 + 2, y, h / 2);
      let up = 0;
      const tg = scene === 'arena' && tagger ? tagger(p.id) : null;   // Sân đấu: rảnh / đang đấu / tạm nghỉ, cấp nội công
      if (tg && tg.text) {
        const tfs = Math.max(9, fs - 2);
        g.font = `600 ${tfs}px "Be Vietnam Pro", system-ui, sans-serif`;
        const tw2 = g.measureText(tg.text).width + 16, th = tfs + 5, ty2 = y - h / 2 - th / 2 - 2;
        g.fillStyle = 'rgba(12,7,5,.72)'; rrect(g, p.sx - tw2 / 2, ty2 - th / 2, tw2, th, th / 2); g.fill();
        g.strokeStyle = tg.color || '#86b38a'; g.lineWidth = 1; g.stroke();
        g.fillStyle = tg.color || '#86b38a'; circle(g, p.sx - tw2 / 2 + 7, ty2, 2.4);
        g.fillStyle = '#f6eddc'; g.fillText(tg.text, p.sx + 3, ty2 + 0.5);
        g.font = `600 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`;
        up = th + 2;
      }
      if (p.bubble) {
        const age = now - p.bubble.t;
        if (age > 6500) { p.bubble = null; continue; }
        const a = age > 5900 ? 1 - (age - 5900) / 600 : 1;
        g.font = `500 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`;
        const lines = wrap(p.bubble.text, Math.max(150, 190 * Math.min(1, au)), 3);
        const bw = Math.max(...lines.map(l => g.measureText(l).width)) + 14, bh = lines.length * (fs + 3) + 9;
        const bx = clamp(p.sx - bw / 2, 4, W - bw - 4), by = y - h / 2 - bh - 8 - up;
        g.globalAlpha = a;
        g.fillStyle = '#fbf5e8'; rrect(g, bx, by, bw, bh, 8); g.fill();
        g.beginPath(); g.moveTo(p.sx - 5, by + bh - 0.5); g.lineTo(p.sx + 5, by + bh - 0.5); g.lineTo(p.sx, by + bh + 6); g.closePath(); g.fill();
        g.fillStyle = '#2a1a12';
        lines.forEach((l, i) => g.fillText(l, bx + bw / 2, by + 5 + (fs + 3) * (i + 0.5)));
        g.globalAlpha = 1;
      }
    }
  }
  // Biểu tượng nhỏ cạnh tên: mic (đang nói chuyện) và sách (đang đọc kinh)
  function micBadge(x, y, r, on, talk) {
    g.fillStyle = talk > 0.05 ? 'rgba(30,90,64,.9)' : 'rgba(12,7,5,.66)'; circle(g, x, y, r);
    g.strokeStyle = on ? '#86e3b4' : '#9a8b78'; g.fillStyle = g.strokeStyle; g.lineWidth = Math.max(1, r * 0.16); g.lineCap = 'round';
    rrect(g, x - r * 0.22, y - r * 0.6, r * 0.44, r * 0.75, r * 0.22); g.fill();
    g.beginPath(); g.arc(x, y - r * 0.05, r * 0.42, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.beginPath(); g.moveTo(x, y + r * 0.38); g.lineTo(x, y + r * 0.6); g.stroke();
    if (!on) { g.strokeStyle = '#ec7b6c'; g.beginPath(); g.moveTo(x - r * 0.55, y - r * 0.55); g.lineTo(x + r * 0.55, y + r * 0.55); g.stroke(); }
  }
  function bookBadge(x, y, r) {
    g.fillStyle = 'rgba(12,7,5,.66)'; circle(g, x, y, r);
    g.fillStyle = '#e8c477';
    g.beginPath(); g.moveTo(x, y - r * 0.32); g.quadraticCurveTo(x - r * 0.3, y - r * 0.5, x - r * 0.62, y - r * 0.4); g.lineTo(x - r * 0.62, y + r * 0.42); g.quadraticCurveTo(x - r * 0.3, y + r * 0.32, x, y + r * 0.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x, y - r * 0.32); g.quadraticCurveTo(x + r * 0.3, y - r * 0.5, x + r * 0.62, y - r * 0.4); g.lineTo(x + r * 0.62, y + r * 0.42); g.quadraticCurveTo(x + r * 0.3, y + r * 0.32, x, y + r * 0.5); g.closePath(); g.fill();
  }

  function drawFx(now, dt) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]; h.t += dt;
      if (h.t > 1800) { hearts.splice(i, 1); continue; }
      const q = h.t / 1800, a = q < 0.1 ? q / 0.1 : 1 - (q - 0.1) / 0.9;
      const x = h.x + Math.sin(h.ph + h.t / 220) * 8 * h.k, y = h.y - q * 90 * h.k, s = (10 + q * 8) * h.k;
      g.globalAlpha = Math.max(0, a); g.fillStyle = h.c; heartPath(x, y, s); g.fill();
    }
    g.globalAlpha = 1;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]; r.t += dt;
      if (r.t > 2600) { ripples.splice(i, 1); continue; }
      const q = r.t / 2600;
      g.strokeStyle = `rgba(240,200,120,${(0.7 * (1 - q)).toFixed(3)})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(G.bowl.x, G.hb, 30 * u + q * W * 0.55, (12 * u + q * W * 0.55) * 0.35, 0, 0, TAU); g.stroke();
    }
    const fs = Math.round(clamp(10 + 3 * au, 11, 14));
    g.font = `600 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.t += dt;
      if (f.t > 3200) { floaters.splice(i, 1); continue; }
      const q = f.t / 3200, a = q < 0.12 ? q / 0.12 : 1 - (q - 0.12) / 0.88, y = f.y - q * 40 * au;
      const w = g.measureText(f.text).width + 18, h = fs + 10;
      g.globalAlpha = Math.max(0, a);
      g.fillStyle = 'rgba(20,10,6,.7)'; rrect(g, f.x - w / 2, y - h / 2, w, h, h / 2); g.fill();
      g.fillStyle = '#ffd36b'; g.fillText(f.text, f.x, y + 0.5);
    }
    g.globalAlpha = 1;
    if (clickMark) {
      const q = (now - clickMark.t) / 600;
      if (q >= 1) clickMark = null;
      else { g.strokeStyle = `rgba(255,211,107,${1 - q})`; g.lineWidth = 2; g.beginPath(); g.ellipse(clickMark.x, clickMark.y, 6 + q * 14, (6 + q * 14) * 0.35, 0, 0, TAU); g.stroke(); }
    }
  }

  // Mặt tiền chánh điện dựng lại từ ảnh Canva, nền trong suốt.
  const YARD_TEMPLE = root.Image ? new Image() : null;
  if (YARD_TEMPLE) { YARD_TEMPLE.onload = () => { bg = null; }; YARD_TEMPLE.src = '/img/courtyard/chanh-dien.webp'; }

  function drawYard() {
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
    const b = bg.getContext('2d'); b.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sky = b.createLinearGradient(0, 0, 0, H);
    const colors = yardDay ? ['#71bad7', '#d7e8e4', '#e7d1b3'] : ['#192633', '#967658', '#3a2720'];
    sky.addColorStop(0, colors[0]); sky.addColorStop(.5, colors[1]); sky.addColorStop(1, colors[2]);
    b.fillStyle = sky; b.fillRect(0, 0, W, H);
    b.fillStyle = yardDay ? '#fff1b4' : '#e4c589'; b.beginPath(); b.arc(W * .8, H * .13, 20 * u, 0, TAU); b.fill();
    b.fillStyle = yardDay ? '#557b51' : '#25372e'; b.fillRect(0, H * .35, W, H * .2);
    for (let x = 0; x < W; x += 55 * u) { b.beginPath(); b.arc(x, H * .36, 42 * u, 0, TAU); b.fill(); }
    b.fillStyle = yardDay ? '#b5987d' : '#6a5141'; b.fillRect(0, G.hb, W, H - G.hb);
    b.strokeStyle = yardDay ? 'rgba(90,65,48,.24)' : 'rgba(230,200,164,.17)'; b.lineWidth = 1; b.beginPath();
    for (let i=0;i<14;i++) { const a=proj(i/13,0), z=proj(i/13,1); b.moveTo(a[0],a[1]); b.lineTo(z[0],z[1]); }
    for(let j=0;j<7;j++) { const y=G.hb+(H-G.hb)*j/7; b.moveTo(0,y); b.lineTo(W,y); } b.stroke();
    if (YARD_TEMPLE && YARD_TEMPLE.complete && YARD_TEMPLE.naturalWidth) {
      const scale = Math.min(W * .48 / YARD_TEMPLE.naturalWidth, H * .46 / YARD_TEMPLE.naturalHeight);
      const w = YARD_TEMPLE.naturalWidth * scale, h = YARD_TEMPLE.naturalHeight * scale;
      const top = H * .52 - h;
      b.drawImage(YARD_TEMPLE, W * .5 - w / 2, top, w, h);
      // Viết biển bằng chữ thật để giữ đúng tiếng Việt khi thay đổi kích thước.
      b.fillStyle = '#f7dc99'; b.textAlign = 'center'; b.textBaseline = 'middle';
      b.font = `bold ${Math.max(5, Math.round(w * .029))}px Georgia, serif`;
      b.fillText('CHÁNH ĐIỆN', W * .5, top + h * .32);
    }
  }
  function drawFortuneJar() {
    const x=G.bowl.x+G.bowl.rx+25*u, y=G.ty-2*u;
    g.save(); g.strokeStyle='#e9cf94'; g.lineWidth=2*u;
    for(let i=-2;i<=2;i++){g.beginPath();g.moveTo(x+i*3*u,y-25*u);g.lineTo(x+i*4*u,y-46*u);g.stroke();}
    g.fillStyle='#a32019';g.fillRect(x-12*u,y-27*u,24*u,27*u);g.strokeStyle='#e7bd68';g.strokeRect(x-12*u,y-27*u,24*u,27*u);
    g.fillStyle='#ffe0a0';g.font=`bold ${Math.max(10,12*u)}px sans-serif`;g.textAlign='center';g.fillText('XĂM',x,y-9*u);g.restore();
  }
  // Các thầy là hình nền trong suốt, dựng lại từ mẫu Canva người dùng chọn.
  const READERS = root.Image ? [new Image(), new Image()] : [];
  if (READERS.length) {
    READERS[0].src = '/img/readers/tu-vi.webp';
    READERS[1].src = '/img/readers/tarot.webp';
  }
  function readerBounds(i) {
    const width = Math.min(W * 0.22, 165 * Math.max(u, 0.6));
    const height = Math.min(H * 0.22, 150 * Math.max(u, 0.6));
    const x = W * i, bottom = H * 0.63;
    return { x, bottom, width, height };
  }
  function drawReaders(ts) {
    for (const [index, i, label, col] of [[0, .2, 'TỬ VI', '#6b321e'], [1, .8, 'TAROT', '#52315f']]) {
      const b = readerBounds(i), img = READERS[index];
      g.save();
      // Bóng tiếp đất làm rõ bàn đang đặt trên nền gạch.
      g.fillStyle = yardDay ? 'rgba(50,35,24,.2)' : 'rgba(0,0,0,.28)';
      g.beginPath(); g.ellipse(b.x, b.bottom, b.width * .43, Math.max(3, b.height * .035), 0, 0, TAU); g.fill();
      if (img && img.complete && img.naturalWidth) {
        const scale = Math.min(b.width / img.naturalWidth, b.height / img.naturalHeight);
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        g.drawImage(img, b.x - w / 2, b.bottom - h, w, h);
      } else {
        // Vẫn có thể tương tác nếu ảnh đang tải hoặc kết nối chậm.
        const scale = Math.max(.65, u);
        g.translate(b.x, b.bottom); g.scale(scale, scale);
        drawAvatar(g, { g: 'nam', c: index ? 4 : 9, h: 2 }, true, ts / 1000, 0, false);
        g.setTransform(DPR, 0, 0, DPR, 0, 0);
      }
      const font = Math.max(10, Math.round(12 * Math.max(u, .75)));
      const labelWidth = Math.max(64, 78 * Math.max(u, .75));
      g.fillStyle = col; g.strokeStyle = '#d9b879'; g.lineWidth = 1;
      rrect(g, b.x - labelWidth / 2, b.bottom + 2, labelWidth, font + 9, 4); g.fill(); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${font}px sans-serif`;
      g.fillStyle = '#f7e6be'; g.fillText(label, b.x, b.bottom + 6 + font / 2);
      g.font = `${Math.max(10, font - 2)}px sans-serif`; g.fillText('Chạm để xem', b.x, b.bottom + font + 18);
      g.restore();
    }
  }
  const hitJar = (x,y) => Math.abs(x-(G.bowl.x+G.bowl.rx+25*u)) < 22*u && y>G.ty-55*u && y<G.ty+5*u;
  const hitReader = (x, y) => [.2, .8].some(i => { const b = readerBounds(i); return Math.abs(x - b.x) <= b.width / 2 + 12 && y >= b.bottom - b.height && y <= b.bottom + 38; });

  /* ================= Tàng Kinh Các (cảnh 'library'): kệ kinh, kệ võ học, cửa sổ trăng, bồ đoàn ================= */
  // Bồ đoàn (x, z trên sàn). Phải khớp LIB_SEATS trong server.js.
  const LIB_SEATS = [[0.22, 0.44], [0.41, 0.44], [0.59, 0.44], [0.78, 0.44], [0.22, 0.72], [0.41, 0.72], [0.59, 0.72], [0.78, 0.72]];
  const CULT_COL = { 'tinh-tam-quyet': '#bfe3ff', 'kim-cuong-tam-phap': '#ff8a6b', 'phi-yen-tam-phap': '#ffd66b', 'nhu-thuy-tam-kinh': '#8fe0a8', 'cuu-am-tam-kinh': '#c9a2ff', 'vo-cuc-chan-kinh': '#ffe7a0' };
  const cultCol = cm => CULT_COL[cm] || '#bfe3ff';
  let sceneDay = null, hover = '', tagger = null;

  function libGeo() {
    const r = Math.max(26 * u, Math.min(G.wb * 0.4, G.hb * 0.31));
    G.libWin = { x: W / 2, y: G.hb * 0.46, r };
    const shTop = Math.max(14 * u, G.hb * 0.08), shW = Math.max(40, G.wb * 0.46);
    G.shelfL = { x: W / 2 - G.wb * 0.94, y: shTop, w: shW, h: G.hb - shTop + 2 * u };
    G.shelfR = { x: W / 2 + G.wb * 0.94 - shW, y: shTop, w: shW, h: G.hb - shTop + 2 * u };
    const tw = Math.min(G.wb * 0.36, r * 1.15);
    G.libTable = { x: W / 2, y: G.hb - 20 * u, w: tw };
  }
  const seatScale = i => { const [x, z] = LIB_SEATS[i], q = proj(x, z); return [q[0], q[1], q[2] * au * 0.78]; };

  function shelfArt(b, L, title, kind) {
    const { x, y, w, h } = L, cx = x + w / 2, k = w / 120;
    let gr = b.createRadialGradient(cx, y + h * 0.5, 4, cx, y + h * 0.5, w * 1.1);
    gr.addColorStop(0, 'rgba(255,186,104,.16)'); gr.addColorStop(1, 'rgba(255,186,104,0)');
    b.fillStyle = gr; b.fillRect(x - w * 0.5, y - 10 * k, w * 2, h + 20 * k);
    const rh = 13 * k;                                      // mái cong
    b.fillStyle = '#2b1510'; b.strokeStyle = '#c99a45'; b.lineWidth = Math.max(1, 1.2 * k);
    b.beginPath(); b.moveTo(x - 10 * k, y + rh - 4 * k); b.quadraticCurveTo(x + 7 * k, y + rh * 0.55, x + 12 * k, y);
    b.lineTo(x + w - 12 * k, y); b.quadraticCurveTo(x + w - 7 * k, y + rh * 0.55, x + w + 10 * k, y + rh - 4 * k);
    b.lineTo(x + w - 4 * k, y + rh); b.lineTo(x + 4 * k, y + rh); b.closePath(); b.fill(); b.stroke();
    const py = y + rh + 3 * k, ph = 16 * k;                  // biển tên
    gr = b.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, '#93261d'); gr.addColorStop(1, '#55120d');
    b.fillStyle = gr; b.fillRect(x + 5 * k, py, w - 10 * k, ph);
    b.strokeStyle = '#d4ab52'; b.lineWidth = Math.max(1, k); b.strokeRect(x + 5 * k, py, w - 10 * k, ph);
    let fs = ph * 0.68;
    const font = s => `700 ${s}px "Cormorant Garamond", Georgia, serif`;
    b.font = font(fs);
    while (fs > 5 && b.measureText(title).width > w - 16 * k) { fs -= 0.5; b.font = font(fs); }
    b.fillStyle = '#efcd7c'; b.textAlign = 'center'; b.textBaseline = 'middle';
    if (fs >= 6) b.fillText(title, cx, py + ph / 2 + 0.5);
    const by = py + ph + 4 * k, bh = y + h - by - 6 * k;      // thân kệ sơn son
    gr = b.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#4a0f0a'); gr.addColorStop(0.5, '#7a1c14'); gr.addColorStop(1, '#4a0f0a');
    b.fillStyle = gr; b.fillRect(x, by, w, bh);
    b.strokeStyle = '#c99a45'; b.lineWidth = Math.max(1, 1.3 * k); b.strokeRect(x, by, w, bh);
    const rows = Math.max(3, Math.min(6, Math.round(bh / (26 * k)))), ix = x + 6 * k, iw = w - 12 * k, rr = (bh - 8 * k) / rows;
    const COLS = kind === 'vo' ? ['#8e2a20', '#2c2a30', '#b8873c', '#5a3b6e', '#3f6b55'] : ['#d9b45a', '#2f4a7a', '#8e2a20', '#3f6b55', '#c8b28a', '#5a3b6e'];
    for (let r = 0; r < rows; r++) {
      const sy = by + 4 * k + r * rr, base = sy + rr - 3 * k;
      b.fillStyle = '#1c0907'; b.fillRect(ix, sy, iw, rr - 3 * k);
      b.fillStyle = '#b8873c'; b.fillRect(ix - 2 * k, base, iw + 4 * k, 3 * k);
      let cx2 = ix + 2 * k, i = r * 3;
      if (kind === 'vo' && r === 0) {                       // hàng trên cùng: thanh kiếm đặt trên giá
        const ky = sy + (rr - 3 * k) * 0.55;
        b.strokeStyle = '#d8dde6'; b.lineWidth = Math.max(1, 2 * k); b.beginPath(); b.moveTo(ix + iw * 0.2, ky); b.lineTo(ix + iw * 0.86, ky); b.stroke();
        b.strokeStyle = '#3a2418'; b.lineWidth = Math.max(1, 3 * k); b.beginPath(); b.moveTo(ix + iw * 0.06, ky); b.lineTo(ix + iw * 0.2, ky); b.stroke();
        b.fillStyle = '#d4ab52'; b.fillRect(ix + iw * 0.19, ky - 4 * k, 2.5 * k, 8 * k);
        b.fillStyle = '#c0392b'; b.beginPath(); b.moveTo(ix + iw * 0.06, ky); b.lineTo(ix + iw * 0.02, ky + 7 * k); b.lineTo(ix + iw * 0.09, ky + 6 * k); b.closePath(); b.fill();
        continue;
      }
      while (cx2 < ix + iw - 6 * k) {
        const kd = (i * 7 + r) % (kind === 'vo' ? 3 : 5), col = COLS[(i * 5 + r * 2) % COLS.length];
        if (kind === 'vo' && kd === 1) {                    // sách đóng chỉ nằm chồng
          const sw = Math.min(17 * k, ix + iw - cx2 - 2 * k);
          for (let j = 0; j < 3; j++) {
            b.fillStyle = j % 2 ? '#e8dcc0' : col; b.fillRect(cx2, base - (j + 1) * 3.4 * k, sw, 3 * k);
            b.fillStyle = 'rgba(0,0,0,.35)'; b.fillRect(cx2 + 2 * k, base - (j + 1) * 3.4 * k, 1 * k, 3 * k);
          }
          cx2 += sw + 3 * k;
        } else if (kd === 4 || (kind === 'vo' && kd === 2)) { // cuộn kinh / cuộn bí kíp nằm, buộc dây đỏ
          const sw = Math.min(16 * k, ix + iw - cx2 - 2 * k), sh = 6 * k;
          b.fillStyle = '#e8dcc0'; b.fillRect(cx2, base - sh, sw, sh);
          b.fillStyle = col; circle(b, cx2 + 1 * k, base - sh / 2, sh / 2); circle(b, cx2 + sw - 1 * k, base - sh / 2, sh / 2);
          if (kind === 'vo') { b.fillStyle = '#c0392b'; b.fillRect(cx2 + sw / 2 - 0.8 * k, base - sh, 1.6 * k, sh); }
          cx2 += sw + 3 * k;
        } else {                                            // hộp kinh đứng
          const bw = (4.5 + (i % 3) * 1.2) * k, bh2 = rr - (7 + (i % 4) * 2.5) * k;
          b.fillStyle = col; b.fillRect(cx2, base - bh2, bw, bh2);
          b.fillStyle = 'rgba(255,230,170,.55)'; b.fillRect(cx2 + bw * 0.25, base - bh2 + 2 * k, bw * 0.5, Math.max(1, bh2 * 0.32));
          cx2 += bw + 1 * k;
        }
        i++;
      }
    }
    b.fillStyle = '#2e2119'; b.fillRect(x - 4 * k, y + h - 7 * k, w + 8 * k, 8 * k);
    b.strokeStyle = 'rgba(201,154,69,.6)'; b.lineWidth = 1; b.strokeRect(x - 4 * k, y + h - 7 * k, w + 8 * k, 8 * k);
  }

  function moonWindow(b, day) {
    const { x, y, r } = G.libWin;
    b.fillStyle = '#120804'; circle(b, x, y, r + 10 * u);
    b.save(); b.beginPath(); b.arc(x, y, r, 0, TAU); b.clip();
    let gr = b.createLinearGradient(0, y - r, 0, y + r);
    if (day) { gr.addColorStop(0, '#8fc6df'); gr.addColorStop(0.7, '#e5efe3'); gr.addColorStop(1, '#cfd9c4'); }
    else { gr.addColorStop(0, '#0b1526'); gr.addColorStop(0.7, '#2c2e48'); gr.addColorStop(1, '#3c3550'); }
    b.fillStyle = gr; b.fillRect(x - r, y - r, r * 2, r * 2);
    if (day) glow(b, x + r * 0.3, y - r * 0.34, r * 0.55, '#fff6d0', 0.8);
    else { glow(b, x + r * 0.32, y - r * 0.36, r * 0.5, '#f4e7c0', 0.45); b.fillStyle = '#f6ecc8'; circle(b, x + r * 0.32, y - r * 0.36, r * 0.15); }
    // núi xa
    b.fillStyle = day ? 'rgba(96,128,118,.55)' : 'rgba(34,40,62,.9)';
    b.beginPath(); b.moveTo(x - r, y + r * 0.45);
    for (let i = 0; i <= 8; i++) b.lineTo(x - r + i * r / 4, y + r * (0.18 + 0.2 * Math.abs(Math.sin(i * 1.7))));
    b.lineTo(x + r, y + r); b.lineTo(x - r, y + r); b.closePath(); b.fill();
    // trúc
    const ink = day ? '#2f4a33' : '#0b0f10';
    for (let i = 0; i < 5; i++) {
      const sx = x - r * 0.95 + i * r * 0.47 + Math.sin(i * 3.1) * r * 0.08, lean = (i - 2) * 0.05, w = Math.max(1.4, r * 0.035);
      b.strokeStyle = ink; b.lineWidth = w; b.beginPath(); b.moveTo(sx, y + r); b.quadraticCurveTo(sx + lean * r, y, sx + lean * r * 2, y - r); b.stroke();
      for (let j = 1; j < 6; j++) {                         // đốt trúc
        const t = j / 6, px = sx + lean * r * 2 * t * t, py = y + r - t * 2 * r;
        b.lineWidth = w * 0.6; b.beginPath(); b.moveTo(px - w, py); b.lineTo(px + w, py); b.stroke();
      }
      b.fillStyle = ink;
      for (let j = 0; j < 7; j++) {                         // lá trúc
        const t = 0.15 + ((j * 0.37 + i * 0.21) % 0.75), px = sx + lean * r * 2 * t * t, py = y + r - t * 2 * r;
        b.save(); b.translate(px, py); b.rotate((j % 2 ? 1 : -1) * (0.5 + (j % 3) * 0.25));
        b.beginPath(); b.ellipse(r * 0.11, 0, r * 0.12, r * 0.025, 0, 0, TAU); b.fill(); b.restore();
      }
    }
    b.restore();
    b.lineWidth = 8 * u; b.strokeStyle = '#5a3418'; b.beginPath(); b.arc(x, y, r + 4 * u, 0, TAU); b.stroke();
    b.lineWidth = Math.max(1, 1.4 * u); b.strokeStyle = '#d4ab52';
    b.beginPath(); b.arc(x, y, r, 0, TAU); b.stroke(); b.beginPath(); b.arc(x, y, r + 8 * u, 0, TAU); b.stroke();
  }

  function cushion(c, x, y, s0, lit) {
    const s = s0 * 1.18;
    c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(x, y + 3.5 * s, 28 * s, 8.5 * s, 0, 0, TAU); c.fill();
    c.fillStyle = '#6e3f12'; c.beginPath(); c.ellipse(x, y + 2.6 * s, 25 * s, 8.4 * s, 0, 0, TAU); c.fill();
    const gr = c.createRadialGradient(x - 5 * s, y - 2 * s, 1, x, y, 26 * s);
    gr.addColorStop(0, lit ? '#f6c968' : '#e8ab45'); gr.addColorStop(1, '#a5651b');
    c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, 25 * s, 8 * s, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(110,60,16,.55)'; c.lineWidth = Math.max(0.6, 0.8 * s); c.beginPath();
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14; c.moveTo(x + Math.cos(a) * 4 * s, y + Math.sin(a) * 1.3 * s); c.lineTo(x + Math.cos(a) * 23 * s, y + Math.sin(a) * 7.3 * s); }
    c.stroke();
    c.fillStyle = '#d4ab52'; c.beginPath(); c.ellipse(x, y, 4 * s, 1.4 * s, 0, 0, TAU); c.fill();
  }

  function drawLibrary() {
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
    const b = bg.getContext('2d'); b.setTransform(DPR, 0, 0, DPR, 0, 0);
    const day = !!sceneDay;
    let gr = b.createRadialGradient(W / 2, H * 0.25, 10, W / 2, H * 0.3, Math.max(W, H) * 0.8);
    gr.addColorStop(0, day ? '#5c3a20' : '#4a2a16'); gr.addColorStop(0.5, '#2a160b'); gr.addColorStop(1, '#0d0705');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    // ván gỗ vách sau
    b.strokeStyle = 'rgba(140,90,50,.14)'; b.lineWidth = 1; b.beginPath();
    for (let x = (W / 2) % (22 * u); x < W; x += 22 * u) { b.moveTo(x, 14 * u); b.lineTo(x, G.hb); }
    b.stroke();
    b.fillStyle = '#5e1610'; b.fillRect(0, 0, W, 11 * u); b.fillStyle = '#c99a45'; b.fillRect(0, 11 * u, W, 2 * u);
    moonWindow(b, day);
    shelfArt(b, G.shelfL, 'KỆ KINH', 'kinh');
    shelfArt(b, G.shelfR, 'VÕ HỌC', 'vo');
    for (const px of [-1, 1]) pillar(b, W / 2 + G.wb * px, 22 * u, G.hb + 4 * u);
    // câu đối hai bên vách
    const bw = Math.max(18, 30 * u), bh = Math.min(G.hb * 0.62, 150 * Math.max(u, 0.6));
    for (const [sx, words] of [[Math.max(6, W / 2 - G.wb - 30 * u - bw), ['TĨNH', 'TÂM']], [Math.min(W - 6 - bw, W / 2 + G.wb + 30 * u), ['MINH', 'ĐẠO']]]) {
      if (sx < 2 || sx + bw > W - 2 || (sx < W / 2 && sx + bw > G.shelfL.x) || (sx > W / 2 && sx < G.shelfR.x + G.shelfR.w)) continue;
      const by = 26 * u;
      gr = b.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, '#f0e2bf'); gr.addColorStop(1, '#d9c497');
      b.fillStyle = gr; b.fillRect(sx, by, bw, bh);
      b.fillStyle = '#5e1610'; b.fillRect(sx - 2, by - 3, bw + 4, 4); b.fillRect(sx - 2, by + bh - 1, bw + 4, 4);
      b.fillStyle = '#4a1a10'; b.textAlign = 'center'; b.textBaseline = 'middle';
      let fs = Math.max(7, Math.min(bw * 0.62, bh / 6));
      b.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`;
      while (fs > 7 && Math.max(...words.map(w => b.measureText(w).width)) > bw * 0.86) { fs -= 0.5; b.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`; }
      words.forEach((w, i) => b.fillText(w, sx + bw / 2, by + bh * (0.3 + i * 0.4)));
    }
    // sàn gỗ
    b.fillStyle = '#140904'; b.fillRect(0, G.hb, W, H - G.hb);
    b.save();
    b.beginPath(); b.moveTo(W / 2 - G.wb, G.hb); b.lineTo(W / 2 + G.wb, G.hb); b.lineTo(W / 2 + G.wf, H); b.lineTo(W / 2 - G.wf, H); b.closePath(); b.clip();
    gr = b.createLinearGradient(0, G.hb, 0, H); gr.addColorStop(0, '#4a2c18'); gr.addColorStop(1, '#22120a');
    b.fillStyle = gr; b.fillRect(0, G.hb, W, H - G.hb);
    b.strokeStyle = 'rgba(16,8,4,.5)'; b.lineWidth = 1; b.beginPath();
    for (let i = 0; i <= 18; i++) { const a = proj(i / 18, 0), c2 = proj(i / 18, 1); b.moveTo(a[0], a[1]); b.lineTo(c2[0], c2[1]); }
    b.stroke();
    // chiếu cói dưới các bồ đoàn
    const m1 = proj(0.1, 0.3), m2 = proj(0.9, 0.3), m3 = proj(0.92, 0.88), m4 = proj(0.08, 0.88);
    b.fillStyle = day ? '#a08550' : '#7a6038'; b.beginPath(); b.moveTo(m1[0], m1[1]); b.lineTo(m2[0], m2[1]); b.lineTo(m3[0], m3[1]); b.lineTo(m4[0], m4[1]); b.closePath(); b.fill();
    b.strokeStyle = 'rgba(90,64,30,.35)'; b.beginPath();
    for (let j = 0; j <= 22; j++) { const z = 0.3 + 0.58 * j / 22, a = proj(0.1 - 0.02 * (j / 22), z), c2 = proj(0.9 + 0.02 * (j / 22), z); b.moveTo(a[0], a[1]); b.lineTo(c2[0], c2[1]); }
    b.stroke();
    b.strokeStyle = '#8e2a20'; b.lineWidth = Math.max(2, 3 * u); b.beginPath(); b.moveTo(m1[0], m1[1]); b.lineTo(m2[0], m2[1]); b.lineTo(m3[0], m3[1]); b.lineTo(m4[0], m4[1]); b.closePath(); b.stroke();
    b.restore();
    // bàn thấp, lư hương, đèn dầu dưới cửa sổ
    const T = G.libTable, th = 20 * u;
    b.fillStyle = 'rgba(0,0,0,.35)'; b.beginPath(); b.ellipse(T.x, T.y + th + 2 * u, T.w + 10 * u, 5 * u, 0, 0, TAU); b.fill();
    b.fillStyle = '#3a130d'; b.fillRect(T.x - T.w + 6 * u, T.y + 5 * u, 5 * u, th - 3 * u); b.fillRect(T.x + T.w - 11 * u, T.y + 5 * u, 5 * u, th - 3 * u);
    gr = b.createLinearGradient(0, T.y, 0, T.y + 7 * u); gr.addColorStop(0, '#93261d'); gr.addColorStop(1, '#55120d');
    b.fillStyle = gr; b.fillRect(T.x - T.w, T.y, T.w * 2, 7 * u); b.strokeStyle = '#d4ab52'; b.lineWidth = 1; b.strokeRect(T.x - T.w, T.y, T.w * 2, 7 * u);
    gr = b.createLinearGradient(T.x - 14 * u, 0, T.x + 14 * u, 0); gr.addColorStop(0, '#5c3b1a'); gr.addColorStop(0.5, '#c8913f'); gr.addColorStop(1, '#5c3b1a');
    b.fillStyle = gr; b.beginPath(); b.moveTo(T.x - 14 * u, T.y - 12 * u); b.quadraticCurveTo(T.x - 15 * u, T.y - 1 * u, T.x - 8 * u, T.y); b.lineTo(T.x + 8 * u, T.y); b.quadraticCurveTo(T.x + 15 * u, T.y - 1 * u, T.x + 14 * u, T.y - 12 * u); b.closePath(); b.fill();
    b.fillStyle = '#2b1a10'; b.beginPath(); b.ellipse(T.x, T.y - 12 * u, 14 * u, 3 * u, 0, 0, TAU); b.fill();
    b.strokeStyle = '#d4ab52'; b.lineWidth = 1; b.stroke();
    for (const k of [-0.72, 0.72]) {
      const lx = T.x + T.w * k;
      b.fillStyle = '#c79a45'; b.beginPath(); b.moveTo(lx - 6 * u, T.y - 4 * u); b.lineTo(lx + 6 * u, T.y - 4 * u); b.quadraticCurveTo(lx + 4 * u, T.y + 1 * u, lx, T.y + 1 * u); b.quadraticCurveTo(lx - 4 * u, T.y + 1 * u, lx - 6 * u, T.y - 4 * u); b.fill();
      b.fillRect(lx - 1 * u, T.y - 1 * u, 2 * u, 2 * u);
    }
    // bồ đoàn
    LIB_SEATS.forEach((_, i) => { const [sx, sy, s] = seatScale(i); cushion(b, sx, sy, s, false); });
  }

  // Phần động: ánh trăng / nắng xiên qua cửa sổ, bụi bay, khói lư hương, đèn dầu, nhãn chạm.
  function drawLibraryLive(ts) {
    const t = ts / 1000, mo = reduceMotion ? 0 : 1, Wn = G.libWin, T = G.libTable;
    g.save(); g.globalCompositeOperation = 'lighter';
    const col = sceneDay ? '#fff0c8' : '#b9c8ff', fl = sceneDay ? 0.1 : 0.07;
    const top = Wn.y + Wn.r * 0.2, gl = g.createLinearGradient(0, top, 0, H);
    gl.addColorStop(0, rgba(col, fl * (0.85 + 0.15 * Math.sin(t * 0.7)))); gl.addColorStop(1, rgba(col, 0));
    g.fillStyle = gl; g.beginPath();
    g.moveTo(Wn.x - Wn.r * 0.7, top); g.lineTo(Wn.x + Wn.r * 0.7, top); g.lineTo(Wn.x + G.wf * 0.55, H); g.lineTo(Wn.x - G.wf * 0.25, H); g.closePath(); g.fill();
    for (let i = 0; i < 18; i++) {                           // bụi lơ lửng trong vệt sáng
      const ph = (t * 0.03 * mo + hash(i, 1)) % 1, yy = top + (H - top) * ((hash(i, 2) + ph) % 1);
      const span = Wn.r * 0.7 + (G.wf * 0.4) * ((yy - top) / (H - top));
      const xx = Wn.x + (hash(i, 3) - 0.4) * span + Math.sin(t * 0.6 + i) * 6 * mo;
      g.fillStyle = rgba(col, 0.35 * Math.sin(Math.PI * ((hash(i, 2) + ph) % 1)));
      circle(g, xx, yy, 0.8 + hash(i, 4) * 1.1);
    }
    for (const k of [-0.72, 0.72]) {                         // đèn dầu
      const lx = T.x + T.w * k, ly = T.y - 6 * u, f = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(ts / 85 + k * 9);
      glow(g, lx, ly - 3 * u, 22 * u, '#ffb050', 0.4 * f);
      g.fillStyle = '#ffd36b'; g.beginPath(); g.ellipse(lx, ly - 3 * u, 1.8 * u, 4.5 * u * f, 0, 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'screen';
    for (let i = 0; i < 12; i++) {                           // khói trầm từ lư hương
      const ph = (t * 0.12 * mo + i / 12) % 1, x = T.x + Math.sin(t * 0.8 + i * 1.3) * 6 * u * ph, y = T.y - 14 * u - ph * 70 * u;
      g.fillStyle = `rgba(228,218,204,${(0.12 * (1 - ph)).toFixed(3)})`;
      circle(g, x, y, (1.5 + ph * 9) * u);
    }
    g.restore();
    if (hover === 'shelfL' || hover === 'shelfR') {
      const L = G[hover], a = 0.35 + 0.2 * Math.sin(ts / 260);
      g.strokeStyle = `rgba(255,211,107,${a})`; g.lineWidth = 2; g.strokeRect(L.x - 6, L.y - 4, L.w + 12, L.h + 6);
    }
    const mine = players.get(me), sitting = mine && mine.sit >= 0;
    LIB_SEATS.forEach((_, i) => {                            // bồ đoàn trống: vòng sáng mời ngồi; đang chỉ chuột: sáng hơn
      if ([...players.values()].some(p => p.sit === i && viewOf(p) === 'library')) return;
      const [sx, sy, s] = seatScale(i), q = reduceMotion ? 0.5 : (ts / 1600 + i * 0.13) % 1, hv = hover === 'seat' + i;
      if (sitting && !hv) return;
      g.strokeStyle = `rgba(255,211,107,${(hv ? 0.9 : 0.45) * (1 - q)})`; g.lineWidth = hv ? 2 : 1.3;
      g.beginPath(); g.ellipse(sx, sy, (26 + q * 10) * s, (8.5 + q * 3) * s, 0, 0, TAU); g.stroke();
    });
    const fs = Math.round(clamp(9 + 2 * au, 10, 12));       // nhãn dưới hai kệ
    g.font = `600 ${fs}px "Be Vietnam Pro", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [L, text] of [[G.shelfL, 'Chạm để đọc kinh'], [G.shelfR, 'Chạm để học võ']]) {
      const w = g.measureText(text).width + 14, h = fs + 8, x = L.x + L.w / 2, y = G.hb + 10 * u + h / 2;
      g.fillStyle = 'rgba(20,10,6,.72)'; rrect(g, x - w / 2, y - h / 2, w, h, h / 2); g.fill();
      g.strokeStyle = 'rgba(212,171,82,.55)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#f2dfae'; g.fillText(text, x, y + 0.5);
    }
    if (!sitting) {
      const text = 'Chạm một bồ đoàn để ngồi thiền, tu luyện nội công', y = proj(0.5, 0.9)[1];
      const w = Math.min(W - 24, g.measureText(text).width + 18), h = fs + 9;
      g.fillStyle = 'rgba(20,10,6,.62)'; rrect(g, W / 2 - w / 2, y - h / 2, w, h, h / 2); g.fill();
      g.fillStyle = '#f6eddc'; g.fillText(text, W / 2, y + 0.5, w - 12);
    }
  }

  /* ----- dáng ngồi xếp bằng trên bồ đoàn, linh khí khi đang tu ----- */
  const SIT_LIFT = 27;                                       // ngồi thấp hơn đứng bấy nhiêu đơn vị (đầu ở y = −61)
  function drawSitting(c, look, t) {
    const col = (COLORS[look.c] || COLORS[0]).c, dk = shade(col, -0.28), lt = shade(col, 0.16), sleeve = shade(col, -0.1);
    const male = look.g === 'nam', sw = male ? 15 : 13, ww = male ? 12.5 : 10.5;
    const br = reduceMotion ? 0 : Math.sin(t * 1.25);
    c.fillStyle = dk; c.beginPath(); c.ellipse(0, -5, 25, 7.5, 0, 0, TAU); c.fill();          // vạt áo trải trên bồ đoàn
    c.fillStyle = col; c.beginPath(); c.moveTo(-25, -5); c.quadraticCurveTo(-23, -17, -ww, -21); c.lineTo(ww, -21); c.quadraticCurveTo(23, -17, 25, -5); c.quadraticCurveTo(0, 1.5, -25, -5); c.closePath(); c.fill();
    c.strokeStyle = dk; c.lineWidth = 1;
    for (const sd of [-1, 1]) { c.fillStyle = lt; c.beginPath(); c.ellipse(sd * 14, -9, 10, 4.6, sd * 0.12, 0, TAU); c.fill(); c.stroke(); }   // hai gối
    c.fillStyle = '#f3eee4'; c.beginPath(); c.ellipse(-5, -10.5, 3.6, 1.8, 0.3, 0, TAU); c.fill(); c.beginPath(); c.ellipse(5, -10.5, 3.6, 1.8, -0.3, 0, TAU); c.fill();
    c.save(); c.translate(0, -br * 0.5);
    c.fillStyle = col; c.beginPath(); c.moveTo(-sw, -46); c.quadraticCurveTo(0, -50, sw, -46); c.lineTo(ww, -19); c.lineTo(-ww, -19); c.closePath(); c.fill();
    c.strokeStyle = sleeve; c.lineWidth = 5.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-sw + 1.5, -44); c.quadraticCurveTo(-sw - 3.5, -26, -4.5, -18.5); c.moveTo(sw - 1.5, -44); c.quadraticCurveTo(sw + 3.5, -26, 4.5, -18.5); c.stroke();
    c.fillStyle = SKIN; c.beginPath(); c.ellipse(0, -18.5, 6, 2.6, 0, 0, TAU); c.fill();      // tay kết ấn thiền trên đùi
    c.fillStyle = dk; c.fillRect(-3.5, -51, 7, 4.5);
    c.fillStyle = SKIN; c.fillRect(-3, -54, 6, 5);
    c.save(); c.translate(0, SIT_LIFT); drawHead(c, look, true, col);
    c.fillStyle = SKIN; circle(c, -4, -87, 1.9); circle(c, 4, -87, 1.9);                      // nhắm mắt
    c.strokeStyle = '#2a1a12'; c.lineWidth = 1; c.beginPath(); c.arc(-4, -87.6, 1.7, 0.15 * Math.PI, 0.85 * Math.PI); c.moveTo(5.7, -87.1); c.arc(4, -87.6, 1.7, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.restore(); c.restore();
  }
  function cultBack(c, t, col, a) {
    const mo = reduceMotion ? 0 : 1, pulse = 0.72 + 0.28 * Math.sin(t * 1.25);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.save(); c.scale(1, 0.32);
    glow(c, 0, -4, 50, col, 0.38 * a * pulse);
    c.rotate(t * 0.25 * mo);
    c.strokeStyle = rgba(col, 0.6 * a); c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 36, 0, TAU); c.stroke();
    c.setLineDash([6, 5]); c.beginPath(); c.arc(0, 0, 43, 0, TAU); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 8; i++) {                            // tám quẻ quanh vòng trận
      c.rotate(TAU / 8); c.lineWidth = 2;
      for (let j = 0; j < 3; j++) { const gap = (i >> j) & 1; c.beginPath(); if (gap) { c.moveTo(38 + j * 2.2, -4); c.lineTo(38 + j * 2.2, -1); c.moveTo(38 + j * 2.2, 1); c.lineTo(38 + j * 2.2, 4); } else { c.moveTo(38 + j * 2.2, -4); c.lineTo(38 + j * 2.2, 4); } c.stroke(); }
    }
    c.restore();
    glow(c, 0, -32, 40, col, 0.26 * a * pulse);
    c.restore();
  }
  function cultFront(c, t, col, a, seed) {
    const mo = reduceMotion ? 0 : 1;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {                           // linh khí xoáy từ ngoài vào đan điền
      const ph = (t * 0.26 * mo + i / 12 + seed) % 1, an = i * 2.4 + t * 1.5 * mo, R = 38 * (1 - ph);
      glow(c, Math.cos(an) * R, -20 + Math.sin(an) * R * 0.34 - ph * 8, 3.2, col, Math.sin(ph * Math.PI) * 0.85 * a);
    }
    for (let i = 0; i < 5; i++) {                            // khí bốc lên từ đỉnh đầu
      const ph = (t * 0.38 * mo + i / 5 + seed * 0.3) % 1;
      glow(c, Math.sin(t * 2 * mo + i * 1.7) * 3, -72 - ph * 30, 5 * (1 - ph) + 1.6, col, (1 - ph) * 0.5 * a);
    }
    const pulse = 0.7 + 0.3 * Math.sin(t * 1.25);
    glow(c, 0, -21, 13, col, 0.5 * a * pulse); glow(c, 0, -21, 5, '#ffffff', 0.5 * a * pulse);
    c.restore();
  }

  /* ================= Sân đấu (cảnh 'arena'): võ đài giữa sân, giá binh khí, trống trận, mộc nhân ================= */
  const PLAT = { x0: 0.28, x1: 0.72, z0: 0.24, z1: 0.6 };
  const onPlat = (x, z) => x > PLAT.x0 + 0.01 && x < PLAT.x1 - 0.01 && z > PLAT.z0 && z < PLAT.z1;
  const platH = z => (13 + 6 * z) * u;
  function pine(b, x, y, s, col) {
    b.fillStyle = '#3a2418'; b.fillRect(x - 3 * s, y - 30 * s, 6 * s, 30 * s);
    b.fillStyle = col;
    for (let i = 0; i < 4; i++) { const yy = y - 26 * s - i * 17 * s, w = (34 - i * 6) * s; b.beginPath(); b.ellipse(x + Math.sin(i * 2.1) * 5 * s, yy, w, 11 * s, 0, 0, TAU); b.fill(); }
  }
  function drawArenaYard() {
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
    const b = bg.getContext('2d'); b.setTransform(DPR, 0, 0, DPR, 0, 0);
    const day = !!sceneDay;
    let gr = b.createLinearGradient(0, 0, 0, G.hb);
    if (day) { gr.addColorStop(0, '#6fb3d3'); gr.addColorStop(1, '#e3e6d6'); } else { gr.addColorStop(0, '#141c2c'); gr.addColorStop(1, '#6a5546'); }
    b.fillStyle = gr; b.fillRect(0, 0, W, G.hb);
    if (day) glow(b, W * 0.82, H * 0.12, 60 * u, '#fff3c0', 0.8); else { glow(b, W * 0.8, H * 0.12, 40 * u, '#f4e7c0', 0.35); b.fillStyle = '#efe2b8'; circle(b, W * 0.8, H * 0.12, 13 * u); }
    for (const [yy, col, amp] of [[G.hb - 108 * u, day ? '#9fb8b2' : '#2a3346', 30], [G.hb - 82 * u, day ? '#7d9a8a' : '#202838', 22]]) {
      b.fillStyle = col; b.beginPath(); b.moveTo(0, G.hb);
      for (let x = 0; x <= W + 40; x += 40 * u) b.lineTo(x, yy + Math.sin(x / (90 * u) + amp) * amp * u * 0.6 - Math.abs(Math.sin(x / (210 * u))) * amp * u);
      b.lineTo(W, G.hb); b.closePath(); b.fill();
    }
    const tg = day ? '#3f6b3f' : '#1c2a22';                  // cây tùng sau tường
    for (const [px, s] of [[0.06, 1.15], [0.24, 0.85], [0.76, 0.9], [0.95, 1.2]]) pine(b, W * px, G.hb - 50 * u, s * Math.max(u, 0.55), tg);
    // tường bao, mái ngói
    const wt = G.hb - 52 * u;
    b.fillStyle = day ? '#d8c8a6' : '#5d4f42'; b.fillRect(0, wt, W, G.hb - wt);
    b.strokeStyle = day ? 'rgba(120,96,70,.35)' : 'rgba(0,0,0,.3)'; b.lineWidth = 1; b.beginPath();
    for (let x = 0; x < W; x += 34 * u) { b.moveTo(x, wt + 8 * u); b.lineTo(x, G.hb); }
    b.stroke();
    b.fillStyle = day ? '#6b3a2a' : '#2e1d18'; b.beginPath(); b.moveTo(-10, wt + 8 * u); b.lineTo(W + 10, wt + 8 * u); b.lineTo(W + 10, wt - 4 * u); b.lineTo(-10, wt - 4 * u); b.closePath(); b.fill();
    b.strokeStyle = day ? '#8a4e38' : '#3d2820'; b.beginPath(); for (let x = 0; x < W; x += 9 * u) { b.moveTo(x, wt - 4 * u); b.lineTo(x, wt + 8 * u); } b.stroke();
    // cổng giữa
    const gw = Math.min(G.wb * 0.55, 90 * Math.max(u, 0.6)), gh = 74 * Math.max(u, 0.6), gx = W / 2, gtop = G.hb - gh;
    gr = b.createLinearGradient(0, gtop, 0, G.hb); gr.addColorStop(0, '#120a07'); gr.addColorStop(1, '#2a1a12');
    b.fillStyle = gr; b.fillRect(gx - gw * 0.78, gtop + 14 * u, gw * 1.56, gh - 14 * u);
    for (const sd of [-1, 1]) { gr = b.createLinearGradient(gx + sd * gw - 6 * u, 0, gx + sd * gw + 6 * u, 0); gr.addColorStop(0, '#3e0c09'); gr.addColorStop(0.5, '#a12a1e'); gr.addColorStop(1, '#3e0c09'); b.fillStyle = gr; b.fillRect(gx + sd * gw - 6 * u, gtop + 6 * u, 12 * u, gh - 6 * u); }
    b.fillStyle = '#2b1510'; b.strokeStyle = '#c99a45'; b.lineWidth = Math.max(1, 1.3 * u);
    b.beginPath(); b.moveTo(gx - gw - 22 * u, gtop + 12 * u); b.quadraticCurveTo(gx - gw - 4 * u, gtop + 6 * u, gx - gw + 6 * u, gtop - 8 * u); b.lineTo(gx + gw - 6 * u, gtop - 8 * u); b.quadraticCurveTo(gx + gw + 4 * u, gtop + 6 * u, gx + gw + 22 * u, gtop + 12 * u); b.lineTo(gx + gw, gtop + 8 * u); b.lineTo(gx - gw, gtop + 8 * u); b.closePath(); b.fill(); b.stroke();
    const pw = gw * 1.1, ph = 18 * Math.max(u, 0.6), py = gtop + 13 * u;
    gr = b.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, '#93261d'); gr.addColorStop(1, '#55120d');
    b.fillStyle = gr; b.fillRect(gx - pw / 2, py, pw, ph); b.strokeStyle = '#d4ab52'; b.strokeRect(gx - pw / 2, py, pw, ph);
    b.fillStyle = '#efcd7c'; b.textAlign = 'center'; b.textBaseline = 'middle';
    let fs = ph * 0.66; b.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`;
    while (fs > 6 && b.measureText('LUẬN VÕ ĐƯỜNG').width > pw - 8) { fs -= 0.5; b.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`; }
    b.fillText('LUẬN VÕ ĐƯỜNG', gx, py + ph / 2 + 0.5);
    // sân lát đá
    b.fillStyle = day ? '#a8957c' : '#4f4236'; b.fillRect(0, G.hb, W, H - G.hb);
    b.save(); b.beginPath(); b.moveTo(W / 2 - G.wb * 1.6, G.hb); b.lineTo(W / 2 + G.wb * 1.6, G.hb); b.lineTo(W / 2 + G.wf * 1.6, H); b.lineTo(W / 2 - G.wf * 1.6, H); b.closePath(); b.clip();
    gr = b.createLinearGradient(0, G.hb, 0, H); gr.addColorStop(0, day ? '#bcaa8e' : '#5e5042'); gr.addColorStop(1, day ? '#9b8566' : '#3e3329');
    b.fillStyle = gr; b.fillRect(0, G.hb, W, H - G.hb);
    b.strokeStyle = day ? 'rgba(80,60,40,.25)' : 'rgba(230,200,164,.12)'; b.lineWidth = 1; b.beginPath();
    for (let i = -6; i <= 20; i++) { const a = proj(i / 14, 0), c2 = proj(i / 14, 1); b.moveTo(a[0], a[1]); b.lineTo(c2[0], c2[1]); }
    for (let j = 1; j <= 9; j++) { const y = proj(0, Math.pow(j / 9, 1.25))[1]; b.moveTo(0, y); b.lineTo(W, y); }
    b.stroke(); b.restore();
    // võ đài
    const P = [proj(PLAT.x0, PLAT.z0), proj(PLAT.x1, PLAT.z0), proj(PLAT.x1, PLAT.z1), proj(PLAT.x0, PLAT.z1)];
    const hb = platH(PLAT.z0), hf = platH(PLAT.z1);
    b.fillStyle = 'rgba(0,0,0,.3)'; b.beginPath(); b.moveTo(P[3][0] - 6, P[3][1] + 4); b.lineTo(P[2][0] + 6, P[2][1] + 4); b.lineTo(P[1][0] + 4, P[1][1]); b.lineTo(P[0][0] - 4, P[0][1]); b.closePath(); b.fill();
    gr = b.createLinearGradient(0, P[3][1] - hf, 0, P[3][1]); gr.addColorStop(0, '#6e2a16'); gr.addColorStop(1, '#3d160b');
    b.fillStyle = gr; b.beginPath(); b.moveTo(P[3][0], P[3][1] - hf); b.lineTo(P[2][0], P[2][1] - hf); b.lineTo(P[2][0], P[2][1]); b.lineTo(P[3][0], P[3][1]); b.closePath(); b.fill();
    b.strokeStyle = '#d4ab52'; b.lineWidth = Math.max(1, 1.4 * u); b.stroke();
    b.strokeStyle = 'rgba(212,171,82,.5)'; b.lineWidth = 1; b.beginPath();
    for (let i = 1; i < 8; i++) { const x = P[3][0] + (P[2][0] - P[3][0]) * i / 8; b.moveTo(x, P[3][1] - hf + 3); b.lineTo(x, P[3][1] - 3); }
    b.stroke();
    gr = b.createLinearGradient(0, P[0][1] - hb, 0, P[3][1] - hf); gr.addColorStop(0, '#7a4424'); gr.addColorStop(1, '#a35f33');
    b.fillStyle = gr; b.beginPath(); b.moveTo(P[0][0], P[0][1] - hb); b.lineTo(P[1][0], P[1][1] - hb); b.lineTo(P[2][0], P[2][1] - hf); b.lineTo(P[3][0], P[3][1] - hf); b.closePath(); b.fill();
    b.strokeStyle = '#d4ab52'; b.lineWidth = Math.max(1, 1.6 * u); b.stroke();
    b.save(); b.clip();
    b.strokeStyle = 'rgba(60,24,10,.45)'; b.lineWidth = 1; b.beginPath();
    for (let j = 1; j < 9; j++) { const z = PLAT.z0 + (PLAT.z1 - PLAT.z0) * j / 9, a = proj(PLAT.x0, z), c2 = proj(PLAT.x1, z), hh = platH(z); b.moveTo(a[0], a[1] - hh); b.lineTo(c2[0], c2[1] - hh); }
    b.stroke(); b.restore();
    // thái cực vẽ giữa võ đài
    const zc = (PLAT.z0 + PLAT.z1) / 2, C = proj(0.5, zc), hc = platH(zc), rx = (proj(0.585, zc)[0] - C[0]), ry = rx * 0.34;
    b.save(); b.translate(C[0], C[1] - hc); b.scale(1, ry / rx);
    b.fillStyle = 'rgba(240,226,190,.55)'; circle(b, 0, 0, rx);
    b.fillStyle = 'rgba(40,20,12,.6)'; b.beginPath(); b.arc(0, 0, rx, -Math.PI / 2, Math.PI / 2); b.arc(0, rx / 2, rx / 2, Math.PI / 2, Math.PI * 1.5); b.arc(0, -rx / 2, rx / 2, Math.PI / 2, -Math.PI / 2, true); b.closePath(); b.fill();
    b.fillStyle = 'rgba(240,226,190,.85)'; circle(b, 0, rx / 2, rx * 0.12); b.fillStyle = 'rgba(40,20,12,.85)'; circle(b, 0, -rx / 2, rx * 0.12);
    b.strokeStyle = 'rgba(212,171,82,.8)'; b.lineWidth = 1.5; b.beginPath(); b.arc(0, 0, rx, 0, TAU); b.stroke();
    b.restore();
    // bậc lên võ đài
    const s1 = proj(0.45, PLAT.z1), s2 = proj(0.55, PLAT.z1);
    for (let i = 0; i < 2; i++) { b.fillStyle = i ? '#4a1c0e' : '#5b2412'; const yy = s1[1] - hf + (i + 1) * hf / 3; b.fillRect(s1[0], yy, s2[0] - s1[0], hf / 3 + 1); b.strokeStyle = 'rgba(212,171,82,.5)'; b.strokeRect(s1[0], yy, s2[0] - s1[0], hf / 3 + 1); }
    // cột bốn góc (cờ vẽ ở phần động)
    for (const [x, z] of [[PLAT.x0, PLAT.z0], [PLAT.x1, PLAT.z0], [PLAT.x0, PLAT.z1], [PLAT.x1, PLAT.z1]]) {
      const q = proj(x, z), hh = platH(z), ph2 = 64 * q[2] * au;
      b.fillStyle = '#9a271c'; b.fillRect(q[0] - 2.2 * q[2] * au, q[1] - hh - ph2, 4.4 * q[2] * au, ph2);
      b.fillStyle = '#d4ab52'; circle(b, q[0], q[1] - hh - ph2, 3.2 * q[2] * au);
    }
    const ropeY = (x, z) => { const q = proj(x, z); return [q[0], q[1] - platH(z) - 34 * q[2] * au]; };
    b.strokeStyle = '#c0392b'; b.lineWidth = Math.max(1.2, 2 * u); b.beginPath();
    for (const [a, c2] of [[[PLAT.x0, PLAT.z0], [PLAT.x1, PLAT.z0]], [[PLAT.x0, PLAT.z0], [PLAT.x0, PLAT.z1]], [[PLAT.x1, PLAT.z0], [PLAT.x1, PLAT.z1]]]) {
      const A = ropeY(a[0], a[1]), B = ropeY(c2[0], c2[1]); b.moveTo(A[0], A[1]); b.quadraticCurveTo((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + 6 * u, B[0], B[1]);
    }
    b.stroke();
    weaponRack(b, proj(0.1, 0.06), Math.max(u, 0.5), day);
    warDrum(b, proj(0.9, 0.07), Math.max(u, 0.5));
  }
  function weaponRack(b, q, s, day) {
    const [x, y] = q, w = 70 * s, h = 70 * s;
    b.fillStyle = 'rgba(0,0,0,.28)'; b.beginPath(); b.ellipse(x, y + 2, w * 0.6, 5 * s, 0, 0, TAU); b.fill();
    b.fillStyle = '#4a2a16'; b.fillRect(x - w / 2, y - 6 * s, w, 6 * s); b.fillRect(x - w / 2, y - h * 0.62, w, 4 * s);
    b.fillRect(x - w / 2, y - h, 5 * s, h); b.fillRect(x + w / 2 - 5 * s, y - h, 5 * s, h);
    for (let i = 0; i < 5; i++) {
      const xx = x - w / 2 + 12 * s + i * (w - 24 * s) / 4, top = y - h - 18 * s - (i % 2) * 8 * s;
      b.strokeStyle = '#6b4424'; b.lineWidth = 2.4 * s; b.beginPath(); b.moveTo(xx, y - 5 * s); b.lineTo(xx, top); b.stroke();
      b.fillStyle = i === 2 ? '#d8dde6' : '#c8ccd4';
      if (i === 2) { b.beginPath(); b.moveTo(xx - 1, top + 4 * s); b.quadraticCurveTo(xx + 9 * s, top + 2 * s, xx + 7 * s, top + 16 * s); b.lineTo(xx, top + 14 * s); b.closePath(); b.fill(); }   // đại đao
      else { b.beginPath(); b.moveTo(xx, top - 9 * s); b.lineTo(xx + 3 * s, top); b.lineTo(xx - 3 * s, top); b.closePath(); b.fill(); }                                       // giáo
      b.fillStyle = '#c0392b'; b.beginPath(); b.moveTo(xx - 3 * s, top + 1 * s); b.lineTo(xx + 3 * s, top + 1 * s); b.lineTo(xx + 1.5 * s, top + 8 * s); b.lineTo(xx - 1.5 * s, top + 8 * s); b.closePath(); b.fill();   // tua đỏ
    }
  }
  function warDrum(b, q, s) {
    const [x, y] = q, r = 22 * s;
    b.fillStyle = 'rgba(0,0,0,.28)'; b.beginPath(); b.ellipse(x, y + 2, r * 1.4, 5 * s, 0, 0, TAU); b.fill();
    b.strokeStyle = '#4a2a16'; b.lineWidth = 4 * s; b.beginPath(); b.moveTo(x - r, y); b.lineTo(x - r * 0.4, y - r * 1.5); b.moveTo(x + r, y); b.lineTo(x + r * 0.4, y - r * 1.5); b.stroke();
    const cy = y - r * 1.9;
    const gr = b.createLinearGradient(x - r, 0, x + r, 0); gr.addColorStop(0, '#5e140e'); gr.addColorStop(0.5, '#b2342a'); gr.addColorStop(1, '#5e140e');
    b.fillStyle = gr; b.beginPath(); b.ellipse(x, cy, r, r * 1.05, 0, 0, TAU); b.fill();
    b.fillStyle = '#e8d6ac'; b.beginPath(); b.ellipse(x, cy, r * 0.42, r * 1.0, 0, 0, TAU); b.fill();
    b.strokeStyle = '#d4ab52'; b.lineWidth = 1.2 * s; b.beginPath(); b.ellipse(x, cy, r * 0.42, r * 1.0, 0, 0, TAU); b.stroke();
    b.fillStyle = '#d4ab52'; for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 7; circle(b, x + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.98, 1.3 * s); }
    b.strokeStyle = '#6b4424'; b.lineWidth = 2 * s; b.beginPath(); b.moveTo(x + r * 0.8, cy + r * 0.9); b.lineTo(x + r * 1.5, cy + r * 0.3); b.moveTo(x + r * 0.9, cy + r * 1.1); b.lineTo(x + r * 1.7, cy + r * 0.8); b.stroke();
  }
  // Vật dựng trên sân có chiều sâu (vẽ xen với người theo z): mộc nhân, đèn đá.
  const ARENA_PROPS = [
    { x: 0.13, z: 0.78, draw(c, x, y, s) {
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y, 16 * s, 4.5 * s, 0, 0, TAU); c.fill();
      const gr = c.createLinearGradient(x - 8 * s, 0, x + 8 * s, 0); gr.addColorStop(0, '#3e2414'); gr.addColorStop(0.5, '#8a5a32'); gr.addColorStop(1, '#3e2414');
      c.fillStyle = gr; c.fillRect(x - 7 * s, y - 92 * s, 14 * s, 92 * s);
      c.strokeStyle = '#6b4424'; c.lineWidth = 4 * s; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - 6 * s, y - 72 * s); c.lineTo(x - 22 * s, y - 64 * s); c.moveTo(x + 6 * s, y - 70 * s); c.lineTo(x + 22 * s, y - 62 * s); c.moveTo(x, y - 50 * s); c.lineTo(x + 18 * s, y - 40 * s); c.stroke();
      c.fillStyle = '#8a5a32'; c.beginPath(); c.ellipse(x, y - 92 * s, 7 * s, 3 * s, 0, 0, TAU); c.fill();
    } },
    { x: 0.88, z: 0.8, draw(c, x, y, s, ts) {
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y, 15 * s, 4.5 * s, 0, 0, TAU); c.fill();
      c.fillStyle = '#7d7468'; c.fillRect(x - 9 * s, y - 10 * s, 18 * s, 10 * s); c.fillRect(x - 4 * s, y - 34 * s, 8 * s, 24 * s);
      c.fillStyle = '#8f8678'; c.fillRect(x - 11 * s, y - 50 * s, 22 * s, 16 * s);
      c.fillStyle = '#6a6156'; c.beginPath(); c.moveTo(x - 17 * s, y - 50 * s); c.lineTo(x, y - 64 * s); c.lineTo(x + 17 * s, y - 50 * s); c.closePath(); c.fill();
      const f = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin((ts || 0) / 120);
      c.fillStyle = sceneDay ? 'rgba(255,200,120,.35)' : `rgba(255,190,90,${0.9 * f})`; c.fillRect(x - 5 * s, y - 47 * s, 10 * s, 10 * s);
      if (!sceneDay) glow(c, x, y - 42 * s, 26 * s, '#ffb050', 0.35 * f);
    } }
  ];
  function drawArenaLive(ts) {
    const t = ts / 1000, mo = reduceMotion ? 0 : 1;
    const FL = [['#c0392b', '#e8c477'], ['#e8c477', '#c0392b'], ['#3f6b55', '#efe2b8'], ['#2f4a7a', '#efe2b8']];
    [[PLAT.x0, PLAT.z0], [PLAT.x1, PLAT.z0], [PLAT.x0, PLAT.z1], [PLAT.x1, PLAT.z1]].forEach(([x, z], i) => {   // cờ phấp phới
      const q = proj(x, z), k = q[2] * au, top = q[1] - platH(z) - 64 * k + 4 * k, dir = x < 0.5 ? -1 : 1, w = 26 * k, h = 16 * k;
      g.fillStyle = FL[i][0]; g.beginPath(); g.moveTo(q[0], top);
      for (let j = 0; j <= 6; j++) { const f = j / 6; g.lineTo(q[0] + dir * w * f, top + Math.sin(t * 4 * mo - f * 3 + i) * 2.5 * k * f); }
      for (let j = 6; j >= 0; j--) { const f = j / 6; g.lineTo(q[0] + dir * w * f, top + h - f * 3 * k + Math.sin(t * 4 * mo - f * 3 + i) * 2.5 * k * f); }
      g.closePath(); g.fill();
      g.strokeStyle = FL[i][1]; g.lineWidth = Math.max(1, 1.2 * k); g.stroke();
    });
    if (!mo) return;
    for (let i = 0; i < 6; i++) {                            // lá bay
      const ph = (t * 0.05 + hash(i, 8)) % 1, x = ((hash(i, 9) + ph * 0.6) % 1.1) * W, y = H * 0.1 + ph * H * 0.85 + Math.sin(t * 2 + i) * 10;
      g.save(); g.translate(x, y); g.rotate(t * 2 + i); g.fillStyle = i % 2 ? 'rgba(196,140,60,.75)' : 'rgba(150,170,80,.7)';
      g.beginPath(); g.ellipse(0, 0, 4 * au, 1.8 * au, 0, 0, TAU); g.fill(); g.restore();
    }
  }

  let paused = false;
  function frame(ts) {
    const dt = Math.min(64, ts - (last || ts)); last = ts;
    if (W && H && !document.hidden && !paused) {
      const now = serverNow();
      if (scene !== 'hall') { const day = yardInDaylight(now); if (day !== yardDay || day !== sceneDay) { yardDay = sceneDay = day; bg = null; } }
      if (!bg) { if (scene === 'yard') drawYard(); else if (scene === 'library') drawLibrary(); else if (scene === 'arena') drawArenaYard(); else drawBg(); }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(bg, 0, 0);
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (hoverLib && G.lib && scene === 'hall') {
        const L = G.lib, a = 0.35 + 0.2 * Math.sin(ts / 260);
        g.strokeStyle = `rgba(255,211,107,${a})`; g.lineWidth = 2; g.strokeRect(L.x - 6, L.y - 4, L.w + 12, L.h + 4);
      }
      if (scene === 'hall') { drawAltar(ts); drawIncense(now, dt); drawFortuneJar(); }
      else if (scene === 'yard') drawReaders(ts);
      else if (scene === 'library') drawLibraryLive(ts);
      else if (scene === 'arena') drawArenaLive(ts);
      drawPlayers(ts, dt);
      drawFx(ts, dt);
    }
    requestAnimationFrame(frame);
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    DPR = Math.min(2, root.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    geo(); bg = null;
  }
  const hitBowl = (x, y) => Math.abs(x - G.bowl.x) < G.bowl.rx + 14 * u && y > G.bowl.y - 84 * u && y < G.ty + 10 * u;
  const hitStatue = (x, y) => Math.abs(x - W / 2) < 82 * u && y > G.statueTop && y < G.pedY;
  const hitLib = (x, y) => !!G.lib && x > G.lib.x - 10 * u && x < G.lib.x + G.lib.w + 10 * u && y > G.lib.y - 6 * u && y < G.lib.y + G.lib.h + 4 * u;
  let hoverLib = false;
  function point(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  const inRect = (L, x, y) => !!L && x > L.x - 6 && x < L.x + L.w + 6 && y > L.y - 4 && y < L.y + L.h + 4;
  function seatAt(x, y) {
    for (let i = LIB_SEATS.length - 1; i >= 0; i--) {
      const [sx, sy, s] = seatScale(i), dx = (x - sx) / (31 * s + 6), dy = (y - sy + 4 * s) / (14 * s + 6);
      if (dx * dx + dy * dy <= 1) return i;
    }
    return -1;
  }
  function personAt(x, y) {
    let best = null;
    for (const p of players.values()) {
      if (p.id === me || p.sx == null || viewOf(p) !== scene) continue;
      const hh = (p.hy || 104) * p.s, w = 17 * p.s + 6;
      if (x > p.sx - w && x < p.sx + w && y > p.sy - hh - 16 && y < p.sy + 6 && (!best || p.dz > best.dz)) best = p;
    }
    return best;
  }
  function walkTo(x, y) {
    const [wx, wz] = unproj(x, y);
    clickMark = { x, y, t: performance.now() };
    handlers.floor && handlers.floor(clamp(wx, 0.03, 0.97), clamp(wz, 0.12, 0.97));
  }
  function onDown(e) {
    const [x, y] = point(e);
    const clickedPlayer = personAt(x, y);
    if (clickedPlayer) { handlers.person && handlers.person(clickedPlayer.id); return; }
    const specialNpc = npcs.find(p => p.secretEncounter && viewOf(p) === scene && p.sx != null && Math.abs(x - p.sx) < 25 * p.s + 12 && y > p.sy - 120 * p.s - 20 && y < p.sy + 10);
    if (specialNpc) { handlers.secretNpc && handlers.secretNpc(specialNpc.npc.role); return; }
    if (scene === 'arena') {
      if (y > G.hb + 4 * u) walkTo(x, y);
      return;
    }
    if (scene === 'library') {
      if (sweeper && sweeper.sx != null && sweeper.until > serverNow() && Math.abs(x - sweeper.sx) < 25 * sweeper.s + 12 && y > sweeper.sy - 120 * sweeper.s - 20 && y < sweeper.sy + 10) { handlers.sweeper && handlers.sweeper(sweeper.eventId); return; }
      const seat = seatAt(x, y);
      if (seat >= 0) { handlers.seat && handlers.seat(seat); return; }
      if (inRect(G.shelfL, x, y)) { handlers.read && handlers.read(); return; }
      if (inRect(G.shelfR, x, y)) { handlers.dojo && handlers.dojo(); return; }
      if (y > G.hb + 4 * u) walkTo(x, y);
      return;
    }
    if (scene === 'hall' && hitJar(x, y)) { handlers.fortune && handlers.fortune(); return; }
    if (scene === 'yard' && hitReader(x, y)) { handlers.reader && handlers.reader(x < W / 2 ? 'horoscope' : 'tarot'); return; }
    if (scene === 'yard') { if (y > G.hb) { const [wx, wz] = unproj(x, y); handlers.floor && handlers.floor(clamp(wx, 0.03, 0.97), clamp(wz, 0.12, 0.97)); } return; }
    if (hitBowl(x, y)) { handlers.altar && handlers.altar(); return; }
    if (hitStatue(x, y)) { handlers.statue && handlers.statue(); return; }
    if (hitLib(x, y)) { handlers.library && handlers.library(); return; }
    if (y > G.hb + 6 * u) {
      const [wx, wz] = unproj(x, y);
      clickMark = { x, y, t: performance.now() };
      handlers.floor && handlers.floor(clamp(wx, 0.03, 0.97), clamp(wz, 0.12, 0.97));
    }
  }
  function onMove(e) {
    const [x, y] = point(e);
    hoverLib = scene === 'hall' && hitLib(x, y);
    hover = '';
    if (scene === 'library') { const st = seatAt(x, y); hover = st >= 0 ? 'seat' + st : inRect(G.shelfL, x, y) ? 'shelfL' : inRect(G.shelfR, x, y) ? 'shelfR' : ''; }
    if (personAt(x, y)) hover = 'person';
    cv.style.cursor = hover || (scene === 'hall' && (hitJar(x, y) || hitBowl(x, y) || hitStatue(x, y))) || (scene === 'yard' && hitReader(x, y)) || hoverLib ? 'pointer' : (y > G.hb ? 'crosshair' : 'default');
  }
  function viewOf(p) {
    if (p.place === 'arena') return 'arena';
    if (p.place && p.place !== 'hall') return '';
    return p.scene || 'hall';
  }
  const listened = new WeakSet();
  let RO = null;
  function listen(c) {
    if (listened.has(c)) return;
    listened.add(c);
    c.addEventListener('pointerdown', e => { if (c === cv) onDown(e); });
    c.addEventListener('pointermove', e => { if (c === cv) onMove(e); });
    if (RO) RO.observe(c);
  }

  function mk(p) { return { scene: p.scene || 'hall', place: p.at || 'hall', sit: p.sit >= 0 ? p.sit : -1, cm: p.cm || '', lift: 0, hy: 104, id: p.id, name: p.name, look: p.look, mod: !!p.mod, x: p.x, z: p.z, dx: p.x, dz: p.z, front: false, walking: false, bubble: null, bowAt: 0, v: p.v || 0, rd: p.rd || '', au: p.au || 0, talk: 0, burst: null, mt: p.mt || 0, pens: [], rburst: 0, dmp: null }; }

  root.Hall = {
    COLORS, HAIRS,
    init(canvas, h) {
      cv = canvas; g = cv.getContext('2d'); Object.assign(handlers, h || {});
      if (root.ResizeObserver) RO = new ResizeObserver(resize); else root.addEventListener('resize', resize);
      listen(cv);
      resize();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { bg = null; });
      requestAnimationFrame(frame);
    },
    setMe(id) { me = id; },
    setSweeper(event) {
      if (!event || !event.id || event.until <= serverNow()) { sweeper = null; return; }
      sweeper = { ...mk({ id: -999, name: 'Tảo Địa Tăng · Chạm để trò chuyện', look: { g: 'nam', c: 8, h: 2 }, x: event.x, z: event.z, scene: 'library' }), eventId: event.id, until: event.until, npc: { role: 'sweeper' } };
      sweeper.front = true;
    },
    /** Tạm dừng vẽ khi người chơi đang ở nơi khác (đỡ tốn pin). */
    pause(on) { paused = !!on; if (!on) { last = 0; resize(); } },
    /** Vẽ cảnh lên một khung vẽ khác (Sân đấu có khung riêng trong màn hình của nó). Gọi lại với khung chánh điện để trả về. */
    attach(canvas) { if (!canvas || canvas === cv) return; cv = canvas; g = cv.getContext('2d'); listen(cv); hover = ''; resize(); bg = null; },
    /** Người đi sang nơi khác (Võ Học Các, Sân đấu) hay quay về; x, z là chỗ đứng ở lối vào (nếu máy chủ gửi). */
    setPlace(id, place, x, z) {
      const p = players.get(id); if (!p) return;
      p.place = place || 'hall'; p.sit = -1; p.cm = ''; p.lift = 0;
      if (x != null && z != null) { p.x = p.dx = x; p.z = p.dz = z; } else { p.dx = p.x; p.dz = p.z; }
    },
    /** Ngồi bồ đoàn (sit = số bồ đoàn, −1 là đứng dậy) và công pháp đang tu (để vẽ linh khí). */
    setSit(id, sit, cm) { const p = players.get(id); if (p) { p.sit = sit >= 0 ? sit : -1; p.cm = p.sit >= 0 ? cm || '' : ''; } },
    /** Sân đấu: hàm cho biết nhãn trên đầu từng người { text, color } (rảnh / đang đấu / tạm nghỉ). */
    setTagger(fn) { tagger = typeof fn === 'function' ? fn : null; },
    seatCount: LIB_SEATS.length,
    seatPos: i => LIB_SEATS[i] || null,
    get scene() { return scene; },
    /** Vẽ một nhân vật tại gốc toạ độ hiện tại (chân ở 0,0, cao khoảng 85 đơn vị) cho các màn hình khác dùng lại. */
    avatar(c, look, opts) { opts = opts || {}; drawAvatar(c, look, opts.front !== false, opts.t || 0, opts.bow || 0, !!opts.walking, opts.pose || null); },
    setScene(value) { if (value === scene) return; scene = value; hover = ''; hoverLib = false; if (W && H) geo(); bg = null; },
    playerScene(d) { const p = players.get(d.id); if (p) { p.scene = d.scene; p.sit = -1; p.cm = ''; p.x = p.dx = d.x; p.z = p.dz = d.z; } },
    setOffset(ms) { offset = ms; },
    setPlayers(list) { players.clear(); list.forEach(p => players.set(p.id, mk(p))); },
    addPlayer(p) { players.set(p.id, mk(p)); },
    removePlayer(id) { players.delete(id); },
    updatePlayer(d) { const p = players.get(d.id); if (p) { p.name = d.name; p.look = d.look; } },
    positions(arr) { for (const [id, x, z] of arr) { const p = players.get(id); if (p) { p.x = x / 1000; p.z = z / 1000; } } },
    player(id) { return players.get(id); },
    list() { return [...players.values()]; },
    count() { return players.size; },
    setVoice(id, v) { const p = players.get(id); if (p) { p.v = v; if (!v) p.talk = 0; } },
    setTalk(id, level) { const p = players.get(id); if (p) p.talk = level; },
    setReading(id, rd) { const p = players.get(id); if (p) p.rd = rd || ''; },
    setAura(id, a, up) {
      const p = players.get(id); if (!p) return;
      p.au = a || 0;
      if (up && a && a.t) p.burst = { t: performance.now(), tier: a.t };
    },
    setMerit(id, mt, up) { const p = players.get(id); if (p) { p.mt = mt; if (up) p.rburst = performance.now(); } },
    penalty(id, n) { const p = players.get(id); if (p) p.pens.push({ n, t: performance.now() }); },
    meritPreview(canvas, look, rank, demonN, time) {
      const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
      const gr = c.createRadialGradient(w / 2, h * 0.6, 4, w / 2, h * 0.55, w * 0.9);
      gr.addColorStop(0, demonN ? '#24101a' : '#3a1d10'); gr.addColorStop(1, '#0d0705');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const s = h / (demonN >= 4 ? 245 : 210), off = demonN ? demonOffset(demonN) : [0, 0];
      c.save(); c.translate(w / 2 - off[0] * s * 0.45, h * 0.9); c.scale(s, s);   // dời cả cặp người + quỷ vào giữa khung
      if (demonN) { c.save(); c.translate(off[0], off[1] - (demonN >= 4 ? 4 : 2) + Math.sin(time * 2) * 3); demon(c, demonN, time, 1); c.restore(); }
      if (rank) meritHalo(c, rank, time, null);
      drawAvatar(c, look, true, time, 0, false);
      c.restore();
    },
    libraryPos() { return G.lib ? unproj(G.lib.x + G.lib.w + 40 * u, G.hb + 30 * u) : null; },
    setIncense(list) { incense = list.slice(); },
    addIncense(list) { incense.push(...list); if (incense.length > 120) incense.splice(0, incense.length - 120); },
    setAltar(today) { for (const k in altar) altar[k] = today[k] || 0; },
    heart(pid) {
      const p = players.get(pid); if (!p || p.sx == null || hearts.length > 160) return;
      const cs = ['#ff5d7a', '#ff8fa3', '#e8364f', '#ffb3c1'];
      hearts.push({ x: p.sx + rand(-6, 6), y: p.sy - ((p.hy || 104) - 4) * p.s, t: 0, k: Math.max(0.7, au), ph: rand(0, 6), c: cs[(Math.random() * cs.length) | 0] });
    },
    bow(pid) { const p = players.get(pid); if (p) { p.bowAt = performance.now(); p.front = false; p.idleT = 0; } },
    bubble(pid, text) { const p = players.get(pid); if (p) p.bubble = { text, t: performance.now() }; },
    bell() { if (!reduceMotion) ripples.push({ t: 0 }); },
    floater(text) { floaters.push({ text, x: G.bowl ? G.bowl.x : W / 2, y: G.bowl ? G.bowl.y - 70 * u : H / 3, t: 0 }); },
    auraPreview(canvas, look, tier, time) {
      const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
      const gr = c.createRadialGradient(w / 2, h * 0.6, 4, w / 2, h * 0.55, w * 0.9);
      gr.addColorStop(0, '#3a1d10'); gr.addColorStop(1, '#0d0705');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const s = h / 190;
      c.save(); c.translate(w / 2, h * 0.88); c.scale(s, s);
      aura(c, tier, time, 1, tier * 0.9, false);
      drawAvatar(c, look, true, time, 0, false);
      aura(c, tier, time, 1, tier * 0.9, true);
      c.restore();
    },
    preview(canvas, look) {
      const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
      const gr = c.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h * 0.5, w * 0.7);
      gr.addColorStop(0, '#4a2616'); gr.addColorStop(1, '#140a06');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const s = h / 125;
      c.save(); c.translate(w * 0.34, h * 0.92); c.scale(s, s); drawAvatar(c, look, true, 0, 0, false); c.restore();
      c.save(); c.translate(w * 0.74, h * 0.92); c.scale(s * 0.8, s * 0.8); drawAvatar(c, look, false, 0, 0, false); c.restore();
    }
  };
})(this);
