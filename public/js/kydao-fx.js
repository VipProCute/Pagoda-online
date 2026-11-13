/* Kỳ Đài · hiệu ứng 2D trên lớp phủ bàn cờ: khai mở sân, chấn động phong cấp, chiến thắng.
 * Dùng chung Node + trình duyệt: phần toán thuần (joltAt, shakeAt, domainSweep, winPlan, hạt) chạy được trong Node để test;
 * phần DOM chỉ chạy khi gọi mount(). Không phụ thuộc thư viện. Thiết kế: docs/KE-HOACH-KY-DAI.md §3 (K7, K8) và §4.4.
 *
 * API (toạ độ là px CSS tính từ góc trên-trái của wrapEl = .kd-boardwrap):
 *   KydaoFx.mount(wrapEl, { reduced })   gắn <canvas class="kdfx-canvas"> + <div class="kdfx-banner"> vào wrapEl
 *   KydaoFx.play('domain',  { side, fieldId, rect:{x,y,w,h}, fromBottom })
 *   KydaoFx.play('promote', { at:{x,y}, piece, cell, onJolt(getOffset) })
 *        getOffset(x, y) -> { dx, dy }  độ lệch tạm của quân đang đứng ở điểm (x,y); gọi MỖI KHUNG;
 *        khi hết (hoặc stop()) gọi onJolt(null) đúng một lần để bên vẽ biết đã xong.
 *   KydaoFx.play('win',     { game, reason, result, mine, king:{x,y}, line:[{x,y}...] })
 *   KydaoFx.stop()   dọn canvas, banner, timer, bàn đang rung
 *   KydaoFx.unmount()
 *   bannerOnly: true = chỉ hiện chữ, không vẽ lên canvas (dùng khi bàn 3D tự diễn hiệu ứng).
 * Tắt hiệu ứng (prefers-reduced-motion, mount({reduced:true}) hoặc localStorage 'ta-fx' = '0'): chỉ còn chữ mờ dần,
 * không rung, không hạt, không gọi onJolt. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KydaoFx = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  /* ===== Hằng số (đơn vị: mili giây, px) ===== */
  const DOMAIN_MS = 1800;            // K7: màn khẩu hiệu tối đa 1,8 giây
  const PROMOTE_MS = 1200;           // chấn động tối đa 1,2 giây
  const WIN_MS = 2400;
  const WAVE_SPEED = 0.45;           // px/ms: sóng chấn động lan ra từ ô phong cấp
  const JOLT_DUR = 420;              // mỗi quân nảy lên rồi rơi về trong chừng này ms
  const SHAKE_MS = 640;              // bàn rung trong chừng này ms
  const PARTICLE_MAX = 160;
  const FX_KINDS = ['ember', 'ripple', 'leaf', 'snow', 'bubble', 'petal', 'spark', 'sand'];
  const KEY_FX = 'ta-fx';

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);       // easeOutCubic
  const isNum = n => typeof n === 'number' && isFinite(n);

  /* ===== Toán thuần ===== */

  /** Độ lệch tạm của một quân cách ô phong cấp `distance` px, tại thời điểm t ms kể từ lúc phong cấp.
   * Gần thì nảy mạnh và sớm, xa thì yếu và trễ (sóng lan); nảy lên rồi rơi về đúng chỗ (về 0 khi hết).
   * opts: { cell (px, mặc định 48), dirX, dirY (vector đơn vị hướng ra xa tâm, để lệch ngang nhẹ) }.
   * Trả { dx, dy } với dy <= 0 (bay lên). */
  function joltAt(distance, t, opts) {
    const o = opts || {};
    const cell = isNum(o.cell) && o.cell > 0 ? o.cell : 48;
    const d = isNum(distance) && distance > 0 ? distance : 0;
    const delay = d / WAVE_SPEED;
    const u = (t - delay) / JOLT_DUR;
    if (!isNum(t) || u <= 0 || u >= 1) return { dx: 0, dy: 0 };
    const amp = 0.62 * cell * Math.exp(-d / (4.2 * cell));
    // nảy lên (sin), tắt dần về 0 ở u=1 cả giá trị lẫn đạo hàm gần đúng
    const hop = amp * Math.sin(Math.PI * u) * (1 - 0.35 * u);
    const side = hop * 0.18;
    return { dx: (isNum(o.dirX) ? o.dirX : 0) * side, dy: -hop };
  }

  /** Khoảng cách xa nhất (px) còn kịp nảy trong thời lượng PROMOTE_MS. */
  function joltReach() { return Math.max(0, (PROMOTE_MS - JOLT_DUR) * WAVE_SPEED); }

  /** Bàn rung: độ lệch (px) của cả lớp bàn tại t ms. Cú giật chính rồi một dư chấn nhỏ, tắt hẳn sau SHAKE_MS. */
  function shakeAt(t, amp) {
    const a = isNum(amp) ? amp : 10;
    if (!isNum(t) || t < 0 || t >= SHAKE_MS) return { dx: 0, dy: 0 };
    const main = Math.pow(1 - t / SHAKE_MS, 2);
    const after = t > 260 ? 0.35 * Math.pow(1 - (t - 260) / (SHAKE_MS - 260), 2) : 0;
    const k = (main + after) * a;
    return { dx: Math.sin(t * 0.085) * k, dy: Math.cos(t * 0.067) * k * 0.8 };
  }

  /** Vệt sáng quét nửa sân. Trả { front 0..1 (vị trí đầu vệt, tính từ mép người chơi), alpha 0..1 }. */
  function domainSweep(t) {
    if (!isNum(t) || t <= 0) return { front: 0, alpha: 0 };
    if (t >= DOMAIN_MS) return { front: 1, alpha: 0 };
    const front = ease(t / 760);
    const rise = clamp(t / 140, 0, 1);
    const fall = t < 1000 ? 1 : clamp(1 - (t - 1000) / (DOMAIN_MS - 1000), 0, 1);
    return { front, alpha: rise * fall };
  }

  /** Phân loại lý do kết thúc (chuỗi của lib/kydao/manager.js và engine) về nhóm hiệu ứng. */
  function classifyReason(game, reason, result) {
    const r = String(reason || '').toLowerCase();
    if (result === 'draw' || r === 'agreed' || r === 'threefold' || r === 'stalemate' || r === 'fifty' || r === 'repetition' || r === 'insufficient' || r === 'timeout-insufficient' || r === 'draw') return 'draw';
    if (r === 'five') return 'five';
    if (r === 'score') return 'score';
    if (r === 'timeout') return 'timeout';
    if (r === 'resign') return 'resign';
    if (game === 'chess' || game === 'xiangqi' || game === 'jieqi') return 'mate';
    return 'generic';
  }

  /** Kế hoạch màn thắng thua: { kind, tone:'win'|'lose'|'soft', title, sub }. tone theo góc nhìn người xem. */
  function winPlan(o) {
    const x = o || {};
    const kind = classifyReason(x.game, x.reason, x.result);
    const draw = kind === 'draw';
    const mine = x.mine === true ? true : x.mine === false ? false : null;
    const tone = draw || mine === null ? 'soft' : mine ? 'win' : 'lose';
    const w = tone === 'win';
    let title, sub;
    if (draw) { title = 'Hòa cờ'; sub = 'Thế cờ cân bằng, tâm vẫn an'; }
    else if (kind === 'mate') {
      title = x.game === 'chess' ? 'Chiếu hết!' : 'Bắt Tướng!';
      sub = tone === 'soft' ? 'Ván cờ đã ngã ngũ' : w ? 'Nước cờ định đoạt' : 'Thế cờ đã tàn, tâm vẫn an';
    } else if (kind === 'five') {
      title = 'Năm quân liền!'; sub = tone === 'soft' ? 'Ván cờ đã ngã ngũ' : w ? 'Thế trận thành hình' : 'Đối thủ nối đủ năm';
    } else if (kind === 'score') {
      title = 'Thắng điểm!'; sub = tone === 'soft' ? 'Hai bên đã tính điểm' : w ? 'Đất rộng, thế vững' : 'Tiếc quá, thua vài mục';
    } else if (kind === 'timeout') {
      title = 'Hết giờ!'; sub = tone === 'soft' ? 'Đồng hồ đã dừng' : w ? 'Đối thủ cạn thời gian' : 'Bạn cạn thời gian';
    } else if (kind === 'resign') {
      title = 'Xin thua'; sub = tone === 'soft' ? 'Một bên buông cờ' : w ? 'Đối thủ buông cờ' : 'Bạn buông cờ';
    } else {
      title = tone === 'soft' ? 'Hết ván' : w ? 'Thắng!' : 'Thua rồi'; sub = '';
    }
    if (!draw && kind !== 'mate' && kind !== 'five' && kind !== 'score' && kind !== 'timeout' && kind !== 'resign') sub = '';
    return { kind, tone, title, sub };
  }

  /* ===== Hạt =====
   * Hạt: { shape:'dot'|'ring'|'line'|'petal', x, y, vx, vy (px/ms), g (gia tốc y), sway, size, vs (đổi cỡ), rot, vr, age, life, color } */
  const rnd = (rng, a, b) => a + (b - a) * rng();

  /** Sinh một hạt theo kiểu `fx` của sân, nằm trong rect {x,y,w,h}. rng() trả [0,1). */
  function spawnParticle(fx, rect, rng, glow) {
    const r = rng || Math.random;
    const R = rect && isNum(rect.w) ? rect : { x: 0, y: 0, w: 100, h: 100 };
    const col = typeof glow === 'string' ? glow : '#ffd27a';
    const px = () => R.x + rnd(r, 0, R.w), py = () => R.y + rnd(r, 0, R.h);
    const p = { shape: 'dot', x: px(), y: py(), vx: 0, vy: 0, g: 0, sway: 0, size: 3, vs: 0, rot: 0, vr: 0, age: 0, life: 1000, color: col };
    switch (fx) {
      case 'ember': p.y = R.y + R.h * rnd(r, 0.55, 1); p.vy = -rnd(r, 0.05, 0.12); p.vx = rnd(r, -0.02, 0.02); p.size = rnd(r, 1.6, 3.6); p.life = rnd(r, 800, 1500); p.color = r() < 0.5 ? col : '#ffd27a'; break;
      case 'ripple': p.shape = 'ring'; p.size = 3; p.vs = rnd(r, 0.022, 0.04); p.life = rnd(r, 800, 1200); break;
      case 'leaf': p.shape = 'petal'; p.y = R.y; p.vy = rnd(r, 0.035, 0.07); p.sway = rnd(r, 0.02, 0.05); p.size = rnd(r, 4, 7); p.rot = rnd(r, 0, 6.28); p.vr = rnd(r, -0.004, 0.004); p.life = rnd(r, 1000, 1600); break;
      case 'snow': p.y = R.y; p.vy = rnd(r, 0.04, 0.08); p.sway = rnd(r, 0.01, 0.03); p.size = rnd(r, 1.6, 3.6); p.life = rnd(r, 1000, 1600); p.color = '#ffffff'; break;
      case 'bubble': p.shape = 'ring'; p.y = R.y + R.h; p.vy = -rnd(r, 0.04, 0.09); p.size = rnd(r, 2, 6); p.vs = 0.002; p.life = rnd(r, 900, 1500); break;
      case 'petal': p.shape = 'petal'; p.y = R.y; p.vy = rnd(r, 0.03, 0.06); p.sway = rnd(r, 0.02, 0.04); p.size = rnd(r, 4, 8); p.rot = rnd(r, 0, 6.28); p.vr = rnd(r, -0.004, 0.004); p.life = rnd(r, 1000, 1700); p.color = r() < 0.5 ? '#ffd1e0' : '#fff2c2'; break;
      case 'spark': p.shape = 'line'; p.size = rnd(r, 14, 38); p.rot = rnd(r, 0, 6.28); p.life = rnd(r, 110, 260); break;
      case 'sand': p.x = R.x; p.vx = rnd(r, 0.18, 0.34); p.vy = rnd(r, -0.02, 0.03); p.size = rnd(r, 1.2, 2.8); p.life = rnd(r, 700, 1300); break;
      default: p.vy = -rnd(r, 0.02, 0.06); p.life = rnd(r, 700, 1200);
    }
    return p;
  }

  /** Hạt cánh sen toả ra từ (cx,cy) cho pháo hoa. */
  function burstParticle(cx, cy, rng, color) {
    const r = rng || Math.random;
    const a = rnd(r, 0, Math.PI * 2), v = rnd(r, 0.08, 0.26);
    return { shape: 'petal', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.00022, sway: 0, size: rnd(r, 4, 8), vs: 0, rot: a, vr: rnd(r, -0.006, 0.006), age: 0, life: rnd(r, 900, 1500), color: color || (r() < 0.5 ? '#ffc4d8' : '#ffe08a') };
  }

  /** Tiến hạt dt ms. Trả true nếu còn sống. */
  function stepParticle(p, dt) {
    p.age += dt;
    p.vy += p.g * dt;
    p.x += p.vx * dt + (p.sway ? Math.sin(p.age * 0.006) * p.sway * dt : 0);
    p.y += p.vy * dt;
    p.size += p.vs * dt;
    p.rot += p.vr * dt;
    return p.age < p.life;
  }

  /** Độ đậm 0..1 của hạt theo tuổi: hiện nhanh, mờ dần ở 45% cuối. */
  function particleAlpha(p) {
    const u = clamp(p.age / p.life, 0, 1);
    return clamp(u / 0.1, 0, 1) * (u < 0.55 ? 1 : clamp((1 - u) / 0.45, 0, 1));
  }

  /* ===== Phần DOM (chỉ chạy sau mount) ===== */
  const store = {
    get(k) { try { return root.localStorage ? root.localStorage.getItem(k) : null; } catch (e) { return null; } }
  };
  const fxOn = () => store.get(KEY_FX) !== '0';
  const mediaReduced = () => { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };

  let M = null;   // trạng thái đã mount

  function isReduced() { return !!(M && (M.reduced === true || mediaReduced() || !fxOn())); }

  function mount(wrapEl, opts) {
    if (M) unmount();
    if (!wrapEl || !root.document) return api;
    const doc = root.document;
    const canvas = doc.createElement('canvas');
    canvas.className = 'kdfx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const banner = doc.createElement('div');
    banner.className = 'kdfx-banner';
    banner.setAttribute('aria-live', 'polite');
    const crest = doc.createElement('img'); crest.className = 'kdfx-crest'; crest.alt = ''; crest.hidden = true; if (typeof crest.setAttribute === 'function') crest.setAttribute('hidden', '');
    const cry = doc.createElement('div'); cry.className = 'kdfx-cry';
    const sub = doc.createElement('div'); sub.className = 'kdfx-sub';
    banner.appendChild(crest); banner.appendChild(cry); banner.appendChild(sub);
    wrapEl.appendChild(canvas); wrapEl.appendChild(banner);
    M = {
      wrap: wrapEl, canvas, banner, crest, cry, sub,
      ctx: canvas.getContext ? canvas.getContext('2d') : null,
      reduced: !!(opts && opts.reduced),
      effects: [], parts: [], raf: 0, last: 0, timers: [], bannerTimer: 0,
      w: 0, h: 0, dpr: 1, shakeFrom: null, shakeSaved: null, jolt: null
    };
    return api;
  }

  function unmount() {
    if (!M) return;
    stop();
    const m = M; M = null;
    [m.canvas, m.banner].forEach(n => { if (n.parentNode) n.parentNode.removeChild(n); });
  }

  function later(fn, ms) {
    const id = setTimeout(() => { if (M) M.timers = M.timers.filter(x => x !== id); fn(); }, ms);
    M.timers.push(id);
  }

  function fit() {
    const m = M;
    const w = m.wrap.clientWidth || 300, h = m.wrap.clientHeight || 300;
    const dpr = Math.min(2, (root.devicePixelRatio || 1));
    if (w !== m.w || h !== m.h || dpr !== m.dpr) {
      m.w = w; m.h = h; m.dpr = dpr;
      m.canvas.width = Math.round(w * dpr); m.canvas.height = Math.round(h * dpr);
    }
  }

  function setShake(dx, dy) {
    const m = M;
    if (m.shakeSaved === null) m.shakeSaved = m.wrap.style.translate || '';
    m.wrap.style.translate = (dx || dy) ? dx.toFixed(2) + 'px ' + dy.toFixed(2) + 'px' : m.shakeSaved;
  }
  function clearShake() {
    const m = M;
    if (m.shakeSaved !== null) { m.wrap.style.translate = m.shakeSaved; m.shakeSaved = null; }
  }

  function showBanner(title, sub, o) {
    const m = M;
    clearTimeout(m.bannerTimer);
    m.cry.textContent = title || '';
    m.sub.textContent = sub || '';
    if (m.crest) {
      const src = o && o.crest ? o.crest : '';
      m.crest.hidden = !src;
      if (src) m.crest.src = src;
      else if (typeof m.crest.removeAttribute === 'function') m.crest.removeAttribute('src');
      else m.crest.src = '';
    }
    m.banner.style.setProperty('--kdfx-glow', (o && o.glow) || '#ffd27a');
    m.banner.className = 'kdfx-banner kdfx-' + ((o && o.kind) || 'domain') + ' kdfx-tone-' + ((o && o.tone) || 'win') + (isReduced() ? ' kdfx-reduced' : '');
    void m.banner.offsetWidth;                                   // khởi động lại animation CSS
    m.banner.classList.add('is-on');
    m.bannerTimer = setTimeout(() => { if (M === m) { m.banner.classList.remove('is-on'); if (m.crest) m.crest.hidden = true; m.cry.textContent = ''; m.sub.textContent = ''; } }, (o && o.ms) || DOMAIN_MS);
  }

  function loop(now) {
    const m = M;
    if (!m) return;
    m.raf = 0;
    const dt = clamp(now - (m.last || now), 0, 50);
    m.last = now;
    const ctx = m.ctx;
    if (ctx) {
      fit();
      ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
      ctx.clearRect(0, 0, m.w, m.h);
    }
    m.effects = m.effects.filter(e => {
      const t = now - e.t0;
      if (t >= e.dur) { if (e.end) e.end(); return false; }
      if (ctx) { ctx.save(); e.draw(ctx, t, dt); ctx.restore(); }
      return true;
    });
    if (ctx) {
      m.parts = m.parts.filter(p => { const alive = stepParticle(p, dt); if (alive) drawParticle(ctx, p); return alive; });
    }
    if (m.effects.length || m.parts.length) m.raf = root.requestAnimationFrame(loop);
    else { m.last = 0; if (ctx) ctx.clearRect(0, 0, m.w, m.h); }
  }
  function kick() {
    if (M && !M.raf && root.requestAnimationFrame) { M.last = 0; M.raf = root.requestAnimationFrame(loop); }
  }
  function addEffect(dur, draw, end) {
    const m = M;
    m.effects.push({ t0: root.performance ? root.performance.now() : Date.now(), dur, draw, end });
    kick();
  }
  function addParticle(p) {
    const m = M;
    if (m.parts.length >= PARTICLE_MAX) return false;
    m.parts.push(p);
    return true;
  }

  function drawParticle(ctx, p) {
    const a = particleAlpha(p);
    if (a <= 0.01) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
    if (p.shape === 'ring') {
      ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, 6.283); ctx.stroke();
    } else if (p.shape === 'line') {
      const dx = Math.cos(p.rot) * p.size, dy = Math.sin(p.rot) * p.size;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + dx * 0.4 - dy * 0.18, p.y + dy * 0.4 + dx * 0.18);
      ctx.lineTo(p.x + dx * 0.55 + dy * 0.12, p.y + dy * 0.55 - dx * 0.12);
      ctx.lineTo(p.x + dx, p.y + dy); ctx.stroke();
    } else if (p.shape === 'petal') {
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, 6.283); ctx.fill();
      ctx.setTransform(M.dpr, 0, 0, M.dpr, 0, 0);
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ----- domain ----- */
  function playDomain(o) {
    const m = M;
    const skins = root.KydaoSkins;
    const f = skins && skins.field ? skins.field(o.fieldId) : null;
    const glow = f ? f.palette.glow : '#ffd27a';
    showBanner(f ? f.cry : 'Khai mở lãnh địa!', f ? f.sub : '', { kind: 'domain', glow, ms: DOMAIN_MS, crest: skins && skins.crest ? skins.crest(o.fieldId) : null });
    if (isReduced() || o.bannerOnly) return;
    const fit0 = () => { fit(); return { x: 0, y: m.h / 2, w: m.w, h: m.h / 2 }; };
    const rect = o.rect && isNum(o.rect.w) ? o.rect : fit0();
    const fromBottom = o.fromBottom !== false;
    const fx = f ? f.fx : 'ember';
    let acc = 0;
    addEffect(DOMAIN_MS, (ctx, t, dt) => {
      const s = domainSweep(t);
      const y0 = fromBottom ? rect.y + rect.h : rect.y;
      const dir = fromBottom ? -1 : 1;
      const yf = y0 + dir * s.front * rect.h;
      ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      const g = ctx.createLinearGradient(0, y0, 0, yf);
      g.addColorStop(0, hexA(glow, 0)); g.addColorStop(1, hexA(glow, 0.42 * s.alpha));
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, Math.min(y0, yf), rect.w, Math.abs(yf - y0));
      const band = 26;
      const g2 = ctx.createLinearGradient(0, yf - dir * band, 0, yf + dir * 4);
      g2.addColorStop(0, hexA('#ffffff', 0)); g2.addColorStop(0.8, hexA('#ffffff', 0.85 * s.alpha)); g2.addColorStop(1, hexA(glow, 0));
      ctx.fillStyle = g2;
      ctx.fillRect(rect.x, Math.min(yf - dir * band, yf + dir * 4), rect.w, band + 4);
      if (t < 1200) {                                            // hạt theo kiểu của sân
        acc += dt * 0.1;
        while (acc >= 1) { acc -= 1; addParticle(spawnParticle(fx, rect, Math.random, glow)); }
      }
    });
  }

  /* ----- promote ----- */
  function playPromote(o) {
    const m = M;
    if (isReduced()) return;
    const at = o.at && isNum(o.at.x) ? o.at : { x: m.wrap.clientWidth / 2, y: m.wrap.clientHeight / 2 };
    const cell = isNum(o.cell) && o.cell > 0 ? o.cell : 48;
    const cb = typeof o.onJolt === 'function' ? o.onJolt : null;
    let curT = 0;
    const getOffset = (x, y) => {
      const dx = x - at.x, dy = y - at.y, d = Math.hypot(dx, dy) || 0;
      return joltAt(d, curT, { cell, dirX: d ? dx / d : 0, dirY: d ? dy / d : 0 });
    };
    m.jolt = cb;
    addEffect(PROMOTE_MS, (ctx, t) => {
      curT = t;
      const sh = shakeAt(t, Math.max(6, Math.min(16, cell * 0.16)));
      setShake(sh.dx, sh.dy);
      // vòng sóng lan từ ô phong cấp, cùng tốc độ với sóng chấn động
      for (let i = 0; i < 2; i++) {
        const tt = t - i * 160;
        if (tt <= 0) continue;
        const r = tt * WAVE_SPEED, a = clamp(1 - tt / 900, 0, 1);
        if (a <= 0) continue;
        ctx.globalAlpha = a * 0.8; ctx.strokeStyle = i ? '#ffd27a' : '#ffffff'; ctx.lineWidth = Math.max(1, 4 * a);
        ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, 6.283); ctx.stroke();
      }
      const fl = clamp(1 - t / 260, 0, 1);                        // chớp sáng ở ô phong cấp
      if (fl > 0) {
        const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, cell * 1.4);
        g.addColorStop(0, hexA('#fff6d0', 0.9 * fl)); g.addColorStop(1, hexA('#ffd27a', 0));
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(at.x, at.y, cell * 1.4, 0, 6.283); ctx.fill();
      }
      if (cb) { try { cb(getOffset); } catch (e) { /* bên vẽ lỗi thì thôi */ } }
    }, () => endPromote());
  }
  function endPromote() {
    const m = M;
    if (!m) return;
    clearShake();
    const cb = m.jolt; m.jolt = null;
    if (cb) { try { cb(null); } catch (e) { /* bỏ qua */ } }
  }

  /* ----- win ----- */
  function playWin(o) {
    const m = M;
    const plan = winPlan(o);
    const glow = plan.tone === 'win' ? '#ffd27a' : plan.tone === 'lose' ? '#8fb4d9' : '#cfe8d8';
    showBanner(plan.title, plan.sub, { kind: 'win', tone: plan.tone, glow, ms: WIN_MS });
    if (isReduced() || o.bannerOnly) return;
    fit();
    const W = m.w, H = m.h;
    const king = o.king && isNum(o.king.x) ? o.king : { x: W / 2, y: H / 2 };
    const line = Array.isArray(o.line) ? o.line.filter(p => p && isNum(p.x) && isNum(p.y)).slice(0, 7) : [];
    // vết nứt dựng sẵn quanh Vua
    const cracks = [];
    if (plan.kind === 'mate' && plan.tone !== 'soft') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.283 + Math.random() * 0.5, pts = [{ x: king.x, y: king.y }];
        let x = king.x, y = king.y, aa = a;
        for (let j = 0; j < 4; j++) { aa += (Math.random() - 0.5) * 0.9; const l = 14 + Math.random() * 22; x += Math.cos(aa) * l; y += Math.sin(aa) * l; pts.push({ x, y }); }
        cracks.push(pts);
      }
    }
    const bursts = [[180, 0.3, 0.3], [520, 0.7, 0.25], [860, 0.5, 0.4]];
    const fired = [false, false, false];
    let nextDust = 0;
    addEffect(WIN_MS, (ctx, t, dt) => {
      if (plan.tone === 'win') {                                  // pháo hoa cánh sen
        bursts.forEach((b, i) => {
          if (!fired[i] && t >= b[0]) {
            fired[i] = true;
            for (let k = 0; k < 28; k++) addParticle(burstParticle(W * b[1], H * b[2], Math.random));
          }
        });
      } else if (plan.tone === 'lose') {                          // bản dịu: màn tối nhẹ + bụi chậm rơi
        const v = Math.sin(clamp(t / WIN_MS, 0, 1) * Math.PI) * 0.22;
        ctx.fillStyle = 'rgba(8,14,28,' + v.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
        nextDust -= dt;
        if (nextDust <= 0 && t < 1500) { nextDust = 90; const p = spawnParticle('snow', { x: 0, y: 0, w: W, h: 10 }, Math.random, '#b8c8e0'); p.color = '#b8c8e0'; p.vy *= 0.6; addParticle(p); }
      } else {                                                    // hòa / người xem: gợn nhẹ giữa bàn
        for (let i = 0; i < 2; i++) {
          const tt = t - i * 380; if (tt <= 0 || tt > 1400) continue;
          ctx.globalAlpha = clamp(1 - tt / 1400, 0, 1) * 0.6; ctx.strokeStyle = glow; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(W / 2, H / 2, tt * 0.12, 0, 6.283); ctx.stroke();
        }
      }
      if (plan.kind === 'mate' && plan.tone !== 'soft') {         // tia sáng dội xuống Vua + vết nứt lan
        const a = clamp(t / 140, 0, 1) * clamp(1 - (t - 500) / 700, 0, 1);
        if (a > 0) {
          const g = ctx.createLinearGradient(0, 0, 0, king.y);
          g.addColorStop(0, hexA(glow, 0)); g.addColorStop(1, hexA('#ffffff', 0.9 * a));
          ctx.fillStyle = g; ctx.fillRect(king.x - 9, 0, 18, king.y);
        }
        const grow = ease((t - 220) / 700);
        if (grow > 0) {
          ctx.strokeStyle = hexA(plan.tone === 'win' ? '#fff3c4' : '#c8d8ee', clamp(1 - (t - 900) / 1200, 0, 1));
          ctx.lineWidth = 2; ctx.lineCap = 'round';
          cracks.forEach(pts => {
            const n = pts.length - 1, upto = grow * n;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i <= n; i++) {
              if (upto >= i) ctx.lineTo(pts[i].x, pts[i].y);
              else { const f = upto - (i - 1); if (f > 0) ctx.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f); break; }
            }
            ctx.stroke();
          });
        }
      }
      if (plan.kind === 'five' && line.length) {                  // vẽ sáng dãy 5 quân
        const a = clamp(1 - (t - 1500) / 900, 0, 1);
        const rad = line.length > 1 ? Math.hypot(line[1].x - line[0].x, line[1].y - line[0].y) * 0.55 : 18;
        ctx.strokeStyle = hexA(glow, 0.9 * a); ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        line.forEach((p, i) => { const on = clamp((t - i * 130) / 160, 0, 1); if (on > 0) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); } });
        ctx.stroke();
        line.forEach((p, i) => {
          const on = clamp((t - i * 130) / 220, 0, 1); if (on <= 0) return;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * (0.6 + 0.5 * on));
          g.addColorStop(0, hexA('#fff6d0', 0.8 * a * on)); g.addColorStop(1, hexA(glow, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 1.1, 0, 6.283); ctx.fill();
        });
      }
      if (plan.kind === 'score' && plan.tone !== 'soft') {        // quét ánh vàng ngang bàn
        const x = ease(t / 900) * W, a = clamp(1 - (t - 700) / 800, 0, 1);
        const g = ctx.createLinearGradient(x - 70, 0, x, 0);
        g.addColorStop(0, hexA(glow, 0)); g.addColorStop(1, hexA(glow, 0.55 * a));
        ctx.fillStyle = g; ctx.fillRect(x - 70, 0, 70, H);
      }
      if (plan.kind === 'timeout' && plan.tone !== 'soft') {      // vòng đồng hồ co lại
        const u = clamp(t / 900, 0, 1), a = clamp(1 - (t - 700) / 700, 0, 1);
        ctx.globalAlpha = a * 0.7; ctx.strokeStyle = glow; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(W / 2, H / 2, (1 - ease(u)) * Math.min(W, H) * 0.4 + 12, 0, 6.283); ctx.stroke();
      }
    });
  }

  /** hex '#rrggbb' (hoặc '#rgb') + alpha → 'rgba(...)'. */
  function hexA(hex, a) {
    let h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (!isFinite(n) || h.length !== 6) return 'rgba(255,255,255,' + clamp(a, 0, 1).toFixed(3) + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  }

  function play(kind, opts) {
    if (!M) return false;
    const o = opts || {};
    // dọn hiệu ứng cùng nhóm đang chạy để không chồng nhau (promote có thể chạy song song với banner)
    if (kind === 'promote') endPromote();
    if (kind === 'domain') playDomain(o);
    else if (kind === 'promote') playPromote(o);
    else if (kind === 'win') playWin(o);
    else return false;
    return true;
  }

  function stop() {
    const m = M;
    if (!m) return;
    m.timers.forEach(clearTimeout); m.timers = [];
    clearTimeout(m.bannerTimer);
    if (m.raf && root.cancelAnimationFrame) root.cancelAnimationFrame(m.raf);
    m.raf = 0; m.last = 0;
    m.effects = []; m.parts = [];
    endPromote();
    if (m.ctx) { m.ctx.setTransform(1, 0, 0, 1, 0, 0); m.ctx.clearRect(0, 0, m.canvas.width, m.canvas.height); }
    m.banner.classList.remove('is-on'); if (m.crest) m.crest.hidden = true; m.cry.textContent = ''; m.sub.textContent = '';
  }

  const api = {
    mount, unmount, play, stop,
    // toán thuần (test được trong Node)
    joltAt, joltReach, shakeAt, domainSweep, classifyReason, winPlan, spawnParticle, burstParticle, stepParticle, particleAlpha, hexA,
    FX_KINDS, DOMAIN_MS, PROMOTE_MS, WIN_MS, WAVE_SPEED, JOLT_DUR, SHAKE_MS, PARTICLE_MAX
  };
  return api;
});
