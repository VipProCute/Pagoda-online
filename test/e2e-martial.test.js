'use strict';
/*
 * Kiểm thử đầu-cuối: chạy server.js thật, nối bằng socket.io-client.
 * Phủ: các "nơi" tách biệt, tu luyện offline, học chiêu, trận so chiêu đủ lượt (không lộ chiêu trước khi lật),
 * mời / từ chối / hết hạn, phòng có buff, cúng dường hoàn thành ngay (xác nhận trùng, trễ, hủy, từ chối, phiếu),
 * quản trị (khóa thử mã, nhật ký, sao lưu) và lưu bền sau khi khởi động lại.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, sleep } = require('./helpers/live');
const { connect, call, join, waitFor } = require('./helpers/client');

const BANK = { BANK_ID: '970436', BANK_ACCOUNT: '0123456789', BANK_ACCOUNT_NAME: 'CHUA THU' };
const STARTERS_A = ['trong-quyen', 'thiet-bich', 'tat-phong-quyen', 'lieu-diep-chuong'];
const STARTERS_B = ['tat-phong-quyen', 'anh-bo-ho-than', 'nhu-van-bo', 'lieu-diep-chuong'];

const open = [];
async function enter(srv, name, uid) {
  const socket = await connect(srv.port);
  open.push(socket);
  const r = await join(socket, name, uid);
  assert.ok(r && r.ok, 'vào chánh điện: ' + (r && r.reason));
  return { socket, pid: r.you, uid, name, join: r };
}
const toArena = c => call(c.socket, 'place:set', { place: 'arena' });
test.after(() => { for (const s of open) s.close(); });

/* ---------------------------------------------------------------------------------------------- */
test('các nơi tách biệt: đánh nhau chỉ ở Sân đấu, chánh điện không bị ảnh hưởng', async t => {
  const srv = await startServer({ PK_TIME_SCALE: '0.05' });
  t.after(() => srv.stop());
  const hall = await enter(srv, 'Khach Viengchua', 'uid-hall-0001');
  const a = await enter(srv, 'Minh Tam', 'uid-arena-a001');
  const b = await enter(srv, 'Thien Hoa', 'uid-arena-b001');

  // người ở chánh điện không mời, không bị mời, không thấy gì của sân đấu
  const bad = await call(hall.socket, 'pk:invite', { toPid: a.pid, mode: 'balanced' });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'place');
  assert.equal((await call(hall.socket, 'place:set', { place: 'khong-co' })).ok, false);

  const seen = waitFor(hall.socket, 'pplace', d => d.id === a.pid && d.place === 'arena');
  const ra = await toArena(a);
  assert.ok(ra.ok && ra.arena && Array.isArray(ra.arena.players));
  assert.equal((await seen).place, 'arena');
  const rb = await toArena(b);
  assert.ok(rb.arena.players.some(p => p.pid === a.pid), 'B thấy A ở sân');
  assert.ok(!rb.arena.players.some(p => p.pid === hall.pid), 'người ở chánh điện không có trong sân');

  const toHall = await call(a.socket, 'pk:invite', { toPid: hall.pid, mode: 'balanced' });
  assert.equal(toHall.ok, false, 'không mời được người ở chánh điện');

  // A mời B, B từ chối
  const got = waitFor(b.socket, 'pk:invited');
  const inv = await call(a.socket, 'pk:invite', { toPid: b.pid, mode: 'balanced' });
  assert.ok(inv.ok, inv.reason);
  const iv = await got;
  assert.equal(iv.mode, 'balanced');
  assert.ok(iv.buffs && iv.buffs.you && iv.buffs.op);
  assert.equal(iv.from.pid, a.pid);
  const closed = waitFor(a.socket, 'pk:invite:closed');
  assert.ok((await call(b.socket, 'pk:respond', { inviteId: iv.inviteId, accept: false })).ok);
  assert.equal((await closed).reason, 'declined');
  // bị từ chối thì chưa mời lại ngay được
  const again = await call(a.socket, 'pk:invite', { toPid: b.pid, mode: 'balanced' });
  assert.equal(again.ok, false);

  // cùng tài khoản mở hai tab không tự mời mình
  const a2 = await enter(srv, 'Minh Tam Hai', 'uid-arena-a001');
  await toArena(a2);
  const self = await call(a.socket, 'pk:invite', { toPid: a2.pid, mode: 'balanced' });
  assert.equal(self.ok, false, 'không tự mời chính mình');

  // chánh điện không nhận bất kỳ gói pk:* hay arena:* nào
  const leaked = hall.socket.log.filter(x => /^(pk:|arena:)/.test(x.ev));
  assert.equal(leaked.length, 0, 'chánh điện không được nhận sự kiện của sân đấu: ' + JSON.stringify(leaked.map(x => x.ev)));
});

/* ---------------------------------------------------------------------------------------------- */
test('tu luyện offline, lên cấp, học chiêu, bộ chiêu, và còn nguyên sau khi khởi động lại', async t => {
  const srv = await startServer({ CULTIVATION_TIME_SCALE: '0.0001' });
  t.after(() => srv.stop());
  let c = await enter(srv, 'Dieu Lien', 'uid-tu-luyen-1');

  const st0 = await call(c.socket, 'martial:state', {});
  assert.ok(st0.ok && st0.enabled);
  assert.equal(st0.profile.level, 1);
  assert.equal(st0.profile.learned.length, 6);
  assert.equal(st0.session, null);

  // công pháp cao cấp chưa mở, thời lượng sai bị từ chối
  assert.equal((await call(c.socket, 'tu:start', { methodId: 'vo-cuc-chan-kinh', duration: '8h' })).ok, false);
  assert.equal((await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '99h' })).ok, false);

  const done = waitFor(c.socket, 'tu:update', u => u.kind === 'completed');
  const s1 = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '15m', skillId: 'trong-quyen' });
  assert.ok(s1.ok, s1.reason);
  assert.equal(s1.session.skillId, 'trong-quyen');
  const busy = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '15m' });
  assert.equal(busy.ok, false, 'không tu hai phiên cùng lúc');
  const u1 = await done;
  assert.equal(u1.via, 'time');
  assert.equal(u1.reward.congLuc, 5);
  assert.equal(u1.practice.xp, 2);

  let st = await call(c.socket, 'martial:state', {});
  assert.equal(st.profile.congLuc, 5);
  assert.equal(st.profile.mastery['trong-quyen'], 2);
  assert.equal(st.session, null);
  assert.equal(st.recent[0].seen, false);
  assert.ok((await call(c.socket, 'martial:seen', { ids: [st.recent[0].id] })).ok);

  async function train(methodId, duration, times) {
    for (let i = 0; i < times; i++) {
      const r = await call(c.socket, 'tu:start', { methodId, duration });
      assert.ok(r.ok, r.reason);
      const u = await waitFor(c.socket, 'tu:update', x => x.kind === 'completed' && x.sessionId === r.session.id, 10000, true);
      assert.ok(u.reward.congLuc > 0);
    }
  }
  assert.equal((await call(c.socket, 'vo:learn', { skillId: 'kim-chung-trao' })).ok, false, 'chưa đủ cấp thì chưa học được');
  await train('tinh-tam-quyet', '4h', 2);                    // 5 + 90 = 95 công lực: cấp 2
  await train('kim-cuong-tam-phap', '4h', 2);                // + 100 = 195: cấp 3, tâm đắc Cương 100
  st = await call(c.socket, 'martial:state', {});
  assert.equal(st.profile.congLuc, 195);
  assert.equal(st.profile.level, 3);
  assert.equal(st.profile.tam.cuong, 100);

  const learn = await call(c.socket, 'vo:learn', { skillId: 'kim-chung-trao' });
  assert.ok(learn.ok, learn.reason);
  assert.equal((await call(c.socket, 'vo:learn', { skillId: 'kim-chung-trao' })).ok, false, 'học trùng bị từ chối');
  assert.equal((await call(c.socket, 'vo:learn', { skillId: 'tu-luc-pha-son' })).ok, false, 'chiêu cao cấp chưa đủ điều kiện');
  assert.equal((await call(c.socket, 'vo:learn', { skillId: 'khong-co-chieu-nay' })).ok, false);

  // bộ chiêu: chưa học / trùng / thiếu bị từ chối; toàn thủ chỉ cảnh báo
  assert.equal((await call(c.socket, 'vo:loadout', { skills: ['tu-luc-pha-son', 'thiet-bich', 'trong-quyen', 'nhu-van-bo'] })).ok, false);
  assert.equal((await call(c.socket, 'vo:loadout', { skills: ['thiet-bich', 'thiet-bich', 'trong-quyen', 'nhu-van-bo'] })).ok, false);
  assert.equal((await call(c.socket, 'vo:loadout', { skills: ['thiet-bich', 'trong-quyen'] })).ok, false);
  const lo = await call(c.socket, 'vo:loadout', { skills: ['thiet-bich', 'anh-bo-ho-than', 'kim-chung-trao', 'nhu-van-bo'] });
  assert.ok(lo.ok, lo.reason);
  assert.ok(lo.warnings.some(w => w.code === 'no-attack'), 'bộ không có đòn công có cảnh báo nhưng vẫn lưu được');

  // tu rồi hủy: không được gì
  const s3 = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '4h' });
  assert.ok(s3.ok);
  assert.ok((await call(c.socket, 'tu:cancel', { sessionId: s3.session.id })).ok);
  st = await call(c.socket, 'martial:state', {});
  assert.equal(st.profile.congLuc, 195);
  assert.equal(st.session, null);

  // khởi động lại: tiến độ còn nguyên (đóng web, máy chủ ghi trước khi tắt)
  c.socket.close();
  await srv.restart();
  c = await enter(srv, 'Dieu Lien', 'uid-tu-luyen-1');
  st = await call(c.socket, 'martial:state', {});
  assert.equal(st.profile.congLuc, 195);
  assert.ok(st.profile.learned.includes('kim-chung-trao'));
  assert.deepEqual(st.profile.loadout, ['thiet-bich', 'anh-bo-ho-than', 'kim-chung-trao', 'nhu-van-bo']);
  assert.equal(st.profile.mastery['trong-quyen'], 2, 'thuần thục lưu bền qua khởi động lại');
});

/* ---------------------------------------------------------------------------------------------- */
/** Điều khiển một người chơi tự đánh: mỗi pk:turn chọn ngẫu nhiên trong `legal` (nghiêng về chiêu thật). */
function autoplay(c, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  c.turns = []; c.reveals = [];
  c.socket.on('pk:turn', turn => {
    c.turns.push(turn);
    if (turn.forced) return;
    const real = turn.legal.filter(x => x !== 'dieu-tuc');
    const pool = real.length && rnd() < 0.85 ? real : turn.legal;
    const skillId = pool[Math.floor(rnd() * pool.length)];
    call(c.socket, 'pk:pick', { matchId: turn.matchId, turn: turn.turn, skillId }).catch(() => {});
  });
  c.socket.on('pk:reveal', r => c.reveals.push(r));
}
async function startMatch(A, B, mode, loA, loB) {
  const invited = waitFor(B.socket, 'pk:invited');
  const inv = await call(A.socket, 'pk:invite', { toPid: B.pid, mode });
  assert.ok(inv.ok, inv.reason);
  const iv = await invited;
  const lobbyA = waitFor(A.socket, 'pk:lobby'), lobbyB = waitFor(B.socket, 'pk:lobby');
  const r = await call(B.socket, 'pk:respond', { inviteId: iv.inviteId, accept: true });
  assert.ok(r.ok, r.reason);
  const [la, lb] = await Promise.all([lobbyA, lobbyB]);
  assert.equal(la.matchId, lb.matchId);
  return { la, lb, iv };
}

test('trận so chiêu đủ lượt: chọn kín, lật cùng lúc, hai phía thấy cùng một kết quả', async t => {
  const srv = await startServer({ PK_TIME_SCALE: '0.05' });
  t.after(() => srv.stop());
  const A = await enter(srv, 'Minh Tam', 'uid-tran-a0001');
  const B = await enter(srv, 'Thien Hoa', 'uid-tran-b0001');
  await toArena(A); await toArena(B);
  autoplay(A, 11); autoplay(B, 29);

  const { la, lb } = await startMatch(A, B, 'balanced', STARTERS_A, STARTERS_B);
  assert.ok(la.buffs && la.buffs.you && la.buffs.op);
  assert.equal(la.you.pid, A.pid);
  assert.equal(la.op.pid, B.pid);
  assert.ok(la.you.learned.length >= 6);
  // người ở sân đấu chuyển sang "đang đấu"
  assert.ok(A.socket.log.some(x => x.ev === 'arena:upd' && x.payload.st === 'busy'), 'trạng thái đang đấu được phát');

  // bộ chiêu sai bị từ chối, đúng thì khóa
  assert.equal((await call(A.socket, 'pk:loadout', { matchId: la.matchId, skills: ['tu-luc-pha-son', 'thiet-bich', 'trong-quyen', 'nhu-van-bo'] })).ok, false);
  assert.equal((await call(A.socket, 'pk:loadout', { matchId: 'khong-co', skills: STARTERS_A })).ok, false);
  const endA = waitFor(A.socket, 'pk:end', () => true, 60000), endB = waitFor(B.socket, 'pk:end', () => true, 60000);
  const ra = await call(A.socket, 'pk:loadout', { matchId: la.matchId, skills: STARTERS_A });
  assert.ok(ra.ok && ra.locked, ra.reason);
  assert.ok((await call(B.socket, 'pk:loadout', { matchId: lb.matchId, skills: STARTERS_B })).ok);

  const [ea, eb] = await Promise.all([endA, endB]);
  assert.equal(ea.matchId, la.matchId);
  assert.ok(['win', 'lose', 'draw'].includes(ea.result));
  assert.equal({ win: 'lose', lose: 'win', draw: 'draw' }[ea.result], eb.result, 'hai phía thấy kết quả đối xứng');
  assert.equal(ea.reason, eb.reason);
  assert.ok(ea.turns >= 1 && ea.turns <= 40);

  // lượt 1 công bố bộ chiêu hai bên
  assert.deepEqual(A.turns[0].loadouts.you, STARTERS_A);
  assert.deepEqual(A.turns[0].loadouts.op, STARTERS_B);
  assert.deepEqual(B.turns[0].loadouts.you, STARTERS_B);

  // mọi lượt: hai phía thấy đúng cùng một cặp chiêu và cùng tổng sát thương
  assert.equal(A.reveals.length, B.reveals.length);
  for (let i = 0; i < A.reveals.length; i++) {
    const ra2 = A.reveals[i], rb2 = B.reveals[i];
    assert.equal(ra2.turn, rb2.turn);
    assert.equal(ra2.picks.you.skill, rb2.picks.op.skill);
    assert.equal(ra2.picks.op.skill, rb2.picks.you.skill);
    const dmgTo = (rv, who) => rv.events.filter(e => (e.k === 'hit' && e.def === who) || (e.k === 'counter' && e.target === who)).reduce((n, e) => n + e.dmg, 0);
    assert.equal(dmgTo(ra2, 'you'), dmgTo(rb2, 'op'), 'sát thương A nhận khớp ở hai phía, lượt ' + ra2.turn);
    assert.equal(dmgTo(ra2, 'op'), dmgTo(rb2, 'you'));
    assert.equal(ra2.state.you.hp, rb2.state.op.hp);
  }

  // KHÔNG LỘ CHIÊU: từ lúc nhận pk:turn N tới lúc nhận pk:reveal N, chỉ được có pk:locked {matchId, turn}
  for (const [me, op] of [[A, B], [B, A]]) {
    for (const turn of me.turns) {
      const iT = me.socket.log.findIndex(x => x.ev === 'pk:turn' && x.payload.turn === turn.turn);
      const iR = me.socket.log.findIndex(x => x.ev === 'pk:reveal' && x.payload.turn === turn.turn);
      if (iT < 0 || iR < 0) continue;
      for (const x of me.socket.log.slice(iT + 1, iR).filter(y => /^(pk:|arena:)/.test(y.ev))) {
        assert.equal(x.ev, 'pk:locked', 'giữa pk:turn và pk:reveal chỉ được có pk:locked, thấy ' + x.ev);
        assert.deepEqual(Object.keys(x.payload).sort(), ['matchId', 'turn']);
      }
      // pk:turn không mang theo bất kỳ gợi ý nào về chiêu đối thủ ở lượt này
      const opReveal = op.reveals.find(r => r.turn === turn.turn);
      if (opReveal) assert.ok(!JSON.stringify(Object.keys(turn)).includes('pick'));
    }
  }

  // thắng / thua / hòa được ghi vào hồ sơ
  const sa = await call(A.socket, 'martial:state', {}), sb = await call(B.socket, 'martial:state', {});
  assert.equal(sa.profile.wins + sa.profile.losses + sa.profile.draws, 1);
  assert.equal(sb.profile.wins + sb.profile.losses + sb.profile.draws, 1);
  assert.equal(ea.record.wins, sa.profile.wins);

  // sân trở lại rảnh, mời được trận mới
  const lobby2 = await startMatch(A, B, 'balanced');
  assert.notEqual(lobby2.la.matchId, la.matchId);
  await call(A.socket, 'pk:forfeit', { matchId: lobby2.la.matchId });
});

test('vào lại giữa trận, bỏ cuộc, rời sân', async t => {
  const srv = await startServer({ PK_TIME_SCALE: '0.5' });     // lượt 10 giây: đủ thời gian vào lại
  t.after(() => srv.stop());
  const A = await enter(srv, 'Minh Tam', 'uid-vao-lai-a01');
  let B = await enter(srv, 'Thien Hoa', 'uid-vao-lai-b01');
  await toArena(A); await toArena(B);
  const { la, lb } = await startMatch(A, B, 'balanced');
  const turnB1 = waitFor(B.socket, 'pk:turn');
  await Promise.all([call(A.socket, 'pk:loadout', { matchId: la.matchId, skills: STARTERS_A }), call(B.socket, 'pk:loadout', { matchId: lb.matchId, skills: STARTERS_B })]);
  const t1 = await turnB1;
  assert.equal(t1.turn, 1);
  assert.ok(t1.legal.length >= 2);
  const pickB = t1.legal.find(x => x !== 'dieu-tuc');
  assert.ok((await call(B.socket, 'pk:pick', { matchId: lb.matchId, turn: 1, skillId: pickB })).ok);
  assert.equal((await call(B.socket, 'pk:pick', { matchId: lb.matchId, turn: 1, skillId: t1.legal[0] })).ok, false, 'đã khóa thì không đổi được');
  assert.equal((await call(B.socket, 'pk:pick', { matchId: lb.matchId, turn: 7, skillId: pickB })).ok, false, 'sai lượt');

  // B rớt mạng rồi vào lại bằng socket mới (pid mới): thấy đúng trận, đúng lựa chọn đã khóa của mình
  B.socket.close();
  await sleep(150);
  B = await enter(srv, 'Thien Hoa', 'uid-vao-lai-b01');
  const rejoin = await toArena(B);
  assert.ok(rejoin.ok);
  assert.equal(rejoin.arena.hasMatch, true);
  const res = await call(B.socket, 'pk:resume', {});
  assert.ok(res.ok && res.snapshot, 'có snapshot');
  assert.equal(res.snapshot.matchId, la.matchId);
  assert.equal(res.snapshot.phase, 'choosing');
  assert.equal(res.snapshot.myPick, pickB);
  assert.equal(res.snapshot.opLocked, false);
  assert.deepEqual(res.snapshot.loadouts.you, STARTERS_B);

  // A bỏ cuộc: B thắng
  const endB = waitFor(B.socket, 'pk:end', () => true, 10000);
  assert.ok((await call(A.socket, 'pk:forfeit', { matchId: la.matchId })).ok);
  const e = await endB;
  assert.equal(e.result, 'win');
  assert.equal(e.reason, 'forfeit');
  assert.equal(e.who, 'op');
  const after = await call(B.socket, 'pk:resume', {});
  assert.equal(after.snapshot, null);

  // rời sân giữa trận = bỏ cuộc (B mời để khỏi vướng thời gian chờ giữa hai lời mời của A)
  const lobby = await startMatch(B, A, 'balanced');
  await Promise.all([call(B.socket, 'pk:loadout', { matchId: lobby.la.matchId, skills: STARTERS_B }), call(A.socket, 'pk:loadout', { matchId: lobby.lb.matchId, skills: STARTERS_A })]);
  const endA = waitFor(A.socket, 'pk:end', () => true, 10000);
  assert.ok((await call(B.socket, 'place:set', { place: 'hall' })).ok);
  const e2 = await endA;
  assert.equal(e2.result, 'win');
  assert.equal(e2.who, 'op');
});

test('phòng có buff: bản xem trước và bản chụp đều có hào quang cúng dường', async t => {
  const srv = await startServer({ ...BANK, PK_TIME_SCALE: '0.05' });
  t.after(() => srv.stop());
  const A = await enter(srv, 'Minh Tam', 'uid-buff-a00001');
  const B = await enter(srv, 'Thien Hoa', 'uid-buff-b00001');

  // A cúng dường 20.000đ → hào quang Luyện Khí (cảnh giới 1)
  const don = await call(A.socket, 'donate', { amount: 20000, fund: 'q0' });
  assert.ok(don.ok, don.reason);
  const ok = waitFor(A.socket, 'donation:ok');
  assert.equal((await srv.admin(`/api/admin/donations/${don.code}/confirm`, 'POST')).status, 200);
  assert.ok((await ok).aura);

  await toArena(A); await toArena(B);
  const invited = waitFor(B.socket, 'pk:invited');
  assert.ok((await call(A.socket, 'pk:invite', { toPid: B.pid, mode: 'buff' })).ok);
  const iv = await invited;
  assert.equal(iv.mode, 'buff');
  assert.ok(iv.buffs, 'bản xem trước buff');
  assert.equal(iv.buffs.op.Ld, 1, 'người mời có hào quang cảnh giới 1');
  assert.ok(iv.buffs.op.defP > 0 && iv.buffs.op.offExt > 0 && iv.buffs.op.dodgeB > 0);
  assert.equal(iv.buffs.you.Ld, 0);
  assert.ok(iv.buffs.op.labels.length >= 1);
  const lobbyB = waitFor(B.socket, 'pk:lobby');
  assert.ok((await call(B.socket, 'pk:respond', { inviteId: iv.inviteId, accept: true })).ok);
  const lb = await lobbyB;
  assert.equal(lb.mode, 'buff');
  assert.equal(lb.buffs.op.Ld, 1);
  assert.equal(lb.buffs.you.Ld, 0);
  await call(A.socket, 'pk:forfeit', { matchId: lb.matchId });
});

/* ---------------------------------------------------------------------------------------------- */
test('cúng dường hoàn thành tu luyện ngay: chỉ khi Ban điều hành xác nhận, không cộng hai lần, tiền tới trễ thành phiếu', async t => {
  const srv = await startServer({ ...BANK, SEPAY_API_KEY: 'khoa-sepay-thu', SPEEDUP_PER_DAY: '3' });
  t.after(() => srv.stop());
  const c = await enter(srv, 'Dieu Lien', 'uid-speedup-0001');
  const sess = async () => (await call(c.socket, 'martial:state', {}));
  const sepay = (code, amount) => fetch(srv.url + '/api/webhooks/sepay', {
    method: 'POST', headers: { authorization: 'Apikey khoa-sepay-thu', 'content-type': 'application/json' },
    body: JSON.stringify({ transferType: 'in', transferAmount: amount, content: 'CHUYEN TIEN ' + code, referenceCode: 'FT' + code })
  }).then(r => r.json());

  // --- 1) yêu cầu → ngân hàng báo (chưa hoàn thành) → admin xác nhận (hoàn thành một lần) ---
  const s1 = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '15m' });
  assert.ok(s1.ok);
  const sp = await call(c.socket, 'tu:speedup', { sessionId: s1.session.id, anon: false });
  assert.ok(sp.ok, sp.reason);
  assert.equal(sp.amount, 10000);
  assert.equal(sp.existing, false);
  assert.ok(sp.qr.startsWith('https://img.vietqr.io/'));
  assert.match(sp.code, /^CD[A-Z0-9]{6}$/);
  const sp2 = await call(c.socket, 'tu:speedup', { sessionId: s1.session.id });
  assert.equal(sp2.existing, true);
  assert.equal(sp2.code, sp.code, 'gọi lại không tạo mã mới');

  const hook = await sepay(sp.code, 10000);
  assert.equal(hook.matched, true);
  assert.equal(hook.manual, true);
  let st = await sess();
  assert.equal(st.session.status, 'active', 'ngân hàng báo thì chưa hoàn thành');
  assert.equal(st.session.speedup.bankReported, true);
  assert.equal(st.profile.congLuc, 0);
  const sum = await srv.admin('/api/admin/summary');
  const row = sum.json.donations.find(d => d.code === sp.code);
  assert.equal(row.status, 'pending');
  assert.equal(row.purpose, 'speedup');
  assert.equal(row.speedup.bankReported, true);

  const gotDone = waitFor(c.socket, 'tu:update', u => u.kind === 'completed' && u.via === 'speedup');
  const gotOk = waitFor(c.socket, 'donation:ok');
  const [c1, c2] = await Promise.all([srv.admin(`/api/admin/donations/${sp.code}/confirm`, 'POST'), srv.admin(`/api/admin/donations/${sp.code}/confirm`, 'POST')]);
  assert.equal(c1.status, 200); assert.equal(c2.status, 200);
  assert.equal([c1, c2].filter(x => x.json.already).length, 1, 'hai lần bấm đồng thời: một lần làm, một lần "đã xác nhận"');
  const up = await gotDone;
  assert.equal(up.reward.congLuc, 5);
  const don = await gotOk;
  assert.equal(don.merit, 10, 'vẫn tính công đức như cúng dường thường (10.000đ = 10 điểm)');
  st = await sess();
  assert.equal(st.profile.congLuc, 5, 'cộng đúng một lần');
  assert.equal(st.session, null);
  assert.equal((await srv.admin(`/api/admin/donations/${sp.code}/confirm`, 'POST')).json.already, true);
  assert.equal((await sess()).profile.congLuc, 5, 'xác nhận lần ba vẫn không cộng thêm');

  // --- 2) tiền tới khi phiên đã hủy: không cộng, cấp phiếu; dùng phiếu cho phiên sau ---
  const s2 = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '15m' });
  const sp3 = await call(c.socket, 'tu:speedup', { sessionId: s2.session.id });
  assert.ok(sp3.ok);
  assert.ok((await call(c.socket, 'tu:cancel', { sessionId: s2.session.id })).ok);
  const late = waitFor(c.socket, 'tu:update', u => u.kind === 'speedup-late');
  assert.equal((await srv.admin(`/api/admin/donations/${sp3.code}/confirm`, 'POST')).json.outcome, 'late');
  const lu = await late;
  assert.ok(lu.voucher && lu.voucher.value === 10000);
  st = await sess();
  assert.equal(st.profile.congLuc, 5, 'phiên đã hủy thì không cộng thưởng');
  assert.equal(st.profile.vouchers.length, 1);
  const s3 = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '1h' });
  const v = await call(c.socket, 'tu:voucher', { voucherId: st.profile.vouchers[0].id, sessionId: s3.session.id });
  assert.ok(v.ok, v.reason);
  st = await sess();
  assert.equal(st.profile.congLuc, 20, '5 + 15 (phiên 1 giờ hoàn thành bằng phiếu)');
  assert.equal(st.profile.vouchers.length, 0);
  assert.equal((await call(c.socket, 'tu:voucher', { voucherId: lu.voucher.id, sessionId: s3.session.id })).ok, false, 'phiếu dùng một lần');

  // --- 3) admin từ chối: phiên tiếp tục chạy ---
  const s4 = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '4h' });
  assert.ok(s4.ok, 'bắt đầu phiên 4: ' + s4.reason);
  const sp4 = await call(c.socket, 'tu:speedup', { sessionId: s4.session.id });
  assert.ok(sp4.ok, 'yêu cầu hoàn thành ngay lần 3: ' + sp4.reason);
  const rej = waitFor(c.socket, 'tu:update', u => u.kind === 'speedup-rejected');
  assert.equal((await srv.admin(`/api/admin/donations/${sp4.code}/cancel`, 'POST')).status, 200);
  await rej;
  st = await sess();
  assert.equal(st.session.status, 'active');
  assert.equal(st.session.speedup, null);
  // cùng yêu cầu bị từ chối rồi mà tiền vẫn tới: admin xác nhận có chủ đích → phiên còn chạy thì hoàn thành, một lần
  const done4 = waitFor(c.socket, 'tu:update', u => u.kind === 'completed' && u.via === 'speedup');
  assert.equal((await srv.admin(`/api/admin/donations/${sp4.code}/confirm`, 'POST')).json.outcome, 'applied');
  await done4;
  assert.equal((await sess()).profile.congLuc, 65);

  // --- 4) giới hạn mỗi ngày (đã xác nhận 3 lần: sp, sp3, sp4) ---
  const s5 = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '4h' });
  const lim = await call(c.socket, 'tu:speedup', { sessionId: s5.session.id });
  assert.equal(lim.ok, true, lim.reason);
  assert.ok((await call(c.socket, 'tu:cancel', { sessionId: s5.session.id })).ok);

  // --- 5) quản trị: sai mã bị khóa, có nhật ký và bản sao lưu ---
  const aud = await srv.admin('/api/admin/audit');
  assert.ok(aud.json.audit.some(x => x.action === 'donation.confirm' && x.target === sp.code));
  assert.ok(!JSON.stringify(aud.json).includes('khoa-quan-tri-thu'), 'nhật ký không chứa mã quản trị');
  const exp = await srv.admin('/api/admin/export');
  assert.equal(exp.status, 200);
  assert.ok(exp.json.martial.profiles['uid-speedup-0001']);
  assert.equal(exp.json.authSessions, undefined, 'mặc định không xuất phiên đăng nhập');
  for (let i = 0; i < 10; i++) assert.equal((await srv.admin('/api/admin/summary', 'GET', null, 'sai-ma')).status, 401);
  assert.equal((await srv.admin('/api/admin/summary', 'GET', null, 'sai-ma')).status, 429);
  assert.equal((await srv.admin('/api/admin/summary')).status, 429, 'đang bị khóa thì mã đúng cũng phải đợi');

  // --- 6) khởi động lại: mọi thứ còn nguyên ---
  c.socket.close();
  await srv.restart();
  const c2b = await enter(srv, 'Dieu Lien', 'uid-speedup-0001');
  const st2 = await call(c2b.socket, 'martial:state', {});
  assert.equal(st2.profile.congLuc, 65);
  const sum2 = await srv.admin('/api/admin/summary');
  assert.equal(sum2.json.donations.filter(d => d.purpose === 'speedup' && d.status === 'confirmed').length, 3);
});

test('hoàn thành ngay bị tắt khi chưa có tài khoản nhận tịnh tài', async t => {
  const srv = await startServer({});
  t.after(() => srv.stop());
  const c = await enter(srv, 'Dieu Lien', 'uid-no-bank-0001');
  const s = await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '4h' });
  assert.ok(s.ok);
  const r = await call(c.socket, 'tu:speedup', { sessionId: s.session.id });
  assert.equal(r.ok, false);
  const st = await call(c.socket, 'martial:state', {});
  assert.equal(st.speedup.enabled, false);
});

test('tắt hẳn Võ Học Các và Sân đấu bằng biến môi trường', async t => {
  const srv = await startServer({ MARTIAL_ENABLED: '0' });
  t.after(() => srv.stop());
  const c = await enter(srv, 'Dieu Lien', 'uid-off-00000001');
  assert.equal(c.join.config.martial.enabled, false);
  assert.equal((await call(c.socket, 'place:set', { place: 'arena' })).ok, false);
  assert.equal((await call(c.socket, 'place:set', { place: 'dojo' })).ok, false);
  assert.equal((await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '4h' })).ok, false);
  assert.equal((await call(c.socket, 'place:set', { place: 'hall' })).ok, true);
});
