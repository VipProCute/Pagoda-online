/* Điều khiển trang: kết nối máy chủ, giao diện, các hành động lễ Phật. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NUM = n => new Intl.NumberFormat('vi-VN').format(n || 0);
  const VND = n => NUM(n) + 'đ';
  const pad = n => String(n).padStart(2, '0');
  const hhmm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } }
  };
  const KCLS = { 'Cầu an': '', 'Cầu siêu': 'k-sieu', 'Tạ ơn': 'k-taon', 'Sám hối': 'k-sam', 'Hồi hướng': 'k-taon' };
  const ITEM_TEXT = { lotus: 'dâng một đóa sen', rose: 'dâng một bó hoa hồng', lamp: 'thắp một ngọn đèn', fruit: 'dâng một mâm ngũ quả' };

  /* ---------- trạng thái ---------- */
  let uid = store.get('ta-uid');
  let look = null;
  try { look = JSON.parse(store.get('ta-look') || 'null'); } catch (e) { look = null; }
  if (!look || typeof look.c !== 'number') look = { g: 'nu', c: Math.floor(Math.random() * 8), h: Math.floor(Math.random() * 2) };
  let myName = store.get('ta-name') || '';
  let me = 0, joined = false, cfg = null, offset = 0, today = {}, chant = null, editing = false;
  const serverNow = () => Date.now() + offset;
  let authPending = false, authKnown = false, authInfo = { enabled: false, signedIn: false };

  /* ---------- tiện ích giao diện ---------- */
  let toastT;
  function toast(text) { const t = $('#toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3000); }
  function ticker(text) {
    const box = $('#ticker'), d = document.createElement('div');
    d.textContent = text; box.appendChild(d);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => d.remove(), 5600);
  }
  function openDlg(id) { const d = $('#dlg-' + id); if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); } }
  function closeDlg(id) { const d = $('#dlg-' + id); if (d.open) d.close(); }
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d && d.id !== 'dlg-join' && d.id !== 'dlg-spar') d.close(); });
    $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
  });
  $('#dlg-join').addEventListener('cancel', e => { if (!joined) e.preventDefault(); });
  function lunar() {
    const L = window.Lunar.describe();
    $('#lunar').innerHTML = `<span>${L.solar} · <b>${L.lunar}</b></span><span class="holy">${L.next}</span>`;
  }
  lunar(); setInterval(lunar, 60000);

  /* ---------- âm thanh ---------- */
  let muted = store.get('ta-muted') === '1';
  function renderSound() {
    $('#icoSoundOn').hidden = muted; $('#icoSoundOff').hidden = !muted;
    $('#btnSound').setAttribute('aria-label', muted ? 'Bật tiếng' : 'Tắt tiếng');
    SFX.setMuted(muted); Voice.setMuted(muted); updateChantJoin();
  }
  $('#btnSound').addEventListener('click', () => { muted = !muted; store.set('ta-muted', muted ? '1' : '0'); SFX.unlock(); renderSound(); });
  if (window.Guide) Guide.mount($('#dlg-guide'), $('#btnGuide'));   // nút "?" mở Sổ tay (public/js/guide.js)
  document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });
  document.addEventListener('pointerdown', () => Voice.unlock());

  /* ---------- cảnh chánh điện ---------- */
  Hall.init($('#hall'), {
    floor(x, z) { stopTalk(); if (joined) socket.emit('move', { x, z }); },   // tự đi chỗ khác thì thôi đuổi theo NPC
    altar() { act('incense'); },
    statue() { act('bow'); },
    library() { goScene('library'); },                     // chạm tủ Tàng Kinh Các: bước vào trong
    read() { act('read'); },                               // trong Tàng Kinh Các: chạm Kệ kinh để đọc kinh
    dojo() { act('dojo'); },                               // chạm kệ Võ học: sang Võ Học Các học chiêu
    seat(i) { sitAt(i); },                                 // chạm bồ đoàn: đi tới, ngồi thiền
    person(id) { openPerson(id); },
    npc(id) { openPerson(id); },                           // NPC dùng chung hộp tương tác với người chơi, chỉ khác lựa chọn
    fortune() { fortune.open('lot'); },
    reader(type) { fortune.open(type); }
  });
  View3D.init({ canvas: $('#hall'), notify: toast });
  /* ---------- các cảnh trong chùa: chánh điện, sân chùa, Tàng Kinh Các (cùng một khung vẽ) ---------- */
  let curScene = 'hall';
  const SCENE_LABEL = { hall: 'Chánh điện', yard: 'Sân chùa', library: 'Tàng Kinh Các' };
  const SCENE_HINT = {
    hall: 'Chạm sàn để đi lại · chạm bát hương để thắp nhang · chạm tượng Phật để vái lạy · chạm tủ Tàng Kinh Các để vào trong',
    yard: 'Chạm sàn để đi lại · chạm bàn thầy tử vi hoặc thầy Tarot để xem',
    library: 'Chạm bồ đoàn để ngồi thiền tu luyện · chạm Kệ kinh để đọc kinh · chạm kệ Võ học để học chiêu'
  };
  /** Thanh đổi map: nút của nơi đang đứng sáng (đang ở Võ Học Các / Sân đấu thì sáng nơi đó), nút Sân đấu ẩn khi PK tắt. */
  function syncMapBar() {
    const mc = (cfg && cfg.martial) || {};
    MapBar.setCurrent(Places.current === 'hall' ? curScene : Places.current);
    MapBar.setEnabled('arena', !!mc.pk);
  }
  // Dòng gợi ý cảnh: máy bàn luôn hiện; điện thoại là dải nhỏ có ✕, chỉ hiện lần đầu vào mỗi map (nhớ bằng ta-hint-<map>)
  const hintKey = scene => 'ta-hint-' + scene;
  function showHint(scene) {
    $('#stageHintText').textContent = SCENE_HINT[scene] || SCENE_HINT.hall;
    $('#stageHint').classList.toggle('gone', store.get(hintKey(scene)) === '1');
  }
  $('#stageHintX').addEventListener('click', () => { store.set(hintKey(curScene), '1'); $('#stageHint').classList.add('gone'); });
  function applyScene(scene) {
    if (scene !== curScene) store.set(hintKey(curScene), '1');   // đã rời map thì không nhắc lại lần sau
    curScene = scene; stopTalk();
    SFX.recover();
    if (Places.current !== 'arena') Hall.setScene(scene);
    syncMapBar();
    $('#stage').setAttribute('aria-label', SCENE_LABEL[scene] || 'Chánh điện');
    showHint(scene);
    if (scene !== 'library') Meditate.close();
  }
  function goScene(scene) {
    if (!joined) { openDlg('join'); return; }
    if (scene === curScene) return;
    socket.emit('scene', scene, r => {
      if (!r || !r.ok) { toast((r && r.reason) || 'Chưa đi được, thử lại nhé.'); return; }
      applyScene(scene);
      if (scene === 'library') toast('Tàng Kinh Các: chạm bồ đoàn để ngồi thiền tu luyện, chạm kệ để đọc kinh hay học võ.');
    });
  }
  // Thanh đổi map: nơi duy nhất đổi map. Cảnh trong chùa đi qua goScene; Sân đấu đi qua act('arena') (giữ needLogin).
  // Đang ở Võ Học Các / Sân đấu mà bấm map khác thì về chánh điện trước rồi mới sang cảnh đó.
  function goMap(id) {
    const m = MapBar.MAPS.find(x => x.id === id);
    if (!m) return;
    if (m.kind === 'place') { act(id); return; }
    if (Places.current !== 'hall') { Places.go('hall').then(ok => { if (ok) goScene(id); }); return; }
    goScene(id);
  }
  MapBar.configure({ go: goMap });
  MapBar.mount($('#stage'));
  MapBar.setCurrent('hall');
  /** Các bồ đoàn đang có người khác ngồi (ở Tàng Kinh Các, cùng chánh điện). */
  function takenSeats() {
    return new Set(Hall.list().filter(p => p.id !== me && p.sit >= 0 && p.scene === 'library' && (p.place || 'hall') === 'hall').map(p => p.sit));
  }
  /** Bồ đoàn trống gần vị trí (x, z) nhất; -1 nếu hết chỗ. */
  function nearestFreeSeat(x, z) { return Hall.nearestFreeSeat(x, z, takenSeats()); }
  /** Ngồi lên bồ đoàn số i: máy chủ cho đi tới chỗ đó, tới nơi thì ngồi xuống; bảng tọa thiền mở ngay.
   *  Bồ đoàn đang có người thì tự chọn bồ đoàn trống gần nhất. */
  function sitAt(i) {
    if (!joined) return;
    const mine = Hall.player(me);
    if (mine && mine.sit === i) { Meditate.open(i); return; }
    if (takenSeats().has(i)) {
      const [x, z] = Hall.seatPos(i) || [0.5, 0.5];
      const best = nearestFreeSeat(x, z);
      if (best < 0) { toast('Các bồ đoàn đều có người ngồi rồi, bạn đợi một chút nhé.'); return; }
      if (mine && mine.sit === best) { Meditate.open(best); return; }
      toast('Bồ đoàn này có người, mời bạn sang bồ đoàn bên cạnh.');
      i = best;
    }
    socket.emit('sit', { seat: i }, r => {
      if (!r || !r.ok) { toast((r && r.reason) || 'Chưa ngồi được, thử lại nhé.'); return; }
      Hall.setSit(me, i, (mine && mine.cm) || '');
      Meditate.open(i);
    });
  }
  const keys = new Set();
  addEventListener('keydown', e => {
    if (View3D.active) return;
    if (e.target.closest('input, textarea, select, dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); e.preventDefault(); }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  setInterval(() => {
    if (View3D.active) { keys.clear(); return; }
    if (!joined || !keys.size) return;
    if (Places.current === 'dojo' || (Places.current === 'arena' && !(window.Arena && Arena.inYard && Arena.inYard()))) return;
    const p = Hall.player(me); if (!p) return;
    let dx = 0, dz = 0;
    if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
    if (keys.has('arrowright') || keys.has('d')) dx += 1;
    if (keys.has('arrowup') || keys.has('w')) dz -= 1;
    if (keys.has('arrowdown') || keys.has('s')) dz += 1;
    socket.emit('move', { x: p.x + dx * 0.06, z: p.z + dz * 0.09 });
  }, 150);

  /* ---------- hộp thoại vào chùa ---------- */
  (function buildJoin() {
    const hair = $('#jHair');
    Hall.HAIRS.forEach((h, i) => { hair.insertAdjacentHTML('beforeend', `<label class="chipr"><input type="radio" name="jh" value="${i}"><span>${h}</span></label>`); });
    const cols = $('#jColors');
    Hall.COLORS.forEach((c, i) => { cols.insertAdjacentHTML('beforeend', `<label class="sw" title="${c.n}"><input type="radio" name="jc" value="${i}" aria-label="${c.n}"><span style="--c:${c.c}"></span></label>`); });
  })();
  function fillJoin() {
    $('#jName').value = myName || '';
    $(`[name=jg][value="${look.g}"]`).checked = true;
    ($(`[name=jh][value="${look.h}"]`) || $('[name=jh]')).checked = true;
    ($(`[name=jc][value="${look.c}"]`) || $('[name=jc]')).checked = true;
    Hall.preview($('#preview'), look);
  }
  function readLook() {
    return { g: $('[name=jg]:checked').value, h: +$('[name=jh]:checked').value, c: +$('[name=jc]:checked').value };
  }
  $('#joinForm').addEventListener('change', () => { look = readLook(); Hall.preview($('#preview'), look); });
  $('#joinForm').addEventListener('submit', e => {
    e.preventDefault();
    SFX.unlock(); renderSound();
    const name = $('#jName').value.trim(), w = $('#joinWarn');
    w.hidden = true; look = readLook();
    if (name.length < 2) { w.textContent = 'Tên cần ít nhất 2 ký tự.'; w.hidden = false; return; }
    if (editing) {
      socket.emit('profile', { name, look }, r => {
        if (!r || !r.ok) { w.textContent = (r && r.reason) || 'Chưa đổi được.'; w.hidden = false; return; }
        myName = name; saveProfile(); closeDlg('join'); toast('Đã cập nhật tên và trang phục.');
      });
      return;
    }
    $('#joinBtn').disabled = true;
    myName = name; saveProfile(); join();
  });
  function saveProfile() { store.set('ta-name', myName); store.set('ta-look', JSON.stringify(look)); }
  $('#btnProfile').addEventListener('click', () => { if (!joined) return; editing = true; $('#join-title').textContent = 'Đổi tên và trang phục'; $('#joinBtn').textContent = 'Lưu'; $('#joinClose').hidden = false; fillJoin(); openDlg('join'); });
  $('#joinClose').addEventListener('click', () => closeDlg('join'));

  /* ---------- tài khoản Google ---------- */
  function renderAuth(auth) {
    authKnown = true; authInfo = { enabled: !!auth.enabled, signedIn: !!auth.signedIn };
    $$('[data-account]').forEach(el => { el.hidden = !auth.enabled || !auth.signedIn; });
    $$('[data-auth-status]').forEach(el => {
      el.textContent = 'Công đức, tịnh tài đã cúng dường, hào quang và tiến độ tu luyện, luận võ đều được lưu vào tài khoản Google của bạn.';
    });
    // chưa đăng nhập: nút và thẻ mời đăng nhập hiện rõ; đã đăng nhập: hiện huy hiệu "Đã lưu"
    const mustLogin = !!auth.enabled && !auth.signedIn;
    $$('[data-auth-login]').forEach(el => { el.hidden = !mustLogin; });
    $$('[data-login-card]').forEach(el => { el.hidden = !mustLogin; });
    $$('[data-auth-logout]').forEach(el => { el.hidden = !auth.signedIn; });
    $$('[data-auth-signedin]').forEach(el => { el.hidden = !auth.signedIn; });
    $('#btnAccount').hidden = !auth.signedIn;
  }
  /** Chưa đăng nhập mà cần tài khoản (Võ Học Các, Sân đấu): mở hộp mời đăng nhập thay vì để người chơi bấm vào ngõ cụt. */
  function needLogin(why) {
    if (!authInfo.enabled || authInfo.signedIn) return false;
    $('#loginWhy').textContent = why;
    openDlg('login');
    return true;
  }
  /** Những gì đã lưu theo tài khoản: công đức, tịnh tài, hào quang, nội công, võ công, thắng thua. */
  function openAccount() {
    const list = $('#acList'), note = $('#acNote');
    list.textContent = ''; note.textContent = 'Đang tải…';
    openDlg('account');
    socket.emit('account:summary', {}, r => {
      if (!r || !r.ok) { note.textContent = (r && r.reason) || 'Chưa tải được, bạn thử lại nhé.'; return; }
      const row = (k, v) => { const d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; d.append(dt, dd); list.appendChild(d); };
      row('Công đức', `${NUM(r.merit.total)} (hôm nay ${NUM(r.merit.today)})`);
      row('Tịnh tài đã cúng dường', r.donated.count ? `${VND(r.donated.total)} · ${r.donated.count} lần` : 'Chưa có');
      const a = r.aura, tier = a && a.t ? AURA.TIERS[a.t - 1] : null;
      row('Hào quang', a && a.until > serverNow() ? `${tier ? tier.name : 'Đang tích tụ'} · còn ${Math.ceil((a.until - serverNow()) / 60000)} phút` : 'Không có (hào quang chỉ sáng vài phút sau mỗi lần cúng dường)');
      if (r.martial) {
        const m = r.martial;
        row('Nội công', `Cấp ${m.level} · công lực ${NUM(m.congLuc)} · nội lực ${m.manaMax}`);
        row('Võ công đã học', `${m.learned}/${m.totalSkills} chiêu`);
        row('Tâm đắc', `Cương ${m.tam.cuong} · Tốc ${m.tam.toc} · Nhu ${m.tam.nhu}`);
        row('Luận võ', `${m.wins} thắng · ${m.losses} thua · ${m.draws} hòa`);
        if (m.vouchers) row('Phiếu hoàn thành ngay', `${m.vouchers} phiếu`);
      }
      note.textContent = r.auth.signedIn ? 'Đã lưu vào tài khoản Google. Đổi máy, đăng nhập lại là còn.' : 'Bạn đang chơi vãng lai: dữ liệu chỉ nằm trên trình duyệt này.';
    });
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-open="account"]') || e.target.closest('#btnAccount')) openAccount(); });
  function showAuthError(text) {
    if ($('#dlg-join').open) {
      $('#joinWarn').textContent = text;
      $('#joinWarn').hidden = false;
    } else if ($('#dlg-login').open) {
      $('#loginWarn').textContent = text;
      $('#loginWarn').hidden = false;
    } else toast(text);
  }
  // AbortSignal.timeout không có trên Safari iOS 15 trở xuống
  function abortAfter(ms) { const ac = new AbortController(); setTimeout(() => ac.abort(), ms); return ac.signal; }
  async function changeAuth(login) {
    if (authPending) return;
    authPending = true;
    const buttons = $$('[data-auth-login], [data-auth-logout]');
    buttons.forEach(el => { el.disabled = true; });
    try {
      if (login && $('#dlg-join').open && !editing) {
        myName = $('#jName').value.trim();
        look = readLook();
        saveProfile();
      }
      const response = await fetch(login ? '/api/auth/google' : '/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: login ? JSON.stringify({ guest: uid }) : '{}',
        signal: abortAfter(10000)
      });
      if (!response.ok) throw new Error();
      location.assign(login ? (await response.json()).url : '/');
    } catch {
      authPending = false;
      buttons.forEach(el => { el.disabled = false; });
      showAuthError(login ? 'Chưa bắt đầu được đăng nhập Google. Bạn thử lại nhé.' : 'Chưa đăng xuất được. Bạn thử lại nhé.');
    }
  }
  $$('[data-auth-login]').forEach(el => el.addEventListener('click', () => changeAuth(true)));
  $$('[data-auth-logout]').forEach(el => el.addEventListener('click', () => changeAuth(false)));

  /* ---------- kết nối ---------- */
  const socket = io({ transports: ['websocket', 'polling'] });
  const fortune = Fortune.init({ socket, getMe: () => me, getJoined: () => joined, setScene: applyScene, getScene: () => curScene, toast, getNow: serverNow });
  socket.on('pscene', d => { Hall.playerScene(d); Voice.refresh(); });
  async function syncTime() {
    let best = null;
    for (let i = 0; i < 4; i++) {
      const t0 = Date.now();
      const st = await new Promise(res => socket.timeout(4000).emit('time', null, (err, v) => res(err ? null : v)));
      const t1 = Date.now();
      if (st == null) continue;
      const rtt = t1 - t0, off = st - (t0 + t1) / 2;
      if (!best || rtt < best.rtt) best = { rtt, off };
    }
    if (best) { offset = best.off; Hall.setOffset(offset); }
  }
  function join() {
    socket.emit('join', { name: myName, look, uid, adminKey: store.get('ta-admin') || undefined }, r => {
      $('#joinBtn').disabled = false;
      if (!r || !r.ok) { const w = $('#joinWarn'); w.textContent = (r && r.reason) || 'Chưa vào được, thử lại nhé.'; w.hidden = false; if (!$('#dlg-join').open) { fillJoin(); openDlg('join'); } return; }
      welcome(r);
    });
  }
  socket.on('connect', () => {
    $('#conn').hidden = true; Places.setConnected(true);
    syncTime();
    if (joined) { joined = false; join(); }
  });
  socket.on('disconnect', reason => {
    $('#conn').hidden = false; Places.setConnected(false);
    if (reason === 'io server disconnect' && !authPending) location.reload();
  });
  socket.on('connect_error', err => { $('#conn').hidden = false; if (err && err.message && /kết nối/.test(err.message)) $('#conn').textContent = err.message; });

  function welcome(r) {
    joined = true; editing = false; me = r.you; cfg = r.config;
    myAura = r.aura; renderAura();
    if (window.Celebrate) Celebrate.configure(cfg, { toast });
    if (window.Guide) Guide.configure(cfg);
    if (r.auth) renderAuth(r.auth);
    if (r.uid && r.uid !== uid) { uid = r.uid; store.set('ta-uid', uid); }
    if (!offset) { offset = r.serverTime - Date.now(); Hall.setOffset(offset); }
    $('#siteName').textContent = cfg.siteName; document.title = cfg.siteName + ' · Đi chùa online';
    Hall.setMe(me); Hall.setPlayers(r.players); Hall.setSweeper(r.sweeper); Hall.setIncense(r.incense); fortune.reset(r.fortuneQueue);
    $('#feed').textContent = ''; r.chat.forEach(addMsg); scrollFeed(true);
    renderPrayers(r.prayers); renderBoard(r.board); renderDonations(r.donations, r.funds);
    setStats(r.today, r.online); setMerit(r.merit);
    setChant(r.chant);
    $('#incKinds').innerHTML = cfg.kinds.map((k, i) => `<label class="chipr"><input type="radio" name="kind" value="${k}"${i === 0 ? ' checked' : ''}><span>${k}</span></label>`).join('');
    $('#trackList').innerHTML = Object.entries(cfg.tracks).map(([id, t]) => {
      const m = Math.max(1, Math.round(t.duration / 60));
      return `<button type="button" class="track" data-track="${id}"><b>${t.title}</b><small>khoảng ${m} phút</small></button>`;
    }).join('');
    $('#donCard').hidden = !cfg.donation && !r.donations.length;
    $('#actVoice').hidden = !cfg.voice;
    closeDlg('join');
    const authResult = new URLSearchParams(location.search).get('auth');
    if (authResult) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* bỏ qua */ } }
    if (authResult === 'ok') toast('Đã đăng nhập. Công đức và tiến độ của bạn được lưu vào tài khoản Google.');
    else if (authResult === 'error') toast('Chưa đăng nhập được Google. Bạn thử lại nhé.');
    else toast(`A Di Đà Phật. Chào ${myName}, mời bạn vào lễ Phật.`);
    if (cfg.voice) startVoice(true);                         // vào game và nối lại đều tự tham gia để nghe
    if (Library.book) socket.emit('reading', { book: Library.book.id });
    previewCelebrate();
    const mc = cfg.martial || {};
    $$('[data-place-card]').forEach(c => { c.hidden = !(c.dataset.placeCard === 'dojo' ? mc.enabled : c.dataset.placeCard === 'arena' ? mc.pk : true); });
    syncMapBar();
    Places.resume();                                         // mất mạng rồi nối lại: báo lại cho máy chủ biết đang ở nơi nào
    if (r.hasMatch && Places.current === 'hall' && mc.pk) {   // tải lại trang giữa trận: vào lại Sân đấu để tiếp tục, kẻo bị xử thua vì quá giờ
      toast('Bạn đang có một trận dở, đang đưa bạn về Sân đấu…');
      setTimeout(() => { if (Places.current === 'hall') Places.go('arena'); }, 600);
    }
  }
  // Xem thử hiệu ứng mốc công đức: mở trang với ?celebrate=100 (hoặc 300, 666, 999...). Chỉ chạy một lần mỗi lần mở trang.
  let previewed = false;
  function previewCelebrate() {
    if (previewed || !window.Celebrate) return;
    previewed = true;
    const n = (new URLSearchParams(location.search).get('celebrate') || '').trim();
    if (!/^\d{1,5}$/.test(n)) return;
    // Liên kết ?celebrate=666 ai mở cũng chạy được nên không tự hù: hỏi trước, từ chối (hay trình duyệt không cho hỏi) thì chỉ hiện thẻ chúc mừng
    setTimeout(() => {
      let kind;
      if (+n === 666) { let ok = false; try { ok = confirm('Xem thử mặt quỷ hù ở mốc 666? Có tiếng động mạnh và màn hình chớp đỏ.'); } catch (e) { /* bỏ qua */ } if (!ok) kind = 'bless'; }
      Celebrate.test(+n, kind);
    }, 900);
  }

  /* ---------- sự kiện từ máy chủ ---------- */
  socket.on('pj', p => { Hall.addPlayer(p); $('#online').textContent = NUM(Hall.count()); });
  socket.on('pl', d => { Voice.drop(d.id); Hall.removePlayer(d.id); $('#online').textContent = NUM(Hall.count()); voiceUI(); });
  socket.on('pv', d => { Hall.setVoice(d.id, d.v); voiceUI(); });
  socket.on('prd', d => Hall.setReading(d.id, d.rd));
  socket.on('pplace', d => { Hall.setPlace(d.id, d.place, d.x, d.z); Voice.refresh(); });
  socket.on('psit', d => { Hall.setSit(d.id, d.sit, d.cm); if (d.id === me && !(d.sit >= 0)) Meditate.close(); });
  socket.on('pm', d => { Hall.setMerit(d.id, d.mt, d.up); if (d.id === me) renderRank(); });
  socket.on('penalty', d => Hall.penalty(d.pid, d.n));
  socket.on('penalty:me', d => {
    const extra = (d.shout ? ' · gào thét ×1,5' : '') + (d.mult > 1 ? ` · tái phạm ×${String(d.mult).replace('.', ',')}` : '');
    const dm = MERIT.demonOf(d.total);
    toast(`${d.name}: −${NUM(d.n)} công đức${extra}.` + (dm ? ` Công đức còn ${NUM(d.total)}, ${MERIT.DEMONS[dm.n - 1].name} đang theo sau bạn.` : ''));
  });
  socket.on('aura', d => {
    Hall.setAura(d.pid, d.au, d.up);
    if (d.up && d.au && d.au.t && d.pid !== me) { const p = Hall.player(d.pid); if (p) ticker(`${p.name} đột phá cảnh giới ${AURA.TIERS[d.au.t - 1].name}`); }
  });
  socket.on('aura:me', aura => { myAura = aura; renderAura(); });
  socket.on('announce', d => announceQ(d));
  socket.on('sweeper:appear', event => Hall.setSweeper(event));
  socket.on('martial:inheritance', d => { toast(`Tảo Địa Tăng truyền thừa: +${d.gain} công lực, lên cảnh giới ${d.level}!`); if (window.Dojo) Dojo.refresh(); });
  socket.on('voice:kicked', d => { Voice.forceMute(); voiceUI(); toast(d.text); });
  socket.on('pu', d => Hall.updatePlayer(d));
  socket.on('p', arr => Hall.positions(arr));
  socket.on('chat', m => { addMsg(m); scrollFeed(); if (!m.sys && m.pid) Hall.bubble(m.pid, m.text); });
  socket.on('chat:hide', d => { const el = $(`#feed [data-id="${d.id}"]`); if (el) el.remove(); });
  socket.on('ticker', d => ticker(d.text));
  socket.on('notice', d => toast(d.text));
  socket.on('emote', d => {
    if (d.type === 'heart') Hall.heart(d.pid);
    else if (d.type === 'bow') Hall.bow(d.pid);
  });
  socket.on('bell', d => { SFX.bell(); Hall.bell(); if (d.pid === me && altarNote()) toast(altarNote().trim()); ticker(`${d.pid === me ? 'Bạn' : d.name} vừa thỉnh một tiếng chuông`); });
  socket.on('incense', d => {
    Hall.addIncense(d.sticks);
    if (d.pid === me) { Hall.floater(`${d.sticks.length} nén nhang · ${d.kind}`); SFX.ting(); }
    else ticker(`${d.name} vừa thắp ${d.sticks.length} nén nhang · ${d.kind}`);
  });
  socket.on('offer', d => {
    today[d.item] = (today[d.item] || 0) + 1; Hall.setAltar(today); renderToday();
    if (d.pid === me) { Hall.floater('Bạn vừa ' + ITEM_TEXT[d.item]); SFX.ting(); }
    else ticker(`${d.name} vừa ${ITEM_TEXT[d.item]}`);
  });
  socket.on('prayer', p => { prayers.unshift(p); renderPrayers(); });
  socket.on('prayer:n', d => { const p = prayers.find(x => x.id === d.id); if (p) { p.n = d.n; renderPrayers(); } });
  socket.on('prayer:hide', d => { prayers = prayers.filter(x => x.id !== d.id); renderPrayers(); });
  socket.on('stats', d => setStats(d.today, d.online));
  socket.on('board', renderBoard);
  socket.on('merit', setMerit);
  socket.on('milestone', d => { if (window.Celebrate) Celebrate.show(d); });
  socket.on('chant', setChant);
  socket.on('donation', d => { donations.unshift(d.d); renderDonations(null, d.funds); $('#donCard').hidden = false; });
  socket.on('donation:ok', d => {
    if (d.merit) setTimeout(() => toast(`Cúng dường ${VND(d.amount)}: +${NUM(d.merit)} công đức.`), 1600);
    if (d.aura) {
      myAura = d.aura; renderAura();
      if (d.aura.up && d.aura.t) setTimeout(() => toast(`Hào quang bừng sáng: bạn đã đột phá cảnh giới ${AURA.TIERS[d.aura.t - 1].name}!`), 3200);
    }
    if (pendingCode === d.code) {
      $('#dnQr').hidden = true; $('#dnDone').hidden = false;
      $('#dnDoneText').textContent = `Đã ghi nhận cúng dường ${VND(d.amount)} cho quỹ “${d.fund}”. Tùy hỷ công đức của bạn.`;
      pendingCode = null; SFX.bell(0.7);
    } else toast('Nhà chùa đã nhận tịnh tài của bạn. Tùy hỷ công đức.');
  });

  /* ---------- chat ---------- */
  function scrollFeed(force) { const f = $('#feed'); if (force || f.scrollHeight - f.scrollTop - f.clientHeight < 120) f.scrollTop = f.scrollHeight; }
  function addMsg(m) {
    const feed = $('#feed');
    if (m.sys) {
      const s = document.createElement('div'); s.className = 'sysmsg'; s.dataset.id = m.id; s.textContent = m.text; feed.appendChild(s);
    } else {
      const el = document.createElement('div'); el.className = 'msg' + (m.pid === me ? ' me' : ''); el.dataset.id = m.id;
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = (Hall.COLORS[m.c] || Hall.COLORS[0]).c;
      const body = document.createElement('div');
      const meta = document.createElement('div'); meta.className = 'meta';
      const b = document.createElement('b'); b.textContent = m.name; meta.appendChild(b);
      if (m.mod) { const bd = document.createElement('span'); bd.className = 'badge'; bd.textContent = 'Ban điều hành'; meta.appendChild(bd); }
      const tm = document.createElement('time'); tm.textContent = hhmm(m.t); meta.appendChild(tm);
      const p = document.createElement('p'); p.textContent = m.text;
      body.append(meta, p); el.append(dot, body);
      if (m.pid !== me && !m.mod) {
        const tools = document.createElement('div'); tools.className = 'tools';
        const rep = document.createElement('button'); rep.type = 'button'; rep.textContent = 'Báo cáo';
        rep.addEventListener('click', () => { socket.emit('report', { id: m.id }); rep.disabled = true; });
        tools.appendChild(rep);
        if (isMod()) {
          const hide = document.createElement('button'); hide.type = 'button'; hide.textContent = 'Ẩn';
          hide.addEventListener('click', () => socket.emit('mod:hide', { id: m.id }));
          tools.appendChild(hide);
        }
        el.appendChild(tools);
      }
      feed.appendChild(el);
    }
    while (feed.children.length > 150) feed.firstChild.remove();
  }
  const isMod = () => { const p = Hall.player(me); return !!(p && p.mod); };
  function sendChat(text) {
    const w = $('#chatWarn'); w.hidden = true;
    if (!joined || !text.trim()) return;
    socket.emit('chat', { text }, r => {
      if (r && !r.ok) { w.textContent = r.reason; w.hidden = false; }
      else $('#msg').value = '';
    });
  }
  $('#composer').addEventListener('submit', e => { e.preventDefault(); sendChat($('#msg').value); });
  $$('[data-quick]').forEach(b => b.addEventListener('click', () => sendChat(b.dataset.quick)));

  /* ---------- tab ---------- */
  function showTab(name) {
    $$('.tabs [role=tab]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    ['chat', 'prayers', 'merit', 'places'].forEach(n => { $('#pane-' + n).hidden = n !== name; });
    if (name === 'chat') scrollFeed(true);
  }
  $$('.tabs [role=tab]').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $('#meritPill').addEventListener('click', () => showTab('merit'));

  /* ---------- lời nguyện ---------- */
  let prayers = [];
  const rejoiced = new Set(JSON.parse(store.get('ta-rj') || '[]'));
  function renderPrayers(list) {
    if (list) prayers = list.slice().reverse();
    const box = $('#prayers'); box.textContent = '';
    if (!prayers.length) { box.innerHTML = '<p class="empty">Chưa có lời nguyện nào. Thắp nhang và gửi lời nguyện đầu tiên nhé.</p>'; return; }
    prayers.slice(0, 60).forEach(p => {
      const c = document.createElement('article'); c.className = 'pcard';
      const k = document.createElement('span'); k.className = 'k ' + (KCLS[p.kind] || ''); k.textContent = p.kind;
      const tx = document.createElement('p'); tx.textContent = p.text;
      const f = document.createElement('footer');
      const who = document.createElement('span'); who.textContent = `${p.name} · ${hhmm(p.t)}`;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'rejoice';
      const done = rejoiced.has(p.id);
      b.setAttribute('aria-pressed', String(done)); b.textContent = `Tùy hỷ · ${p.n}`;
      b.addEventListener('click', () => {
        if (rejoiced.has(p.id)) return;
        rejoiced.add(p.id); store.set('ta-rj', JSON.stringify([...rejoiced].slice(-300)));
        socket.emit('rejoice', { id: p.id }); b.setAttribute('aria-pressed', 'true');
      });
      f.append(who, b); c.append(k, tx, f); box.appendChild(c);
    });
  }

  /* ---------- công đức & thống kê ---------- */
  function setMerit(m) {
    myTotal = m.total; renderRank();
    const old = +($('#meritToday').dataset.v || 0);
    $('#meritToday').textContent = NUM(m.today); $('#meritToday').dataset.v = m.today;
    $('#mtToday').textContent = NUM(m.today); $('#mtTotal').textContent = NUM(m.total);
    if (m.today > old) { const p = $('#meritPill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
  }
  function setStats(t, online) {
    today = Object.assign({}, t); Hall.setAltar(today); renderToday();
    if (online != null) $('#online').textContent = NUM(online);
  }
  function renderToday() {
    $('#todayStats').innerHTML = `<span>Hôm nay: <b>${NUM(today.incense)}</b> nén nhang</span><span><b>${NUM((today.lotus || 0) + (today.rose || 0))}</b> hoa</span><span><b>${NUM(today.hearts)}</b> tim</span><span><b>${NUM(today.mo)}</b> tiếng mõ</span>`;
    const rows = [['Nén nhang', today.incense], ['Hoa sen', today.lotus], ['Hoa hồng', today.rose], ['Đèn', today.lamp], ['Mâm quả', today.fruit], ['Tim', today.hearts], ['Tiếng mõ', today.mo], ['Lượt vái lạy', today.bows], ['Tiếng chuông', today.bells], ['Khóa tụng', today.chants], ['Lượt vào chùa', today.visits]];
    $('#statgrid').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${NUM(v)}</dd></div>`).join('');
  }
  function renderBoard(list) {
    const ol = $('#board'); ol.textContent = '';
    if (!list.length) { ol.innerHTML = '<li class="empty" style="display:block">Chưa có ai. Bạn gõ mõ hoặc thắp nhang để bắt đầu.</li>'; return; }
    list.forEach(x => { const li = document.createElement('li'); const s = document.createElement('span'); s.textContent = x.name; const b = document.createElement('b'); b.textContent = NUM(x.v); li.append(s, b); ol.appendChild(li); });
  }
  let donations = [];
  function renderDonations(list, funds) {
    if (list) donations = list.slice().reverse();
    if (funds) {
      $('#funds').innerHTML = funds.map(f => {
        const pct = f.goal ? Math.min(100, Math.round(f.raised / f.goal * 100)) : 0;
        const name = document.createElement('span'); name.textContent = f.name;
        return `<div class="fund"><div class="top">${name.outerHTML}<span>${VND(f.raised)}${f.goal ? ' · ' + pct + '%' : ''}</span></div>${f.goal ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}</div>`;
      }).join('');
    }
    const ul = $('#dons'); ul.textContent = '';
    if (!donations.length) { ul.innerHTML = '<li class="empty" style="display:block">Chưa có lượt cúng dường nào.</li>'; return; }
    donations.slice(0, 30).forEach(d => {
      const li = document.createElement('li');
      const n = document.createElement('b'); n.textContent = d.name;
      const a = document.createElement('span'); a.className = 'amt'; a.textContent = d.amount == null ? 'Ẩn số tiền' : VND(d.amount);
      const w = document.createElement('span'); w.className = 'what'; w.textContent = `Quỹ ${d.fund} · ${hhmm(d.t)}${d.note ? ' · “' + d.note + '”' : ''}`;
      li.append(n, a, w); ul.appendChild(li);
    });
  }

  /* ---------- tụng kinh chung ---------- */
  // Bài tụng là file MP3 dựng sẵn; JSON đi kèm cho biết mốc từng chữ để chữ chạy theo tiếng.
  const chantMeta = {};
  function loadChantMeta(track) {
    if (!chantMeta[track]) {
      const info = cfg && cfg.tracks[track];
      chantMeta[track] = fetch('/audio/chants/' + (info ? info.json : track + '.json'))
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .catch(e => { delete chantMeta[track]; throw e; });
    }
    return chantMeta[track];
  }
  let meta = null;
  function setChant(c) {
    chant = c; meta = null; lastKey = '';
    $('#chantbar').hidden = !c;
    if (c) {
      $('#cbTitle').textContent = c.title;
      $('#cbCur').textContent = 'Đang tải bài tụng…'; $('#cbNext').textContent = '';
      loadChantMeta(c.track).then(m => {
        if (!chant || chant.track !== c.track) return;
        meta = m; SFX.startChant(c.track, c.startedAt, m.file);
      }).catch(() => { $('#cbCur').textContent = 'Không tải được bài tụng. Tải lại trang giúp mình nhé.'; });
    } else SFX.stopChant();
    Voice.setDuck(c ? 0.3 : 1);                                   // đang tụng kinh thì tiếng nói chuyện nhỏ lại
    $('#cbStop').hidden = !(c && isMod());
    updateChantJoin();
  }
  function updateChantJoin() { $('#cbJoin').hidden = !chant || (SFX.ready && !muted && !SFX.chantBlocked); }
  $('#cbJoin').addEventListener('click', () => {
    SFX.unlock(); if (muted) { muted = false; store.set('ta-muted', '0'); }
    renderSound(); if (chant) SFX.syncChant(serverNow()); setTimeout(updateChantJoin, 400);
  });
  $('#cbStop').addEventListener('click', () => socket.emit('chant:stop'));
  setInterval(() => { if (chant && meta) { SFX.syncChant(serverNow()); updateChantJoin(); } }, 250);
  let lastKey = '';
  const mmss = s => Math.floor(s / 60) + ':' + pad(Math.floor(s % 60));
  function chantUI() {
    if (chant && meta) {
      const el = (serverNow() - chant.startedAt) / 1000, ev = meta.events, first = ev.length ? ev[0][0] : 0;
      const lastSyl = ev.length ? ev[ev.length - 1][0] : 0;
      if (el < first) {
        if (lastKey !== 'wait') { $('#cbCur').textContent = el < 0 ? 'Chuẩn bị…' : 'Thỉnh chuông khai kinh…'; $('#cbNext').textContent = meta.lines[0]; lastKey = 'wait'; }
        $('#cbTime').textContent = el < 0 ? `bắt đầu sau ${Math.ceil(-el)} giây` : mmss(el) + ' / ' + mmss(meta.duration);
      } else {
        let lo = 0, hi = ev.length - 1;                       // tìm chữ đang tụng
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ev[mid][0] <= el) lo = mid; else hi = mid - 1; }
        const [, li, si] = ev[lo], ended = el > lastSyl + 1.2;
        if (String(li) !== lastKey) {
          lastKey = String(li);
          const cur = $('#cbCur'); cur.textContent = '';
          meta.lines[li].split(/\s+/).filter(Boolean).forEach(w => { const sp = document.createElement('span'); sp.className = 'sy'; sp.textContent = w; cur.append(sp, ' '); });
          $('#cbNext').textContent = meta.lines[li + 1] || '';
        }
        $$('#cbCur .sy').forEach((sp, k) => { sp.classList.toggle('on', !ended && k === si); sp.classList.toggle('past', ended || si === -1 || k < si); });
        $('#cbTime').textContent = ended ? 'Hồi hướng công đức' : `${mmss(el)} / ${mmss(meta.duration)}`;
      }
    }
    requestAnimationFrame(chantUI);
  }
  requestAnimationFrame(chantUI);

  /* ---------- hành động ---------- */
  let moCount = 0;
  setInterval(() => { if (moCount && joined) { socket.emit('mo', { n: Math.min(5, moCount) }); moCount = 0; } }, 1000);
  function pulse(btn) { if (!btn) return; btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); setTimeout(() => btn.classList.remove('hit'), 160); }
  /** Lễ (thắp nhang, dâng hoa, thỉnh chuông) luôn dâng ở bàn thờ chánh điện, dù đang đứng ở map nào: báo rõ để không ai ngỡ lễ bị mất. */
  function altarNote() { return curScene !== 'hall' ? ' Lễ đã dâng lên bàn thờ ở chánh điện.' : ''; }
  function act(name, btn, walk) {
    if (!joined) { openDlg('join'); return; }
    SFX.unlock();
    switch (name) {
      case 'voice':
        toggleVoiceMic();
        pulse(btn); break;
      case 'library':                                          // thẻ Khám phá: vào Tàng Kinh Các; đang ở trong rồi thì mở kệ kinh
        if (curScene !== 'library' && Places.current === 'hall') goScene('library'); else Library.open();
        break;
      case 'yard': goMap('yard'); break;                       // thẻ Khám phá: ra Sân chùa
      case 'read': Library.open(); break;
      case 'incense': $('#incWarn').hidden = true; openDlg('incense'); break;
      case 'flower': closeDlg('donate'); openDlg('flower'); break;
      case 'heart': socket.emit('emote', { type: 'heart' }); SFX.pop(); pulse(btn); break;
      case 'bow': socket.emit('emote', { type: 'bow' }); SFX.ting(); pulse(btn); break;
      case 'mo': SFX.mo(); moCount++; pulse(btn); break;
      case 'bell': socket.emit('bell'); pulse(btn); break;      // báo "lễ đã dâng" chờ máy chủ chấp nhận (sự kiện 'bell' của chính mình)
      case 'chant':
        if (chant) { if (!SFX.ready || muted) $('#cbJoin').click(); else toast('Đang có khóa tụng chung. Mời bạn tụng cùng.'); }
        else openDlg('chant');
        break;
      case 'donate': openDonate(); break;
      case 'dojo':
        if (needLogin('Võ Học Các cần tài khoản để lưu công lực, cấp nội công và chiêu đã học.')) break;
        Places.go('dojo'); break;
      case 'arena':
        if (needLogin('Sân đấu cần tài khoản để ghi thắng thua và giữ bộ chiêu của bạn.')) break;
        Places.go('arena'); break;
    }
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, b); });

  $('#incForm').addEventListener('submit', e => {
    e.preventDefault();
    const w = $('#incWarn'); w.hidden = true;
    socket.emit('incense', {
      sticks: +$('#incForm [name=sticks]:checked').value,
      kind: ($('#incForm [name=kind]:checked') || { value: 'Cầu an' }).value,
      text: $('#incText').value, pub: $('#incPub').checked, anon: $('#incAnon').checked
    }, r => {
      if (!r || !r.ok) { w.textContent = (r && r.reason) || 'Chưa thắp được.'; w.hidden = false; return; }
      $('#incText').value = ''; closeDlg('incense');
      toast('Đã thắp nhang. Chắp tay, tâm niệm lời nguyện của bạn.' + altarNote());
    });
  });
  $$('.offer').forEach(b => b.addEventListener('click', () => {
    socket.emit('offer', { item: b.dataset.item }, r => {
      if (r && !r.ok) { toast(r.reason); return; }
      closeDlg('flower');
      if (altarNote()) toast(altarNote().trim());
    });
  }));
  $('#trackList').addEventListener('click', e => {
    const b = e.target.closest('[data-track]'); if (!b) return;
    socket.emit('chant:start', { track: b.dataset.track }, r => {
      if (r && !r.ok) { toast(r.reason); return; }
      closeDlg('chant');
      if (muted) { muted = false; store.set('ta-muted', '0'); renderSound(); }
    });
  });

  /* ---------- cúng dường ---------- */
  let pendingCode = null;
  function openDonate() {
    const on = !!(cfg && cfg.donation);
    $('#dnOff').hidden = on; $('#dnForm').hidden = !on; $('#dnQr').hidden = true; $('#dnDone').hidden = true; $('#dnWarn').hidden = true;
    if (on) {
      const d = cfg.donation;
      $('#dnSub').textContent = `Tiền chuyển thẳng vào tài khoản ${d.bank} ${d.account}${d.accountName ? ' (' + d.accountName + ')' : ''}. Website không giữ tiền.`;
      $('#dnFormHint').textContent = 'Khi nhà chùa xác nhận đã nhận, nhân vật của bạn tỏa hào quang theo số tiền, cộng dồn qua nhiều lần cúng dường.';
      $('#dnFunds').innerHTML = cfg.donation.funds.map((f, i) => `<label class="opt"><input type="radio" name="fund" value="${f.id}"${i === 0 ? ' checked' : ''}><span><b></b></span></label>`).join('');
      $$('#dnFunds .opt b').forEach((b, i) => { b.textContent = cfg.donation.funds[i].name; });
      $('#dnName').value = myName;
    }
    openDlg('donate');
  }
  $('#dnForm').addEventListener('change', e => { if (e.target.name === 'amt') { $('#dnOther').hidden = e.target.value !== 'other'; if (e.target.value === 'other') $('#dnOther').focus(); } });
  $('#dnForm').addEventListener('submit', e => {
    e.preventDefault();
    const w = $('#dnWarn'); w.hidden = true;
    const sel = $('#dnForm [name=amt]:checked').value;
    const amount = sel === 'other' ? parseInt(($('#dnOther').value || '').replace(/\D/g, ''), 10) : +sel;
    if (!amount || amount < 10000) { w.textContent = 'Số tiền tối thiểu là 10.000đ.'; w.hidden = false; return; }
    socket.emit('donate', {
      amount, fund: ($('#dnForm [name=fund]:checked') || {}).value, name: $('#dnName').value,
      anon: $('#dnAnon').checked, hide: $('#dnHide').checked, aura: $('#dnAura').checked, note: $('#dnNote').value
    }, r => {
      if (!r || !r.ok) { w.textContent = (r && r.reason) || 'Chưa tạo được mã.'; w.hidden = false; return; }
      pendingCode = r.code;
      $('#qrImg').src = r.qr;
      $('#qrImg').alt = 'Mã VietQR để chuyển khoản cúng dường';
      $$('.qr-live').forEach(el => { el.hidden = false; });
      $('#qrHint').textContent = 'Quét mã bằng app ngân hàng và kiểm tra tên chủ tài khoản trước khi chuyển. Giữ đúng nội dung chuyển khoản để được ghi nhận công đức.';
      $('#qrBank').textContent = r.bank; $('#qrAcc').textContent = r.account; $('#qrName').textContent = r.accountName || '—';
      $('#qrAmt').textContent = VND(r.amount); $('#qrCode').textContent = r.code; $('#qrFund').textContent = r.fund;
      $('#qrStatus').textContent = 'Đang chờ xác nhận cúng dường. Trang sẽ tự cập nhật.';
      $('#dnForm').hidden = true; $('#dnQr').hidden = false;
    });
  });
  $('#qrBack').addEventListener('click', () => { $('#dnQr').hidden = true; $('#dnForm').hidden = false; });
  $('#qrCopy').addEventListener('click', () => {
    const t = $('#qrCode').textContent;
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($('#qrCode')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Đã chọn nội dung, bấm sao chép trên máy của bạn.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast('Đã chép mã giao dịch.'), fallback); else fallback();
  });

  $('#dnAnon').addEventListener('change', e => { $('#dnAura').disabled = e.target.checked; if (e.target.checked) $('#dnAura').checked = false; });

  /* ---------- nói chuyện bằng giọng ---------- */
  const MIC_ERR = {
    denied: 'Bạn chưa cho phép dùng micro nên đang chỉ nghe. Muốn nói, cho phép micro trong cài đặt trình duyệt rồi bấm lại.',
    insecure: 'Trang cần mở bằng https mới dùng được micro. Bạn vẫn nghe được mọi người.',
    nomic: 'Không tìm thấy micro trên máy này. Bạn vẫn nghe được mọi người.'
  };
  Voice.init(socket, {
    myId: () => me,
    player: id => Hall.player(id),
    players: () => Hall.list(),
    talk: (id, lv) => Hall.setTalk(id, lv),
    audioContext: () => SFX.context(),
    notice: t => toast(t),
    change: () => {
      voiceUI();
    }
  });
  let voiceRetry = 0;
  async function startVoice(silent) {
    if (Voice.joining) return false;
    voiceUI(true);
    const r = await Voice.join();
    if (!r.ok) {
      if (!silent) toast(r.reason);
      if (joined && cfg && cfg.voice && Voice.supported) { clearTimeout(voiceRetry); voiceRetry = setTimeout(() => { if (joined && !Voice.active) startVoice(true); }, 5000); }
      voiceUI(); return false;
    }
    clearTimeout(voiceRetry);
    Voice.setMuted(muted); Voice.setDuck(chant ? 0.3 : 1);
    voiceUI(); return true;
  }
  let voiceMicBusy = false;
  async function toggleVoiceMic() {
    if (voiceMicBusy) return;
    voiceMicBusy = true;
    try {
      if (!Voice.active && !(await startVoice(false))) return;
      const result = await Voice.toggleMic();
      if (typeof result === 'string') toast(MIC_ERR[result] || result);
    } finally { voiceMicBusy = false; voiceUI(); }
  }
  let personId = null;
  /** Hộp tương tác chung: người chơi hay NPC đều là Actor (public/js/actors.js), nút hiện theo actor.menu(). */
  function openPerson(id) {
    const p = Hall.player(id) || Hall.npc(id); if (!p) return;
    personId = id;
    const menu = p.menu();
    $('#person-title').textContent = p.isNpc ? p.name.split(' · ')[0] : p.name;
    if (p.isNpc) $('#person-hint').textContent = 'Khách trong chùa. Lại gần trò chuyện đôi câu cho vui.';
    else $('#person-hint').textContent = Places.current === 'arena' ? 'Chọn thao tác với người chơi này.' : 'Mời người này cùng ra Sân đấu để luận võ.';
    $('#person-mute').textContent = Voice.isMuted(id) ? 'Bật tiếng người này' : 'Tắt tiếng người này';
    $('#person-mute').hidden = !menu.includes('mute');
    $('#person-challenge').hidden = !menu.includes('challenge') || !(cfg && cfg.martial && cfg.martial.pk);
    $('#person-talk').hidden = !menu.includes('talk');
    openDlg('person');
  }
  /* ---------- trò chuyện với NPC: đi tới gần (NPC vẫn đi lang thang), tới nơi thì NPC đáp một câu ---------- */
  const TALK_NEAR = 0.14;                                  // dưới ngưỡng máy chủ (Actors.TALK_RANGE) để chừa độ trễ
  let talkRun = 0;
  function stopTalk() { talkRun++; }
  function talkTo(id) {
    if (!joined) { openDlg('join'); return; }
    const run = ++talkRun, until = Date.now() + 20000;
    let aim = null;
    const step = () => {
      if (run !== talkRun) return;
      const n = Hall.npc(id), mine = Hall.player(me);
      if (!n || !mine) { stopTalk(); return; }
      if (pdist(mine, n) <= TALK_NEAR) { stopTalk(); finishTalk(n); return; }
      if (Date.now() > until) { stopTalk(); toast('Người ấy đi xa mất rồi, chạm lại để trò chuyện nhé.'); return; }
      Hall.npcHold(id, 1500);                              // NPC thường đứng chờ; NPC cơ duyên vẫn đi theo giờ máy chủ
      const x = Math.min(0.97, Math.max(0.03, n.x)), z = Math.min(0.97, n.z + 0.05);   // đứng trước mặt NPC một chút
      if (!aim || pdist(aim, { x, z }) > 0.03) { aim = { x, z }; socket.emit('move', aim); }
      setTimeout(step, 300);
    };
    step();
  }
  function finishTalk(n) {
    Hall.npcTalk(n.id);
    const gift = n.gift();                                 // chỉ NPC cơ duyên có quà; máy chủ quyết có nhận được không
    if (!gift) return;
    socket.emit(gift.event, gift.data, r => {
      if (!r) return toast('Chưa thể trò chuyện, hãy thử lại.');
      if (!r.ok) return r.code === 'login' ? needLogin(r.reason) : toast(r.reason || 'Cơ duyên chưa tới.');
      if (gift.kind === 'sweeper') { if (r.already) toast('Bạn đã nhận truyền thừa trong lần gặp này.'); return; }
      toast(r.already ? `Bạn đã lĩnh ngộ ${r.name}.` : `Cơ duyên xuất hiện! Bạn lĩnh ngộ ${r.name}.`);
    });
  }
  $('#person-talk').addEventListener('click', () => {
    const id = personId; closeDlg('person');
    if (id != null) talkTo(id);
  });
  $('#person-mute').addEventListener('click', () => {
    if (personId == null) return;
    const off = !Voice.isMuted(personId); Voice.mute(personId, off);
    toast(off ? 'Đã tắt tiếng người chơi này.' : 'Đã bật tiếng người chơi này.');
    closeDlg('person'); voiceUI();
  });
  $('#person-challenge').addEventListener('click', () => {
    const id = personId; closeDlg('person');
    if (id == null) return;
    if (Places.current === 'arena') { if (window.Arena && Arena.pick) Arena.pick(id); return; }
    socket.emit('spar:invite', { toPid: id }, r => {
      if (!r || !r.ok) { if (r && r.code === 'login') needLogin(r.reason); else toast((r && r.reason) || 'Chưa gửi được lời mời.'); return; }
      toast('Đã gửi lời mời cùng ra Sân đấu.');
    });
  });
  let sparOffer = null, sparTarget = null;
  socket.on('spar:invited', d => {
    if (!d || $('#dlg-spar').open) return;
    sparOffer = d.id;
    $('#spar-message').textContent = `${d.name} mời bạn cùng ra Sân đấu để luận võ. Bạn có đồng ý không?`;
    openDlg('spar');
  });
  function respondSpar(accept) {
    const id = sparOffer; sparOffer = null; closeDlg('spar');
    if (!id) return;
    socket.emit('spar:respond', { id, accept }, r => { if (!r || !r.ok) toast((r && r.reason) || 'Lời mời không còn hiệu lực.'); });
  }
  $('#spar-accept').addEventListener('click', () => respondSpar(true));
  $('#spar-decline').addEventListener('click', () => respondSpar(false));
  $('#dlg-spar').addEventListener('cancel', e => { e.preventDefault(); respondSpar(false); });
  function openSparTarget() {
    if (sparTarget == null || Places.current !== 'arena' || !window.Arena) return;
    const target = sparTarget; sparTarget = null; Arena.pick(target);
  }
  socket.on('spar:declined', () => toast('Người chơi đã từ chối lời mời.'));
  socket.on('spar:accepted', () => {
    closeDlg('spar'); sparOffer = null;
    Places.go('arena').then(ok => { if (ok) openSparTarget(); });
  });
  socket.on('spar:ready', d => { sparTarget = d.toPid; openSparTarget(); });
  let vuiT = 0;
  function voiceUI(joining) {
    if (vuiT && !joining) return;
    vuiT = requestAnimationFrame(() => { vuiT = 0; renderVoice(joining); });
  }
  const pdist = (a, b) => Math.hypot((a.x - b.x) * 1.6, a.z - b.z);
  function renderVoice(joining) {
    const on = Voice.active, b = $('#actVoice');
    b.classList.toggle('on', on && Voice.mic); b.classList.toggle('off', on && !Voice.mic);
    b.setAttribute('aria-pressed', String(on && Voice.mic));
    $('#actVoiceLbl').textContent = joining || Voice.joining ? 'Đang nối…' : Voice.mic ? 'Mic đang bật' : 'Nói chuyện';
    $('#voicebar').hidden = !joined || !(cfg && cfg.voice);
    $('#stage').classList.toggle('voice-on', on);
    if ($('#voicebar').hidden) return;
    const st = Voice.stats();
    const anyTalking = Voice.mic || Voice.peers().some(p => p.level > 0.018 && !p.muted);
    SFX.setAmbienceDuck('voice', on && anyTalking);
    $('#vbMic').setAttribute('aria-pressed', String(Voice.mic));
    $('#vbMic').classList.toggle('off', !Voice.mic);
    $('#vbTitle').textContent = joining || Voice.joining ? 'Đang kết nối tiếng…' : !on ? 'Chưa kết nối tiếng' : Voice.mic ? 'Mic đang bật' : 'Đang nghe · mic tắt';
    $('#vbSub').textContent = !on ? (['dojo', 'arena'].includes(document.body.dataset.place) ? 'Chạm mic để thử kết nối và nói chuyện.' : 'Bấm Nói chuyện ở thanh dưới để thử kết nối.') : Voice.audioBlocked ? 'Chạm màn hình để bật âm thanh.' : st.connected ? `${st.connected} người ở gần nghe được nhau`
      : st.peers ? 'Đang nối tiếng với người ở gần…' : 'Chưa có ai ở gần bật nói chuyện. Đi lại gần đạo hữu khác nhé.';
    if ($('#dlg-voice').open) renderVoiceList();
    // Hộp nổi tự thu nhỏ thành chấm trạng thái sau 6 giây không đổi; có thay đổi thì mở lại
    const place = document.body.dataset.place || '';
    const sig = $('#vbTitle').textContent + '|' + $('#vbSub').textContent;
    if (sig !== vbSig || place !== vbPlace) { vbSig = sig; vbPlace = place; vbExpand(); }
  }
  let vbSig = '', vbPlace = '', vbTimer = 0;
  function vbExpand() {
    const vb = $('#voicebar'); vb.classList.remove('mini');
    clearTimeout(vbTimer);
    vbTimer = setTimeout(() => vb.classList.add('mini'), 6000);
  }
  $('#voicebar').addEventListener('click', e => { if ($('#voicebar').classList.contains('mini') && !e.target.closest('.vb-mic')) vbExpand(); });
  function renderVoiceList() {
    const box = $('#vcList'), mine = Hall.player(me), conn = new Map(Voice.peers().map(p => [p.pid, p]));
    const list = Hall.list().filter(p => p.id !== me && p.v && Voice.sameRoom(mine, p)).map(p => ({ p, d: mine ? Voice.distance(mine, p) : 9 })).sort((a, b) => a.d - b.d);
    box.textContent = '';
    if (!list.length) { box.innerHTML = '<p class="empty">Chưa có ai khác bật nói chuyện.</p>'; return; }
    list.slice(0, 40).forEach(({ p, d }) => {
      const c = conn.get(p.id), row = document.createElement('div'); row.className = 'vc-row';
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = (Hall.COLORS[p.look.c] || Hall.COLORS[0]).c;
      const info = document.createElement('div'); info.className = 'vc-info';
      const n = document.createElement('b'); n.textContent = p.name;
      const sub = document.createElement('small');
      sub.textContent = (p.v === 2 ? 'Mic bật' : 'Đang nghe') + ' · ' + (c ? (c.state === 'connected' ? (c.vol > 0.6 ? 'gần, nghe rõ' : c.vol > 0.05 ? 'hơi xa, nghe nhỏ' : 'xa, gần như không nghe') : 'đang nối…') : d > 0.66 ? 'ở xa, lại gần để nghe' : 'chưa nối');
      info.append(n, sub);
      const meter = document.createElement('span'); meter.className = 'vc-meter'; meter.style.setProperty('--lv', c ? Math.min(1, c.level * 10).toFixed(2) : 0);
      const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'btn small';
      mute.textContent = Voice.isMuted(p.id) ? 'Bật tiếng' : 'Tắt tiếng';
      mute.addEventListener('click', () => { Voice.mute(p.id, !Voice.isMuted(p.id)); renderVoiceList(); });
      row.append(dot, info, meter, mute);
      if (isMod() && !p.mod) {
        const lock = document.createElement('button'); lock.type = 'button'; lock.className = 'btn small'; lock.textContent = 'Khóa mic 10 phút';
        lock.addEventListener('click', () => { socket.emit('mod:voice', { pid: p.id }); lock.disabled = true; });
        row.appendChild(lock);
      }
      box.appendChild(row);
    });
  }
  $('#vbMic').addEventListener('click', toggleVoiceMic);
  $('#vbList').addEventListener('click', () => { renderVoiceList(); openDlg('voice'); });
  $('#vcVol').value = Math.round(Number(store.get('ta-voice-vol') || 1) * 100);
  Voice.setVolume($('#vcVol').value / 100);
  $('#vcVol').addEventListener('input', e => { Voice.setVolume(e.target.value / 100); store.set('ta-voice-vol', String(e.target.value / 100)); });
  setInterval(() => { if (Voice.active) voiceUI(); }, 1000);

  /* ---------- Tàng Kinh Các ---------- */
  Library.init({
    reading(book) { if (joined) { socket.emit('reading', { book }); Hall.setReading(me, book); } },
    chant(track) {
      if (!joined) return;
      if (chant) { closeDlg('library'); act('chant'); return; }
      socket.emit('chant:start', { track }, r => {
        if (r && !r.ok) { toast(r.reason); return; }
        closeDlg('library');
        if (muted) { muted = false; store.set('ta-muted', '0'); renderSound(); }
      });
    }
  });

  /* ---------- các nơi: Võ Học Các, Sân đấu (tách khỏi chánh điện) ---------- */
  Places.init({
    setPlace: (name, cb) => socket.emit('place:set', { place: name }, cb),
    toast,
    denied(ack) {                                              // máy chủ từ chối vì chưa đăng nhập: mời đăng nhập thay vì chỉ báo lỗi
      if (ack && ack.code === 'login') { needLogin(ack.reason || 'Bạn cần đăng nhập để vào nơi này.'); return true; }
      return false;
    },
    onChange(name) {
      SFX.recover();
      Hall.pause(name === 'dojo'); Hall.setPlace(me, name);       // Sân đấu có khung vẽ riêng (Arena gắn cảnh vào đó)
      if (name !== 'hall') Meditate.close();
      syncMapBar();
      // Voice tự chuyển phòng khi nơi của người chơi đổi; giữ trạng thái mic rõ ràng trên thanh điều khiển.
      voiceUI();
    }
  });
  const martialHost = {
    socket, toast, serverNow,
    goto: name => Places.go(name),
    cfg: () => cfg || { martial: { enabled: false } },
    auth: () => authInfo,
    login: () => changeAuth(true),
    needLogin,
    me: () => ({ pid: me, name: myName, look }),
    meritTotal: () => myTotal,
    vnd: VND,
    // sân đấu đi lại được: cảnh 'arena' vẽ lên khung của Sân đấu; rời sân thì trả về khung chánh điện
    yard: {
      show(canvas) { Hall.attach(canvas); Hall.setScene('arena'); Hall.pause(false); },
      hide() { Hall.attach($('#hall')); Hall.setScene(curScene); Hall.pause(Places.current === 'dojo'); }
    },
    hallPlayer: id => Hall.player(id)
  };
  Meditate.init({
    socket, el: $('#medi'), toast, serverNow,
    cfg: () => cfg || { martial: { enabled: false } },
    login: () => changeAuth(true),
    stand: () => { socket.emit('stand'); Hall.setSit(me, -1); Meditate.close(); },
    dojo: () => act('dojo')
  });
  for (const [name, mod, el] of [['dojo', window.Dojo, $('#place-dojo')], ['arena', window.Arena, $('#place-arena')]]) {
    if (!mod) continue;
    mod.init(martialHost);
    Places.register(name, { el, mod });
  }

  /* ---------- hào quang cúng dường ---------- */
  let myAura = null;
  const mmss2 = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + pad(s % 60); };
  function renderAura() {
    const a = myAura, t = serverNow(), card = $('#auraCard');
    if (!a || a.until <= t) { card.hidden = true; return; }
    card.hidden = false;
    const tier = a.t ? AURA.TIERS[a.t - 1] : null, next = AURA.toNext(a.amount);
    $('#auraName').textContent = tier ? `Cảnh giới ${tier.name}` : 'Đang tích tụ linh khí';
    $('#auraName').style.color = tier ? tier.color : '';
    $('#auraLeft').textContent = `còn ${mmss2(a.until - t)}`;
    $('#auraNext').textContent = `Đang cộng dồn ${VND(a.amount)}.` + (next ? ` Thêm ${VND(next.need)} trong lúc hào quang còn sáng để lên ${next.tier.name}.` : ' Đã đạt cảnh giới cao nhất.');
  }
  setInterval(renderAura, 1000);
  (function buildAuraGrid() {
    const grid = $('#auraGrid'), dpr = Math.min(2, window.devicePixelRatio || 1);   // vẽ theo độ nét màn hình
    AURA.TIERS.forEach(t => {
      const it = document.createElement('div'); it.className = 'aura-item';
      const cv = document.createElement('canvas'); cv.width = Math.round(150 * dpr); cv.height = Math.round(190 * dpr); cv.setAttribute('aria-hidden', 'true');
      const b = document.createElement('b'); b.textContent = `${t.n}. ${t.name}`; b.style.color = t.color;
      const m = document.createElement('span'); m.className = 'aura-min'; m.textContent = `từ ${VND(t.min)} · sáng ${Math.round(t.ms / 60000)} phút`;
      const d = document.createElement('small'); d.textContent = t.desc;
      it.append(cv, b, m, d); grid.appendChild(it);
    });
  })();
  function auraLoop(ts) {
    if (!$('#dlg-aura').open) return;
    $$('#auraGrid canvas').forEach((cv, i) => Hall.auraPreview(cv, look, i + 1, ts / 1000));
    requestAnimationFrame(auraLoop);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open="aura"]'); if (!b) return;
    e.preventDefault(); openDlg('aura'); requestAnimationFrame(auraLoop);
  });

  /* ---------- pháp tướng công đức & quỷ ---------- */
  let myTotal = 0;
  function renderRank() {
    const box = $('#rankNow'); if (!box) return;
    const mt = myTotal, rk = mt === 666 ? 0 : MERIT.rankOf(mt), dm = MERIT.visualDemonOf(mt), nx = MERIT.nextRank(mt);
    box.className = 'rank-now' + (dm ? ' bad' : '');
    if (mt === 666) box.textContent = 'Ma Vương xuất hiện ở đúng 666 công đức và ban buff quỷ cấp 4 trong phòng PK có buff. Khi công đức thay đổi, pháp tướng sẽ trở lại.';
    else if (dm) box.textContent = `${MERIT.DEMONS[dm.n - 1].name} đang theo sau bạn (công đức ${NUM(mt)}). Làm việc thiện để công đức về trên 0 thì quỷ tan.`;
    else box.textContent = (rk ? `Pháp tướng: ${MERIT.RANKS[rk - 1].name}.` : 'Chưa có pháp tướng.') + (nx ? ` Thêm ${NUM(nx.need)} công đức để mở ${nx.rank.name}.` : ' Đã đạt pháp tướng cao nhất.');
  }
  (function buildRules() {
    const E = MERIT.EARN, earn = [['Thắp nhang', E.incense], ['Cùng tụng kinh đến hết bài', E.chantJoin], ['Dâng hoa, đèn, mâm quả', E.offer], ['Khởi tụng một khóa kinh', E.chantStart], ['Thỉnh chuông', E.bell], ['Vái lạy', E.bow], ['Gõ mõ, thả tim, tùy hỷ lời nguyện', 1]];
    $('#ruEarn').innerHTML = earn.map(([k, v]) => `<li><span>${k}</span><b>+${v}</b></li>`).join('') + `<li><span>Cúng dường tịnh tài (khi nhà chùa xác nhận)</span><b>+1 / ${NUM(E.perVnd)}đ</b></li>`;
    const mk = (box, items, draw) => items.forEach(x => {
      const it = document.createElement('div'); it.className = 'aura-item';
      const cv = document.createElement('canvas'); cv.width = 150; cv.height = 190; cv.setAttribute('aria-hidden', 'true'); cv.dataset.draw = draw(x);
      const b = document.createElement('b'); b.textContent = `${x.n}. ${x.name}`; if (x.color) b.style.color = x.color;
      const m = document.createElement('span'); m.className = 'aura-min'; m.textContent = x.min ? `từ ${NUM(x.min)} công đức${x.spin ? ' · xoay' : ''}` : x.n === 1 ? 'công đức dưới 0' : `từ ${NUM(x.at)}`;
      const d = document.createElement('small'); d.textContent = x.desc;
      it.append(cv, b, m, d); box.appendChild(it);
    });
    mk($('#ruRanks'), MERIT.RANKS, x => 'r' + x.n);
    mk($('#ruDemons'), MERIT.DEMONS, x => 'd' + x.n);
  })();
  function rulesLoop(ts) {
    if (!$('#dlg-rules').open) return;
    $$('#dlg-rules canvas').forEach(cv => {
      const r = cv.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;            // chỉ vẽ hình đang thấy
      const k = cv.dataset.draw;
      Hall.meritPreview(cv, look, k[0] === 'r' ? +k.slice(1) : 0, k[0] === 'd' ? +k.slice(1) : 0, ts / 1000);
    });
    requestAnimationFrame(rulesLoop);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open="rules"]'); if (!b) return;
    e.preventDefault();
    if (cfg && cfg.penaltyRules) {
      const box = $('#ruPen'); box.textContent = '';
      cfg.penaltyRules.forEach(r => {
        const row = document.createElement('div'); row.className = 'pen-row lv' + r.lv;
        const n = document.createElement('b'); n.textContent = `Mức ${r.lv} · ${r.name}`;
        const v = document.createElement('span'); v.className = 'pen-pts'; v.textContent = `−${r.pts}`;
        const d = document.createElement('small'); d.textContent = `${r.note}. Ví dụ: ${r.ex.join(', ')}…`;
        row.append(n, v, d); box.appendChild(row);
      });
    }
    openDlg('rules'); requestAnimationFrame(rulesLoop);
  });

  /* ---------- đọc thông báo cúng dường ---------- */
  // Giọng VieNeu do máy chủ đọc sẵn; chưa có thì trình duyệt tự đọc bằng giọng tiếng Việt có sẵn.
  const annQ = [];
  let annBusy = false;
  function announceQ(d) { annQ.push(d); if (annQ.length > 6) annQ.shift(); if (!annBusy) nextAnnounce(); }
  function viVoice() {
    if (!window.speechSynthesis) return null;
    const vs = speechSynthesis.getVoices().filter(v => /^vi/i.test(v.lang));
    return vs.find(v => /hoaimy|hoài my|linh|female|nữ|google/i.test(v.name)) || vs[0] || null;
  }
  function nextAnnounce() {
    const d = annQ.shift();
    if (!d) { annBusy = false; $('#announce').hidden = true; return; }
    annBusy = true;
    const box = $('#announce');
    $('#announceText').textContent = d.text;
    box.classList.toggle('up', !!d.tier);
    box.hidden = false; box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    let done = false, audio = null, utterance = null;
    const end = () => {
      if (done) return;
      done = true;
      clearTimeout(fallbackT);
      if (audio) audio.pause();
      if (utterance) speechSynthesis.cancel();
      SFX.setAmbienceDuck('announce', false);
      setTimeout(nextAnnounce, 1200);
    };
    const fallbackT = setTimeout(end, 16000);
    if (muted || !SFX.ready) { setTimeout(end, 7000); return; }
    const duck = () => { if (!done) SFX.setAmbienceDuck('announce', true); };
    const speak = () => {
      if (done) return;
      const v = viVoice();
      if (!v || muted) { setTimeout(end, 6000); return; }
      const u = new SpeechSynthesisUtterance(d.speak || d.text);
      u.voice = v; u.lang = v.lang; u.rate = 0.95; u.pitch = 1.05;
      u.onstart = duck;
      u.onend = u.onerror = () => { utterance = null; end(); };
      speechSynthesis.cancel();
      utterance = u;
      speechSynthesis.speak(u);
    };
    SFX.bell(0.5);
    setTimeout(() => {
      if (done || muted) { end(); return; }
      if (!d.audio) { speak(); return; }
      const clip = audio = new Audio(d.audio);
      clip.onplaying = duck;
      clip.onended = end;
      const fallback = () => {
        if (done || audio !== clip) return;
        clip.pause();
        audio = null;
        SFX.setAmbienceDuck('announce', false);
        speak();
      };
      clip.onerror = fallback;
      clip.play().catch(fallback);
    }, 1500);
  }
  if (window.speechSynthesis) speechSynthesis.getVoices();

  /* ---------- khởi động ---------- */
  renderSound();
  fillJoin();
  openDlg('join');
  if (myName) setTimeout(() => $('#jName').select(), 50);
  const url = new URL(location.href);
  const authResult = url.searchParams.get('auth');
  if (authResult) {
    url.searchParams.delete('auth');
    history.replaceState(history.state, '', url);
    if (authResult === 'error') showAuthError('Chưa đăng nhập được bằng Google. Bạn thử lại nhé.');
  }
  fetch('/api/auth/session').then(r => r.json()).then(auth => {
    if (!authKnown) renderAuth(auth);
    if (authResult === 'ok' && auth.signedIn) toast('Đã đăng nhập Google. Mời bạn vào chánh điện.');
  }).catch(() => {});
})();
