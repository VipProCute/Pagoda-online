/*
 * Máy chủ giả cho Võ Học Các: trả lời đúng hợp đồng docs/VO-HOC-GIAO-THUC.md mục 3 bằng FakeSocket.
 * Kịch bản chọn bằng ?s=idle|active|speedup|login|done|max|ending|vouchers|disabled|limit|newbie|bank
 * Tham số khác: skew=<ms> (lệch giờ máy chủ), lat=<ms> (độ trễ ack), pk=0 (tắt sân đấu), hall=1 (bắt đầu ở chánh điện).
 */
(function (root) {
  'use strict';
  const M = root.MARTIAL;
  const Q = new URLSearchParams(location.search);
  const skew = Number(Q.get('skew')) || 0;
  const now = () => Date.now() + skew;
  const HOUR = 3600e3;

  const sim = {
    enabled: true, login: { required: false, signedIn: true }, nextId: 100, seq: 0,
    profile: { congLuc: 180, tam: { cuong: 45, toc: 10, nhu: 0 }, learned: M.STARTERS.slice(), loadout: ['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'nhu-van-bo'], wins: 3, losses: 1, draws: 0, vouchers: [] },
    session: null, recent: [], donations: {}, speedup: { enabled: true, perDay: 2, usedToday: 0 },
    failNext: {}, log: []
  };

  function levelInfo() { return M.levelInfo(sim.profile.congLuc); }
  function view() {
    const p = sim.profile, li = levelInfo();
    return {
      congLuc: p.congLuc, level: li.level, levelFrom: li.from, levelTo: li.to, pct: li.pct, manaMax: li.manaMax,
      tam: Object.assign({}, p.tam), learned: p.learned.slice(), loadout: p.loadout.slice(), wins: p.wins, losses: p.losses, draws: p.draws,
      vouchers: p.vouchers.map(v => ({ id: v.id, value: v.value, createdAt: v.createdAt }))
    };
  }
  function sessionView() {
    const s = sim.session;
    if (!s) return null;
    const d = s.code && sim.donations[s.code];
    return { id: s.id, methodId: s.methodId, durationKey: s.durationKey, startedAt: s.startedAt, endsAt: s.endsAt, price: s.price, status: 'active',
      speedup: d && d.status === 'pending' ? { code: d.code, amount: d.amount, status: 'pending', bankReported: !!d.bank, createdAt: d.createdAt } : null };
  }
  function complete(via) {
    const s = sim.session;
    if (!s) return null;
    const p = sim.profile, before = M.levelOf(p.congLuc);
    const reward = M.clampReward(p, M.rewardOf(s.methodId, s.durationKey));
    p.congLuc += reward.congLuc;
    for (const b of M.BRANCH_ORDER) p.tam[b] += reward.tam[b];
    const level = M.levelOf(p.congLuc), m = M.METHODS[s.methodId];
    sim.recent.unshift({ id: s.id, methodId: s.methodId, durationKey: s.durationKey, status: 'completed', via, completedAt: now(), reward, seen: false });
    sim.recent = sim.recent.slice(0, 8);
    sim.session = null;
    const lead = via === 'speedup' ? 'Tịnh tài đã được xác nhận. ' : via === 'voucher' ? 'Đã dùng phiếu hoàn thành ngay. ' : '';
    const text = `${lead}Phiên tu ${m.name} đã viên mãn: công lực +${reward.congLuc}.` + (level > before ? ` Nội công lên cấp ${level}!` : '');
    return { kind: 'completed', sessionId: s.id, methodId: s.methodId, durationKey: s.durationKey, via, reward, levelUp: level > before, level, text };
  }
  function due() { const s = sim.session; if (s && s.endsAt <= now()) return complete('time'); return null; }
  const push = u => { if (u) root.setTimeout(() => sock.receive('tu:update', u), 0); };
  const fail = (reason, code) => ({ ok: false, reason, code });
  function gate(ev) {
    if (sim.failNext[ev]) { const f = sim.failNext[ev]; delete sim.failNext[ev]; return f; }
    if (!sim.login.signedIn && sim.login.required) return fail('Cần đăng nhập Google để tu luyện và lưu tiến độ.', 'login');
    return null;
  }

  const handlers = {
    'place:set': d => ({ ok: true, place: d && d.place }),
    'martial:state': () => {
      sim.log.push('martial:state');
      if (!sim.enabled) return { ok: true, enabled: false };
      const up = due(); push(up);
      const guest = sim.login.required && !sim.login.signedIn;
      const base = { ok: true, enabled: true, serverTime: now(), login: { required: sim.login.required, signedIn: sim.login.signedIn } };
      if (guest) {
        const li = M.levelInfo(0);
        return Object.assign(base, { profile: { congLuc: 0, level: 1, levelFrom: li.from, levelTo: li.to, pct: 0, manaMax: li.manaMax, tam: { cuong: 0, toc: 0, nhu: 0 }, learned: M.STARTERS.slice(), loadout: [], wins: 0, losses: 0, draws: 0, vouchers: [] }, session: null, recent: [], speedup: { enabled: false, perDay: 2, usedToday: 0 } });
      }
      return Object.assign(base, { profile: view(), session: sessionView(), recent: sim.recent.map(r => Object.assign({}, r)), speedup: Object.assign({}, sim.speedup) });
    },
    'tu:start': d => {
      const g = gate('tu:start'); if (g) return g;
      push(due());
      const m = M.METHODS[d && d.methodId], dur = m && m.durations.find(x => x.key === d.duration);
      if (!m) return fail('Không có công pháp này.', 'method');
      if (!dur) return fail('Thời gian tu không hợp lệ.', 'duration');
      if (sim.session) return fail('Bạn đang có một phiên tu chưa xong. Hoàn thành hoặc hủy phiên đó trước nhé.', 'busy');
      const can = M.canCultivate(sim.profile, m.id);
      if (!can.ok) return fail(can.reason, 'level');
      const t = now();
      sim.session = { id: sim.nextId++, methodId: m.id, durationKey: dur.key, startedAt: t, endsAt: t + dur.minutes * 60000, price: m.price };
      return { ok: true, session: sessionView() };
    },
    'tu:cancel': d => {
      const g = gate('tu:cancel'); if (g) return g;
      const s = sim.session;
      if (!s || String(s.id) !== String(d.sessionId)) return fail('Không thấy phiên tu này.', 'nosession');
      const m = M.METHODS[s.methodId];
      sim.recent.unshift({ id: s.id, methodId: s.methodId, durationKey: s.durationKey, status: 'cancelled', via: null, completedAt: now(), reward: { congLuc: 0, tam: { cuong: 0, toc: 0, nhu: 0 } }, seen: true });
      sim.session = null;
      push({ kind: 'cancelled', sessionId: s.id, methodId: s.methodId, durationKey: s.durationKey, text: `Đã hủy phiên tu ${m.name}. Tiến độ phiên này không được tính.` });
      return { ok: true };
    },
    'tu:speedup': d => {
      const g = gate('tu:speedup'); if (g) return g;
      const s = sim.session;
      if (!sim.speedup.enabled) return fail('Nhà chùa chưa mở hoàn thành ngay.', 'disabled');
      if (!s || String(s.id) !== String(d.sessionId)) return fail('Không thấy phiên tu này.', 'nosession');
      let don = s.code && sim.donations[s.code], existing = true;
      if (!don || don.status !== 'pending') {
        if (sim.speedup.usedToday >= sim.speedup.perDay) return fail(`Hôm nay bạn đã dùng đủ ${sim.speedup.perDay} lượt hoàn thành ngay. Mai hãy thử lại, hoặc đợi phiên tu tự viên mãn nhé.`, 'limit');
        existing = false;
        don = { code: 'TA' + (7400 + sim.seq++) + 'K', amount: s.price, anon: !!d.anon, status: 'pending', createdAt: now(), bank: false };
        sim.donations[don.code] = don; s.code = don.code;
      }
      const m = M.METHODS[s.methodId];
      return {
        ok: true, existing, code: don.code, amount: don.amount, fund: 'Quỹ Tu Học',
        qr: `https://img.vietqr.io/image/MB-0123456789-compact2.png?amount=${don.amount}&addInfo=${don.code}`,
        bank: 'MB Bank (Ngân hàng Quân đội)', account: '0123456789', accountName: 'CHUA TAM AN', auto: true, methodName: m.name, durationKey: s.durationKey, endsAt: s.endsAt
      };
    },
    'tu:speedup:cancel': d => {
      const g = gate('tu:speedup:cancel'); if (g) return g;
      const don = sim.donations[d.code];
      if (!don) return fail('Không thấy yêu cầu này.', 'nodonation');
      if (don.status !== 'pending') return fail('Yêu cầu này không còn chờ xác nhận.', 'state');
      if (don.bank) return fail('Ngân hàng đã báo nhận tiền, đang chờ Ban điều hành xác nhận nên không hủy được.', 'paid');
      don.status = 'cancelled';
      if (sim.session && sim.session.code === d.code) delete sim.session.code;
      return { ok: true };
    },
    'tu:voucher': d => {
      const g = gate('tu:voucher'); if (g) return g;
      const v = sim.profile.vouchers.find(x => String(x.id) === String(d.voucherId)), s = sim.session;
      if (!v) return fail('Không thấy phiếu này.', 'voucher');
      if (!s || String(s.id) !== String(d.sessionId)) return fail('Không thấy phiên tu này.', 'nosession');
      if (v.value < s.price) return fail(`Phiếu này trị giá ${v.value.toLocaleString('vi-VN')}đ, chưa đủ cho phiên tu cần ${s.price.toLocaleString('vi-VN')}đ.`, 'value');
      sim.profile.vouchers = sim.profile.vouchers.filter(x => x !== v);
      push(complete('voucher'));
      return { ok: true };
    },
    'martial:seen': d => { (d.ids || []).forEach(id => { const r = sim.recent.find(x => String(x.id) === String(id)); if (r) r.seen = true; }); return { ok: true }; },
    'vo:learn': d => {
      const g = gate('vo:learn'); if (g) return g;
      const can = M.canLearn(sim.profile, d.skillId);
      if (!can.ok) return fail(can.reason, can.learned ? 'learned' : 'req');
      sim.profile.learned.push(d.skillId);
      return { ok: true, profile: view() };
    },
    'vo:loadout': d => {
      const g = gate('vo:loadout'); if (g) return g;
      const v = M.validateLoadout(d.skills, sim.profile.learned);
      if (!v.ok) return fail(v.reason, 'loadout');
      sim.profile.loadout = d.skills.slice();
      return { ok: true, loadout: d.skills.slice(), warnings: M.loadoutWarnings(d.skills) };
    }
  };

  const sock = new root.FakeSocket(handlers);
  sock.latency = Number(Q.get('lat')) || 30;
  const toasts = [];

  /* Thao tác của "Ban điều hành" / ngân hàng để thử các nhánh còn lại */
  const ctl = {
    bankReport() { const d = sim.donations[sim.session.code]; d.bank = true; },
    confirm() { const d = sim.donations[sim.session.code]; d.status = 'confirmed'; sim.speedup.usedToday++; push(complete('speedup')); },
    reject() {
      const s = sim.session, d = sim.donations[s.code]; d.status = 'cancelled'; delete s.code;
      push({ kind: 'speedup-rejected', sessionId: s.id, methodId: s.methodId, durationKey: s.durationKey, text: 'Yêu cầu hoàn thành ngay không được xác nhận. Nếu bạn đã chuyển khoản, xin liên hệ nhà chùa.' });
    },
    timeUp() { if (sim.session) sim.session.endsAt = now() - 1; },
    setEnds(ms) { sim.session.endsAt = now() + ms; },
    voucher(value) { sim.profile.vouchers.push({ id: sim.nextId++, value, createdAt: now() }); },
    drop() { sock.connected = false; sock.receive('disconnect', 'transport close'); },
    rise() { sock.connected = true; sock.receive('connect'); },
    fail(ev, f) { sim.failNext[ev] = f; }
  };

  /* ----- kịch bản ----- */
  const P = sim.profile;
  const start = (methodId, key, passedMs) => {
    const m = M.METHODS[methodId], d = m.durations.find(x => x.key === key), t = now();
    sim.session = { id: sim.nextId++, methodId, durationKey: key, startedAt: t - passedMs, endsAt: t - passedMs + d.minutes * 60000, price: m.price };
  };
  const SC = {
    idle() { /* mặc định */ },
    active() { start('kim-cuong-tam-phap', '4h', 39 * 60e3); },
    speedup() {
      start('kim-cuong-tam-phap', '4h', 39 * 60e3);
      const don = { code: 'TA7391K', amount: 20000, status: 'pending', createdAt: now() - 5 * 60e3, bank: false };
      sim.donations[don.code] = don; sim.session.code = don.code;
    },
    bank() { SC.speedup(); sim.donations.TA7391K.bank = true; },
    login() { sim.login = { required: true, signedIn: false }; },
    done() {
      P.congLuc = 305; P.tam = { cuong: 95, toc: 10, nhu: 0 };
      sim.recent = [
        { id: 90, methodId: 'kim-cuong-tam-phap', durationKey: '4h', status: 'completed', via: 'time', completedAt: now() - 60e3, reward: { congLuc: 50, tam: { cuong: 50, toc: 0, nhu: 0 } }, seen: false },
        { id: 89, methodId: 'tinh-tam-quyet', durationKey: '1h', status: 'completed', via: 'speedup', completedAt: now() - 5 * HOUR, reward: { congLuc: 15, tam: { cuong: 0, toc: 0, nhu: 0 } }, seen: true }
      ];
    },
    max() {
      P.congLuc = 3000; P.tam = { cuong: 300, toc: 300, nhu: 300 }; P.learned = M.SKILL_ORDER.slice(); P.wins = 42; P.losses = 17; P.draws = 5;
      P.loadout = ['tu-luc-pha-son', 'kim-chung-trao', 'tu-lang-bat-thien-can', 'khinh-than-bo'];
    },
    ending() { start('tinh-tam-quyet', '15m', 15 * 60e3 - 3000); },
    vouchers() { start('kim-cuong-tam-phap', '4h', 39 * 60e3); P.vouchers = [{ id: 7, value: 20000, createdAt: now() - HOUR }, { id: 8, value: 10000, createdAt: now() - 2 * HOUR }]; },
    disabled() { sim.enabled = false; },
    limit() { start('kim-cuong-tam-phap', '4h', 39 * 60e3); sim.speedup.usedToday = 2; },
    newbie() { P.congLuc = 0; P.tam = { cuong: 0, toc: 0, nhu: 0 }; P.loadout = []; P.wins = P.losses = P.draws = 0; },
    nospeed() { start('kim-cuong-tam-phap', '4h', 39 * 60e3); sim.speedup.enabled = false; }
  };
  (SC[Q.get('s') || 'idle'] || SC.idle)();

  /* ----- host giống app.js ----- */
  const log = { goto: [], login: 0 };
  const host = {
    socket: sock,
    toast(t) { toasts.push(t); const e = document.getElementById('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(host._t); host._t = setTimeout(() => e.classList.remove('show'), 3000); },
    serverNow: () => Date.now() + skew,
    goto(name) { log.goto.push(name); return root.Places.go(name); },
    cfg: () => ({ martial: { enabled: sim.enabled, pk: Q.get('pk') !== '0', speedup: sim.speedup.enabled, loginRequired: sim.login.required } }),
    auth: () => ({ enabled: sim.login.required, signedIn: sim.login.signedIn }),
    login() { log.login++; },
    me: () => ({ pid: 'p1', name: 'Diệu Liên', look: {} }),
    meritTotal: () => 1234,
    vnd: n => Number(n).toLocaleString('vi-VN') + 'đ'
  };

  root.H = { sim, sock, host, ctl, toasts, log };
})(window);
