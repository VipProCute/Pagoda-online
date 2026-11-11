/*
 * Các "nơi" của chùa: mỗi nơi một màn hình riêng, không lẫn nhau.
 *   hall  Chánh điện: nơi cúng và tương tác chính (không có đánh nhau)
 *   dojo  Võ Học Các: tu luyện, học chiêu
 *   arena Sân đấu: nơi duy nhất luận võ
 * Nơi mới (ví dụ coi bói tử vi, tarot) chỉ cần Places.register(tên, { el, mod, label }) và một tên trong PLACES của máy chủ.
 * Chuyển nơi: Places.go(tên) gửi place:set lên máy chủ rồi mới đổi màn hình. Máy chủ từ chối thì ở yên chỗ cũ.
 */
(function (root) {
  'use strict';
  const reg = Object.create(null);
  let cur = 'hall', host = {}, ticket = 0, connected = true, skipPop = 0;

  function init(h) {
    host = h || {};
    // nút Back của điện thoại: từ Võ Học Các / Sân đấu quay về chánh điện thay vì rời trang
    root.addEventListener('popstate', () => {
      if (skipPop) { skipPop--; return; }
      if (cur === 'hall') return;
      const m = reg[cur] && reg[cur].mod;
      if (m && m.inMatch && m.inMatch()) {   // đang đấu: Back không được âm thầm bỏ cuộc
        try { history.pushState({ place: cur }, ''); } catch (e) { /* bỏ qua */ }
        if (host.toast) host.toast('Đang có trận. Muốn rời thì bấm map khác trên thanh đầu Sân đấu (rời trận là bỏ cuộc).');
        return;
      }
      go('hall', { fromHistory: true });
    });
  }
  /** def: { el: phần tử khung, mod: { init?, mount(el), show(info), hide() } } */
  function register(name, def) {
    reg[name] = { el: def.el, mod: def.mod, mounted: false, banner: null };
    if (def.el) {
      const b = document.createElement('div');
      b.className = 'place-conn'; b.hidden = true; b.setAttribute('role', 'status');
      b.textContent = 'Mất kết nối, đang thử lại…';
      def.el.prepend(b);
      reg[name].banner = b;
    }
  }
  function setConnected(on) {
    connected = !!on;
    for (const k in reg) if (reg[k].banner) reg[k].banner.hidden = connected || cur !== k;
  }
  function show(name, info) {
    const p = reg[name];
    if (!p.mounted) { p.mounted = true; p.mod.mount(p.el); }
    p.el.hidden = false;
    if (p.banner) p.banner.hidden = connected;
    p.mod.show(info);
  }
  function leave(name) {
    const p = reg[name];
    if (!p) return;
    try { p.mod.hide(); } catch (e) { /* bỏ qua */ }
    p.el.hidden = true;
  }
  function apply(name, info, prev) {
    if (prev && prev !== 'hall') leave(prev);
    cur = name;
    document.body.dataset.place = name;
    if (name !== 'hall') show(name, info);
    if (host.onChange) host.onChange(name, prev);
  }

  // Mục lịch sử: vào nơi khác từ chánh điện thì thêm một mục; nơi → nơi thì thay mục; về chánh điện thì lùi một mục.
  function history_(name, prev, opts) {
    if (!root.history || opts.force || opts.fromHistory) return;
    try {
      if (name === 'hall') { if (history.state && history.state.place) { skipPop++; history.back(); } }
      else if (prev === 'hall') history.pushState({ place: name }, '');
      else history.replaceState({ place: name }, '');
    } catch (e) { /* bỏ qua */ }
  }

  /** Đi tới một nơi. Trả Promise<boolean>: true nếu đã chuyển. */
  function go(name, opts) {
    opts = opts || {};
    if (name !== 'hall' && !reg[name]) return Promise.resolve(false);
    if (name === cur && !opts.force) return Promise.resolve(true);
    const my = ++ticket, prev = cur;
    return new Promise(resolve => {
      host.setPlace(name, ack => {
        if (my !== ticket) return resolve(false);                 // có lần chuyển mới hơn
        if (!ack || !ack.ok) {
          if (!(host.denied && host.denied(ack)) && host.toast) host.toast((ack && ack.reason) || 'Chưa đi tới đó được, thử lại nhé.');
          return resolve(false);
        }
        apply(name, ack, prev);
        history_(name, prev, opts);
        resolve(true);
      });
    });
  }

  /** Sau khi mất mạng rồi nối lại (socket mới, máy chủ đã quên nơi ở): báo lại nơi đang ở. */
  function resume() {
    if (cur === 'hall') return Promise.resolve(true);
    const name = cur;
    return new Promise(resolve => {
      host.setPlace(name, ack => {
        if (!ack || !ack.ok) {                                    // không còn vào được (hết phiên đăng nhập…)
          leave(name); cur = 'hall'; document.body.dataset.place = 'hall';
          if (host.toast && ack && ack.reason) host.toast(ack.reason);
          if (host.onChange) host.onChange('hall', name);
          return resolve(false);
        }
        reg[name].mod.show(ack);
        resolve(true);
      });
    });
  }

  root.Places = { init, register, go, resume, setConnected, get current() { return cur; } };
})(this);
