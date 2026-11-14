(function (root) {
  'use strict';
  const prefs = { on: false, mode: 'third', quality: null };
  try {
    const saved = JSON.parse(localStorage.getItem('ta-view'));
    if (saved && typeof saved === 'object') {
      prefs.on = saved.on === true;
      if (['first', 'third'].includes(saved.mode)) prefs.mode = saved.mode;
      if (['low', 'medium', 'high'].includes(saved.quality)) prefs.quality = saved.quality;
    }
  } catch (error) { /* Trình duyệt có thể chặn lưu lựa chọn. */ }
  let world = null, target = null, layer = null, canvas = null, toolbar = null, toggle = null, angle = null, stick = null, figure = null;
  let active = false, paused = false, pk = false, revision = 0, queued = false, notify = () => {}, previousVisibility = '';
  const save = () => { try { localStorage.setItem('ta-view', JSON.stringify(prefs)); } catch (error) { /* Vẫn dùng được trong phiên này. */ } };
  const figureOn = () => { try { return localStorage.getItem('ta-avatar') !== 'code'; } catch (error) { return true; } };
  const editing = event => event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog[open]');

  function buttons() {
    if (!toolbar) return;
    toolbar.hidden = paused || pk;
    toggle.textContent = prefs.on ? '2D' : '3D';
    toggle.setAttribute('aria-pressed', String(prefs.on));
    toggle.title = prefs.on ? 'Trở về giao diện 2D' : 'Mở giao diện 3D';
    angle.hidden = !active || pk;
    angle.textContent = prefs.mode === 'first' ? 'Góc 1 · V' : 'Góc 3 · V';
    angle.title = 'Đổi góc nhìn thứ nhất / thứ ba (V)';
    stick.hidden = !active;
    figure.hidden = !active || pk;
    figure.textContent = 'Người cũ';
    figure.setAttribute('aria-pressed', String(!figureOn()));
    figure.title = figureOn() ? 'Đổi về dáng nhân vật cũ (dựng bằng mã). Cảnh sẽ dựng lại.' : 'Đang dùng dáng nhân vật cũ; bấm để dùng dáng mới. Cảnh sẽ dựng lại.';
  }
  function changeFigure() {
    try {
      if (figureOn()) localStorage.setItem('ta-avatar', 'code'); else localStorage.removeItem('ta-avatar');
    } catch (error) { notify('Trình duyệt không cho lưu lựa chọn nhân vật.'); return; }
    sync();   // dựng lại cảnh ngay để nhân vật đổi theo
  }
  function restore() {
    if (active && target) target.style.visibility = previousVisibility;
    active = false;
    root.Hall.view3d.hold(false);
    if (canvas) canvas.hidden = true;
    world?.stop(); buttons();
  }
  function align() {
    if (!target || !layer?.parentElement) return;
    const r = target.getBoundingClientRect(), parent = layer.parentElement;
    const p = parent.getBoundingClientRect();
    Object.assign(layer.style, { left: (r.left - p.left - parent.clientLeft + parent.scrollLeft) + 'px',
      top: (r.top - p.top - parent.clientTop + parent.scrollTop) + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
  async function refresh() {
    const ticket = ++revision;
    restore(); align();
    if (!prefs.on || paused || pk || !target) return;
    const scene = root.Hall.scene;
    try {
      const module = await import('/js/world3d/index.mjs?v=14');
      if (ticket !== revision) return;
      world = module;
      if (!prefs.quality) {
        const probe = document.createElement('canvas'), gl = probe.getContext('webgl2');
        prefs.quality = root.GfxDetect.pickQuality({ webgl2: !!gl, cores: navigator.hardwareConcurrency,
          memory: navigator.deviceMemory, dpr: root.devicePixelRatio, mobile: matchMedia('(pointer: coarse)').matches,
          reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
        gl?.getExtension('WEBGL_lose_context')?.loseContext(); save();
      }
      // Đo khung thật trước khi renderer khởi tạo; chỉ che 2D sau khi start thành công.
      canvas.hidden = false; canvas.style.visibility = 'hidden';
      const result = await world.start({ canvas, scene, getState: root.Hall.view3d.snapshot,
        view: prefs.mode, quality: prefs.quality, joystick: stick,
        on: { fire: root.Hall.view3d.fire, error(reason) {
          if (ticket !== revision) return;
          ++revision; restore(); notify(reason);
        } } });
      if (ticket !== revision) return;
      if (!result.ok) { restore(); notify(result.reason); return; }
      previousVisibility = target.style.visibility;
      target.style.visibility = 'hidden'; canvas.style.visibility = ''; active = true;
      root.Hall.view3d.hold(true); buttons();
    } catch (error) {
      if (ticket !== revision) return;
      restore(); notify('Chưa mở được cảnh 3D. Mời bạn dùng giao diện 2D.');
    }
  }
  function sync() {
    // Hall.attach/setScene/pause thường đi cùng nhau: chỉ nạp cảnh sau cả nhóm.
    ++revision; restore();
    if (queued) return;
    queued = true;
    Promise.resolve().then(() => { queued = false; refresh(); });
  }
  function changeView() {
    if (!active || pk || paused) return;
    prefs.mode = prefs.mode === 'first' ? 'third' : 'first';
    world.setView(prefs.mode); save(); buttons();
  }
  function attach(value) {
    restore(); target = value;
    if (!value) return;
    value.insertAdjacentElement('afterend', layer); align(); sync();
  }
  function init(options) {
    if (layer) return;
    notify = options.notify || notify;
    layer = document.createElement('div'); layer.className = 'v3-layer';
    canvas = document.createElement('canvas'); canvas.className = 'v3-canvas'; canvas.hidden = true;
    canvas.setAttribute('aria-label', 'Cảnh chùa 3D: kéo để nhìn, chạm sàn để đi');
    toolbar = document.createElement('div'); toolbar.className = 'v3-controls'; toolbar.setAttribute('aria-label', 'Góc nhìn');
    toggle = document.createElement('button'); toggle.type = 'button';
    angle = document.createElement('button'); angle.type = 'button';
    figure = document.createElement('button'); figure.type = 'button';
    toggle.addEventListener('click', () => { prefs.on = !prefs.on; save(); sync(); });
    angle.addEventListener('click', changeView);
    figure.addEventListener('click', changeFigure);
    toolbar.append(toggle, angle, figure);
    stick = document.createElement('div'); stick.className = 'v3-stick'; stick.hidden = true;
    stick.setAttribute('aria-label', 'Cần di chuyển'); stick.textContent = '✥';
    layer.append(canvas, toolbar, stick);
    // Giữ nguyên chữ ký và kết quả API cũ, theo cả những lệnh từ fortune.js.
    for (const name of ['attach', 'setScene', 'pause']) {
      const original = root.Hall[name];
      root.Hall[name] = function (...args) {
        const result = original.apply(this, args);
        if (name === 'attach' && args[0]) attach(args[0]);
        else { if (name === 'pause') paused = !!args[0]; sync(); }
        return result;
      };
    }
    addEventListener('keydown', event => {
      if (event.key.toLowerCase() === 'v' && !event.repeat && !editing(event) && active) { event.preventDefault(); changeView(); }
    });
    addEventListener('resize', align);
    if (root.ResizeObserver) new ResizeObserver(align).observe(document.body);
    addEventListener('pagehide', () => { ++revision; restore(); });
    attach(options.canvas);
  }
  root.View3D = { init, get active() { return active; }, setPK(on) { if (pk === !!on) return; pk = !!on; sync(); } };
})(this);
