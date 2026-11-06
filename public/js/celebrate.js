/*
 * Hiệu ứng chúc mừng ở các mốc công đức trong ngày.
 * Máy chủ quyết định lúc nào đạt mốc (socket 'milestone' {at, kind}); file này chỉ lo phần hiển thị:
 *   bless / grand: meme ngẫu nhiên + lời chúc bằng giọng nữ + cánh sen, hoa giấy lấp lánh
 *   scare (666):   mặt quỷ hù một cái rồi hiện câu trấn an
 * Có hai công tắc tắt (lưu trong localStorage): 'ta-fx' (hiệu ứng) và 'ta-scare' (hù ở 666).
 * Thử nhanh: mở trang với ?celebrate=100 (hoặc 300, 666, 999...) hay gõ Celebrate.test(666) trong console.
 */
(function (root) {
  'use strict';
  const doc = root.document;
  const KEY_FX = 'ta-fx', KEY_SCARE = 'ta-scare';
  const DEVIL = '/img/devil.svg';
  // Lời chúc dự phòng (cùng nội dung với bộ file giọng đọc), dùng khi chưa có file mp3
  const BLESSINGS = [
    'Chúc bạn một ngày bình an.',
    'A Di Đà Phật. Chúc bạn một ngày mới an lành.',
    'Chúc bạn thân tâm an lạc, vạn sự như ý.',
    'Công đức viên mãn. Chúc bạn bình an, hạnh phúc.'
  ];
  const HAS_POPOVER = !!(root.HTMLElement && typeof root.HTMLElement.prototype.showPopover === 'function');
  const NUM = n => new Intl.NumberFormat('vi-VN').format(n);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } }
  };
  const fxOn = () => store.get(KEY_FX) !== '0';
  const scareOn = () => store.get(KEY_SCARE) !== '0';
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const safeUrl = u => typeof u === 'string' && u.length < 300 && u[0] === '/' && u[1] !== '/' && u.indexOf('\\') < 0;
  const idle = fn => (root.requestIdleCallback ? root.requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500));

  let cfg = { memes: [], blessings: [] };
  let hooks = {};
  let el = null;                       // các phần tử giao diện (dựng lúc cần)
  let cur = null;                      // lượt đang chiếu
  let pending = null;                  // tối đa MỘT lượt chờ (ưu tiên cao nhất)
  let lastMeme = -1, nextMeme = -1, lastLine = -1, nextLine = -1;
  const badMemes = new Set();          // meme tải lỗi thì bỏ qua
  let seq = 0;                         // số thứ tự lượt, để bỏ kết quả bất đồng bộ của lượt cũ

  /* ---------- ưu tiên & luật mốc (giống máy chủ) ---------- */
  function outranks(a, b) {
    if (!b) return true;
    if ((a.kind === 'scare') !== (b.kind === 'scare')) return a.kind === 'scare';
    return a.at > b.at;
  }
  function kindOf(at) {
    if (at === 666) return 'scare';
    if (at === 888 || at === 999 || (at >= 1000 && at % 1000 === 0)) return 'grand';
    return 'bless';
  }

  /* ---------- chọn ngẫu nhiên, không lặp liền kề ---------- */
  function pickFrom(n, exclude, bad) {
    const pool = [];
    for (let i = 0; i < n; i++) if (!(bad && bad(i))) pool.push(i);
    const use = pool.filter(i => i !== exclude);
    const from = use.length ? use : pool;
    return from.length ? from[Math.floor(Math.random() * from.length)] : -1;
  }
  const pickMeme = exclude => pickFrom(cfg.memes.length, exclude, i => badMemes.has(cfg.memes[i]));
  const pickLine = exclude => pickFrom(cfg.blessings.length || BLESSINGS.length, exclude);
  const lineAt = i => (cfg.blessings.length ? cfg.blessings[i] : { url: '', text: BLESSINGS[i] });

  /* Chuẩn bị sẵn meme và lời chúc cho lần sau (tải trước để hiện tức thì) */
  function prepareNext() {
    try {
      if (!fxOn()) return;
      if (nextMeme < 0 || nextMeme >= cfg.memes.length || badMemes.has(cfg.memes[nextMeme])) nextMeme = pickMeme(lastMeme);
      if (nextLine < 0 || nextLine >= (cfg.blessings.length || BLESSINGS.length)) nextLine = pickLine(lastLine);
      const slow = root.navigator && navigator.connection && navigator.connection.saveData;
      if (slow) return;
      if (nextMeme >= 0) { const im = new Image(), u = cfg.memes[nextMeme]; im.decoding = 'async'; im.onerror = () => { badMemes.add(u); if (cfg.memes[nextMeme] === u) nextMeme = -1; }; im.src = u; }
      if (cfg.blessings.length && nextLine >= 0 && root.SFX) SFX.preloadClip(cfg.blessings[nextLine].url);
      if (scareOn()) prepareScare();
    } catch (e) { /* không được làm hỏng trang */ }
  }
  function prepareScare() {
    build();
    if (!el.devil.getAttribute('src')) {
      el.devil.onerror = () => el.scare.classList.add('devil-bad');   // thiếu file mặt quỷ: dùng biểu tượng 😈 thay
      el.devil.src = DEVIL;
      if (el.devil.decode) el.devil.decode().catch(() => {});
    }
  }

  /* ---------- dựng giao diện (chỉ một lần) ---------- */
  const TEMPLATE = `
<div class="fx-bg"></div>
<div class="fx-stage">
  <div class="fx-card">
    <p class="fx-eyebrow" hidden>Tùy hỷ công đức</p>
    <h2 class="fx-title"></h2>
    <figure class="fx-frame"><img class="fx-meme" alt="" decoding="async"></figure>
    <p class="fx-sub"></p>
  </div>
  <p class="fx-hint">Chạm để đóng</p>
</div>
<canvas class="fx-canvas" aria-hidden="true"></canvas>
<div class="fx-scare" aria-hidden="true"><div class="fx-devil-fb">😈</div><img class="fx-devil" alt="" decoding="async"><div class="fx-flash"></div></div>
<div class="fx-cap"><div class="fx-capcard"><p class="fx-cap1">Hù bạn thôi!</p><p class="fx-cap2">A Di Đà Phật, chúc bạn bình an 🙏</p><p class="fx-hint">Chạm để đóng</p></div></div>
<button type="button" class="fx-x" aria-label="Đóng">×</button>
<p class="sr fx-live" role="status"></p>`;
  function build() {
    if (el) return el;
    const r = doc.createElement('div');
    r.className = 'fx'; r.hidden = true; r.tabIndex = -1;
    r.setAttribute('role', 'dialog'); r.setAttribute('aria-label', 'Chúc mừng công đức');
    if (HAS_POPOVER) r.setAttribute('popover', 'manual');   // lên lớp trên cùng, nằm trên cả hộp thoại <dialog> đang mở
    r.innerHTML = TEMPLATE;                                  // chuỗi cố định, không chèn dữ liệu ngoài
    const q = s => r.querySelector(s);
    el = {
      root: r, eyebrow: q('.fx-eyebrow'), title: q('.fx-title'), frame: q('.fx-frame'), meme: q('.fx-meme'), sub: q('.fx-sub'),
      canvas: q('.fx-canvas'), scare: q('.fx-scare'), devil: q('.fx-devil'), live: q('.fx-live'), cap2: q('.fx-cap2')
    };
    r.addEventListener('click', () => { if (cur && performance.now() >= cur.armedAt) dismiss(); });
    doc.body.appendChild(r);
    return el;
  }

  /* hộp thoại <dialog> modal làm phần còn lại của trang bị "inert": đặt lớp phủ vào bên trong nó thì mới bấm được */
  function present() {
    const dlgs = doc.querySelectorAll('dialog[open]');
    const host = dlgs.length ? dlgs[dlgs.length - 1] : doc.body;
    if (el.root.parentNode !== host) host.appendChild(el.root);
    el.root.hidden = false;
    if (HAS_POPOVER) { try { if (!el.root.matches(':popover-open')) el.root.showPopover(); } catch (e) { /* còn z-index dự phòng */ } }
    if (host !== doc.body && cur) { cur.host = host; host.addEventListener('close', onHostClose); }
    // đọc cho trình đọc màn hình sau khi lớp phủ đã hiện (vùng báo trong phần tử ẩn thì không được đọc)
    const say = cur ? cur.say : '', live = el.live;
    live.textContent = '';
    if (say) setTimeout(() => { live.textContent = say; }, 80);
  }
  function onHostClose() { if (cur && !cur.leaving) dismiss(true); }
  function vanish() {
    if (HAS_POPOVER) { try { el.root.hidePopover(); } catch (e) { /* chưa mở */ } }
    el.root.hidden = true;
    el.root.className = 'fx';
  }

  /* ---------- hiển thị ---------- */
  function show(d, opts) {
    try { return run(d, opts || {}); } catch (e) { if (root.console) console.warn('Celebrate:', e); cleanupAfterError(); return 'error'; }
  }
  function run(d, opts) {
    const at = Math.floor(Number(d && d.at));
    if (!Number.isFinite(at) || at <= 0 || at > 1e7) return 'ignored';
    let kind = d && (d.kind === 'scare' || d.kind === 'grand') ? d.kind : 'bless';
    if (!fxOn()) {
      if (hooks.toast) hooks.toast(`Bạn đạt ${NUM(at)} công đức.`);
      if (opts.test && root.console) console.info('Celebrate: hiệu ứng đang tắt trong mục Công đức > Hiệu ứng.');
      return 'off';
    }
    if (kind === 'scare' && !scareOn()) kind = 'bless';
    const item = { at, kind, ts: Date.now() };
    if (cur || doc.hidden) {                                // đang chiếu hoặc tab đang ẩn: xếp hàng (chỉ giữ một)
      if (outranks(item, pending)) pending = item;
      return 'queued';
    }
    start(item);
    return 'shown';
  }

  function start(item) {
    build();
    const id = ++seq;
    // armedAt: vài trăm mili giây đầu chạm không đóng được, để người đang gõ mõ liên tục không lỡ tay tắt mất hiệu ứng
    cur = { id, item, t0: performance.now(), armedAt: performance.now() + (item.kind === 'scare' ? 600 : 700), timers: [], leaving: false, speech: false, prevFocus: null, host: null, raf: 0, say: '' };
    const r = el.root;
    r.className = 'fx fx--' + item.kind;
    if (reduced()) r.classList.add('is-reduced');
    // nhớ nơi đang giữ focus; nếu người dùng đang gõ chữ thì không giật focus của họ
    const ae = doc.activeElement;
    cur.prevFocus = ae && ae !== doc.body ? ae : null;
    const typing = !!(ae && ae.matches && ae.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
    if (item.kind === 'scare') startScare(item); else startBless(item);
    present();
    if (!typing) { try { r.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ } } else cur.prevFocus = null;
  }

  function later(fn, ms) { const t = setTimeout(() => { try { fn(); } catch (e) { /* bỏ qua */ } }, ms); cur.timers.push(t); return t; }
  function holdUntil(ms) {                                  // đặt giờ tự đóng tính từ lúc bắt đầu
    const c = cur; if (!c) return;
    clearTimeout(c.hold);
    c.hold = setTimeout(() => { if (cur === c) dismiss(); }, Math.max(300, ms - (performance.now() - c.t0)));
  }

  /* ----- bless / grand ----- */
  function startBless(item) {
    const grand = item.kind === 'grand', id = cur.id;
    el.eyebrow.hidden = !grand;
    el.title.textContent = `Chúc mừng ${NUM(item.at)} công đức!`;
    // lời chúc: dùng cái đã chuẩn bị sẵn
    const n = cfg.blessings.length || BLESSINGS.length;
    let li = nextLine >= 0 && nextLine < n ? nextLine : pickLine(lastLine);
    if (li < 0) li = 0;
    lastLine = li; nextLine = -1;
    const line = lineAt(li);
    el.sub.textContent = line.text;
    el.root.setAttribute('aria-label', `Chúc mừng ${NUM(item.at)} công đức`);
    cur.say = `Chúc mừng ${NUM(item.at)} công đức! ${line.text}`;
    showMeme(id, 0);
    holdUntil(5000);
    voice(line, id);
    startParticles(grand ? 'grand' : 'bless', id);
  }

  function showMeme(id, tries) {
    const fr = el.frame, im = el.meme;
    let mi = -1;
    if (tries === 0 && nextMeme >= 0 && nextMeme < cfg.memes.length && !badMemes.has(cfg.memes[nextMeme])) mi = nextMeme;
    else mi = pickMeme(lastMeme);
    nextMeme = -1;
    if (mi < 0 || tries > 2) { fr.hidden = true; im.removeAttribute('src'); return; }   // hết cách: thẻ chỉ có chữ
    const url = cfg.memes[mi];
    lastMeme = mi;
    fr.hidden = false; fr.classList.remove('ready');
    im.onload = () => { if (cur && cur.id === id) fr.classList.add('ready'); };
    im.onerror = () => { badMemes.add(url); if (cur && cur.id === id) showMeme(id, tries + 1); };
    im.removeAttribute('src');
    im.src = url;
  }

  /* ----- giọng đọc ----- */
  let voices = [];
  function loadVoices() {
    try {
      const ss = root.speechSynthesis; if (!ss) return;
      voices = ss.getVoices() || [];
      if (!loadVoices.bound && ss.addEventListener) { loadVoices.bound = true; ss.addEventListener('voiceschanged', () => { voices = ss.getVoices() || []; }); }
    } catch (e) { /* bỏ qua */ }
  }
  function pickVoice() {
    let best = null, bs = -9;
    for (const v of voices) {
      if (!/^vi([-_]|$)/i.test(v.lang || '')) continue;
      const n = (v.name || '').toLowerCase();
      let sc = 0;
      if (/hoai\s?my|hoàimy|linh|female|nữ|google/.test(n)) sc += 3;
      if (/nam\s?minh|(^|[^a-z])male|nam\b|đức|duc/.test(n) && !/female/.test(n)) sc -= 3;
      if (sc > bs) { bs = sc; best = v; }
    }
    return best;
  }
  function voice(line, id) {
    if (!root.SFX || SFX.muted) return;                     // tắt tiếng thì chỉ còn hình
    const c = cur;
    const fallback = () => { if (cur === c) speakFallback(line.text, c); };
    if (line.url && SFX.playClip) {
      SFX.playClip(line.url, { cancelled: () => !cur || cur.id !== id }).then(r => {
        if (!cur || cur.id !== id) return;
        if (!r.played) { if (!SFX.muted) fallback(); return; }
        holdUntil(Math.min(9000, Math.max(5000, performance.now() - c.t0 + r.duration * 1000 + 1500)));   // đọc xong còn ở lại 1.5 giây
      }).catch(fallback);
    } else speakFallback(line.text, c);
  }
  function speakFallback(text, c) {
    if (SFX.muted) return;
    const ss = root.speechSynthesis;
    if (ss && root.SpeechSynthesisUtterance) {
      try {
        loadVoices();
        const v = pickVoice();
        if (voices.length && !v) throw new Error('Máy không có giọng tiếng Việt');   // đọc tiếng Việt bằng giọng khác nghe rất sai
        const u = new SpeechSynthesisUtterance(text);
        u.lang = v ? v.lang : 'vi-VN'; if (v) u.voice = v;
        u.rate = 0.95; u.pitch = 1.12; u.volume = 1;
        let started = false, rang = false;
        const ring = () => { if (!rang && cur === c) { rang = true; SFX.chime(); } };   // chỉ rung chuông một lần
        u.onstart = () => { started = true; };
        u.onerror = e => { if (e && e.error !== 'canceled' && e.error !== 'interrupted') ring(); };
        ss.cancel(); ss.speak(u);
        c.speech = true;
        holdUntil(Math.min(9000, Math.max(5000, text.length * 85 + 1500)));
        later(() => { if (!started && !rang) { try { ss.cancel(); } catch (e) { /* bỏ qua */ } c.speech = false; ring(); } }, 1600);   // im lặng quá lâu: bật chuông ting thay
        return;
      } catch (e) { /* xuống chuông */ }
    }
    SFX.chime();
  }

  /* ----- hạt: cánh sen, hoa giấy, lấp lánh (canvas thuần, tự dọn) ----- */
  const PETAL = ['#f6a9bd', '#f9c6d3', '#ec8aa5', '#fff0f4', '#f3b6c6'];
  const CONFETTI = ['#e8c477', '#d4ab52', '#e2574c', '#86b38a', '#fff3dc', '#f6a9bd', '#8fd3ee'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function startParticles(mode, id) {
    if (reduced() || !el.canvas.getContext) return;
    const grand = mode === 'grand', cv = el.canvas, dpr = Math.min(2, root.devicePixelRatio || 1);
    const W = root.innerWidth, H = root.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const parts = [], scale = Math.max(0.7, Math.min(1.3, W / 520));
    const confetti = (x, y, ang, spread, n) => {
      for (let i = 0; i < n; i++) {
        const a = ang + rnd(-spread, spread), sp = rnd(420, 900) * scale;
        parts.push({ t: 'c', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gr: 1100, drag: 1.6, rot: rnd(0, 6.3), vr: rnd(-9, 9), fl: rnd(0, 6.3), vf: rnd(5, 11), s: rnd(5, 9) * scale, col: pick(CONFETTI), life: 0, max: rnd(2.2, 3.4) });
      }
    };
    const petal = () => parts.push({ t: 'p', x: rnd(-20, W + 20), y: rnd(-40, -10), vx: rnd(-25, 25), vy: rnd(70, 150) * scale, gr: 0, drag: 0, sw: rnd(0.8, 1.8), sa: rnd(25, 55), ph: rnd(0, 6.3), rot: rnd(0, 6.3), vr: rnd(-2, 2), fl: rnd(0, 6.3), vf: rnd(2, 5), s: rnd(8, 15) * scale, col: pick(PETAL), life: 0, max: 12 });
    const spark = () => parts.push({ t: 's', x: rnd(0.05, 0.95) * W, y: rnd(0.08, 0.85) * H, vx: 0, vy: 0, gr: 0, drag: 0, rot: rnd(0, 1), vr: rnd(-1, 1), s: rnd(6, 14) * scale, col: Math.random() < 0.6 ? '#ffe9a8' : '#ffffff', life: 0, max: rnd(0.7, 1.5) });
    // phát đầu tiên: pháo hoa giấy từ hai góc dưới (grand) hoặc giữa đáy (bless)
    if (grand) { confetti(W * 0.05, H, -1.15, 0.45, 55); confetti(W * 0.95, H, -2.0, 0.45, 55); } else confetti(W * 0.5, H * 0.98, -1.57, 0.7, 30);
    const emitMs = grand ? 3800 : 2400, petalRate = grand ? 26 : 15, sparkRate = grand ? 14 : 8;
    let last = performance.now(), born = last, accP = 0, accS = 0, popped = false;
    const frame = now => {
      if (!cur || cur.id !== id) { g.clearRect(0, 0, W, H); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const emitting = now - born < emitMs;
      if (grand && !popped && now - born > 700) { popped = true; confetti(W * 0.5, H * 0.9, -1.57, 0.6, 40); }   // thêm một đợt giữa chừng
      if (emitting) {
        accP += petalRate * dt; accS += sparkRate * dt;
        while (accP >= 1) { accP--; petal(); }
        while (accS >= 1) { accS--; spark(); }
      }
      g.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life > p.max || p.y > H + 40 || p.x < -60 || p.x > W + 60) { parts.splice(i, 1); continue; }
        if (p.t === 'p') { p.ph += p.sw * dt; p.x += (p.vx + Math.sin(p.ph) * p.sa) * dt; p.y += p.vy * dt; }
        else if (p.t === 'c') { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy = p.vy * k + p.gr * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vy > 300) p.vy = 300; }   // rơi chậm dần như giấy
        p.rot += p.vr * dt;
        if (p.fl != null) p.fl += p.vf * dt;
        g.save(); g.translate(p.x, p.y);
        if (p.t === 's') {
          const a = Math.sin(Math.PI * p.life / p.max); g.globalAlpha = Math.max(0, a); g.rotate(p.rot); g.fillStyle = p.col;
          const s = p.s * (0.6 + 0.4 * a), k = s * 0.22;
          g.beginPath(); g.moveTo(0, -s); g.lineTo(k, -k); g.lineTo(s, 0); g.lineTo(k, k); g.lineTo(0, s); g.lineTo(-k, k); g.lineTo(-s, 0); g.lineTo(-k, -k); g.closePath(); g.fill();
        } else if (p.t === 'p') {
          g.rotate(p.rot); g.scale(1, Math.cos(p.fl)); g.fillStyle = p.col; const s = p.s;
          g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.85, -s * 0.2, 0, s); g.quadraticCurveTo(-s * 0.85, -s * 0.2, 0, -s); g.fill();
        } else {
          g.rotate(p.rot); g.scale(1, Math.cos(p.fl)); g.fillStyle = p.col; g.fillRect(-p.s / 2, -p.s * 0.3, p.s, p.s * 0.6);
        }
        g.restore();
      }
      if (emitting || parts.length) cur.raf = requestAnimationFrame(frame);
      else g.clearRect(0, 0, W, H);
    };
    cur.raf = requestAnimationFrame(frame);
  }

  /* ----- jump scare 666 ----- */
  function startScare(item) {
    const r = el.root;
    prepareScare();
    r.setAttribute('aria-label', 'Hù bạn thôi');
    cur.say = `Bạn đạt ${NUM(item.at)} công đức. Hù bạn thôi! A Di Đà Phật, chúc bạn bình an.`;
    el.cap2.textContent = 'A Di Đà Phật, chúc bạn bình an 🙏';
    r.classList.add('is-face');
    if (root.SFX) { try { SFX.scare(); } catch (e) { /* bỏ qua */ } }
    // mặt quỷ giữ ~1.4 giây (chỉ một lần chớp đỏ, không nhấp nháy), mờ dần, rồi thẻ trấn an ~2.5 giây
    later(() => { r.classList.add('is-out'); }, 1400);
    later(() => { r.classList.remove('is-face'); r.classList.add('is-calm'); }, 1800);
    holdUntil(1800 + 2500);
  }

  /* ---------- đóng & hàng chờ ---------- */
  function dismiss(immediate) {
    const c = cur;
    if (!c || c.leaving) return;
    c.leaving = true;
    c.timers.forEach(clearTimeout); clearTimeout(c.hold); cancelAnimationFrame(c.raf);
    if (c.speech) { try { root.speechSynthesis.cancel(); } catch (e) { /* bỏ qua */ } }
    if (root.SFX && SFX.stopClip) SFX.stopClip();
    el.root.classList.add('is-leave');
    setTimeout(() => finish(c), immediate ? 0 : 240);
  }
  function finish(c) {
    if (cur !== c) return;
    if (c.host) c.host.removeEventListener('close', onHostClose);
    vanish();
    const ctx2 = el.canvas.getContext && el.canvas.getContext('2d');
    if (ctx2) ctx2.clearRect(0, 0, el.canvas.width, el.canvas.height);
    el.canvas.width = el.canvas.height = 0;
    el.meme.onload = el.meme.onerror = null;
    if (c.prevFocus && c.prevFocus.isConnected && c.prevFocus.focus) { try { c.prevFocus.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ } }
    cur = null;
    prepareNext();
    const nx = pending; pending = null;
    if (nx) setTimeout(() => { if (Date.now() - nx.ts < 60000) show(nx); }, 450);   // lượt chờ quá cũ (tab ẩn lâu) thì bỏ
  }
  function cleanupAfterError() {
    try {
      if (cur) { cur.timers.forEach(clearTimeout); clearTimeout(cur.hold); cancelAnimationFrame(cur.raf); if (cur.host) cur.host.removeEventListener('close', onHostClose); }
      cur = null; if (el) vanish();
    } catch (e) { /* bỏ qua */ }
  }

  doc.addEventListener('keydown', e => {
    if (cur && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dismiss(); }
  }, true);
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) return;
    if (!cur && pending) { const nx = pending; pending = null; if (Date.now() - nx.ts < 60000) show(nx); }
  });

  /* ---------- công tắc trong mục Công đức ---------- */
  function bindSettings() {
    const a = doc.getElementById('fxOn'), b = doc.getElementById('fxScare');
    if (!a || !b) return;
    const sync = () => { b.disabled = !a.checked; };
    a.checked = fxOn(); b.checked = scareOn(); sync();
    a.addEventListener('change', () => { store.set(KEY_FX, a.checked ? '1' : '0'); sync(); if (a.checked) idle(prepareNext); });
    b.addEventListener('change', () => { store.set(KEY_SCARE, b.checked ? '1' : '0'); if (b.checked) idle(prepareNext); });
  }

  /* ---------- giao diện công khai ---------- */
  function configure(c, h) {
    try {
      const memes = c && Array.isArray(c.memes) ? c.memes.filter(safeUrl).slice(0, 200) : [];
      const lines = c && Array.isArray(c.blessings) ? c.blessings.filter(b => b && safeUrl(b.url) && typeof b.text === 'string' && b.text).slice(0, 40).map(b => ({ url: b.url, text: b.text.slice(0, 200) })) : [];
      cfg = { memes, blessings: lines };
      badMemes.clear();
      if (h) hooks = h;
      loadVoices();
      idle(prepareNext);
    } catch (e) { /* bỏ qua */ }
  }
  function test(at) {
    const n = Math.floor(Number(at));
    if (!Number.isFinite(n) || n <= 0) return 'ignored';
    return show({ at: n, kind: kindOf(n) }, { test: true });
  }

  bindSettings();
  root.Celebrate = { configure, show, test, dismiss: () => dismiss() };
})(window);
