/*
 * Thanh đổi map: một thanh 4 nút cùng kiểu (Chánh điện · Sân chùa · Tàng Kinh Các · Sân đấu), chỉ để đổi nơi.
 * MAPS là nơi DUY NHẤT khai báo map. Map mới: thêm một phần tử vào MAPS + SCENES ở server.js (hoặc PLACES) + hàm vẽ ở hall.js
 * (test/sync-constants.test.js so MAPS với SCENES/PLACES của máy chủ).
 *
 * app.js gọi MapBar.configure({ go }) một lần; sau đó nơi nào cũng chỉ cần MapBar.mount(el) (cảnh chánh điện, đầu màn Sân đấu…).
 * Chỉ chạy trên trình duyệt; chữ do mã dựng bằng createElement/textContent, không dùng innerHTML.
 */
(function (root) {
  'use strict';
  // kind 'scene': cảnh trong chùa (khớp SCENES ở server.js) · 'place': màn hình riêng (khớp PLACES ở server.js)
  // flag: tên cờ tính năng trong cfg.martial; cờ tắt thì nút ẩn (setEnabled)
  const MAPS = [
    { id: 'hall', kind: 'scene', label: 'Chánh điện', short: 'Chánh điện', icon: '⌂' },
    { id: 'yard', kind: 'scene', label: 'Sân chùa', short: 'Sân chùa', icon: '❀' },
    { id: 'library', kind: 'scene', label: 'Tàng Kinh Các', short: 'Kinh Các', icon: '▤' },
    { id: 'arena', kind: 'place', label: 'Sân đấu', short: 'Sân đấu', icon: '⚔', flag: 'pk' }
  ];

  let goFn = null, current = null;
  const disabled = Object.create(null);   // id → true khi tính năng tắt
  const mounted = [];                     // mỗi lần mount: { nav, btns: {id → button} }

  function configure(opts) { goFn = opts && typeof opts.go === 'function' ? opts.go : null; }

  function paint() {
    for (const m of mounted) {
      for (const map of MAPS) {
        const b = m.btns[map.id];
        if (!b) continue;
        const on = map.id === current;
        b.classList.toggle('on', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
        b.hidden = !!disabled[map.id];
      }
    }
  }

  /** Dựng thanh vào el; trả về phần tử <nav>. Gọi bao nhiêu lần tùy ý, các thanh luôn cùng trạng thái. */
  function mount(el) {
    const nav = document.createElement('nav');
    nav.className = 'mapbar';
    nav.setAttribute('aria-label', 'Đổi nơi');
    const btns = Object.create(null);
    for (const map of MAPS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mapbar-btn';
      b.dataset.map = map.id;
      b.setAttribute('aria-label', map.label);
      const ico = document.createElement('span');
      ico.className = 'mapbar-ico';
      ico.setAttribute('aria-hidden', 'true');
      ico.textContent = map.icon;
      const txt = document.createElement('span');
      txt.className = 'mapbar-txt';
      txt.textContent = map.short;
      b.append(ico, txt);
      b.addEventListener('click', () => { if (goFn) goFn(map.id); });
      btns[map.id] = b;
      nav.append(b);
    }
    el.append(nav);
    mounted.push({ nav, btns });
    paint();
    return nav;
  }

  /** Nút của map `id` sáng lên (nền vàng, aria-current="page"); id lạ thì không nút nào sáng. */
  function setCurrent(id) { current = id; paint(); }
  /** Ẩn/hiện nút của map `id` (ví dụ Sân đấu khi PK tắt). */
  function setEnabled(id, on) { if (on) delete disabled[id]; else disabled[id] = true; paint(); }

  root.MapBar = { MAPS, configure, mount, setCurrent, setEnabled };
})(typeof window !== 'undefined' ? window : globalThis);
