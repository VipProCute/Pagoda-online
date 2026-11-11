'use strict';
/*
 * Thử đầu-cuối Sân đấu với MÁY CHỦ THẬT (server.js) và trang thật (index.html + app.js + places.js + arena.js):
 * một trình duyệt Playwright là người chơi, một bot socket.io-client là đối thủ.
 *   node tools/ui-harness/arena/e2e-real.js
 * Không cần chạy serve.js: tự mở server.js ở cổng trống (dữ liệu tạm), dùng test/helpers/live.js và client.js có sẵn.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const M = require('../../../public/js/martial');
const { startServer, sleep } = require('../../../test/helpers/live');
const { connect, call, join } = require('../../../test/helpers/client');

const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'arena-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const BOT_LOADOUT = ['tat-phong-quyen', 'anh-bo-ho-than', 'nhu-van-bo', 'lieu-diep-chuong'];
const BOT_ONLY = ['nhu-van-bo', 'lieu-diep-chuong'];          // chiêu bot có mà bộ mặc định của người chơi không có
const nm = id => (M.SKILLS[id] || M.SPECIAL[id]).name;
const results = [];
let ctxs = [];

/* ---------- bot ---------- */
async function makeBot(srv, name, uid) {
  const socket = await connect(srv.port);
  const r = await join(socket, name, uid);
  assert.ok(r && r.ok, 'bot vào chánh điện: ' + (r && r.reason));
  const bot = { socket, pid: r.you, name, uid, auto: { accept: true, lock: true, play: true }, picks: {}, delay: 300, rows: new Map(), turnNo: 0 };
  socket.on('pk:invited', d => { bot.invited = d; if (bot.auto.accept) call(socket, 'pk:respond', { inviteId: d.inviteId, accept: true }).catch(() => {}); });
  socket.on('pk:lobby', d => { bot.lobby = d; if (bot.auto.lock) call(socket, 'pk:loadout', { matchId: d.matchId, skills: BOT_LOADOUT }).catch(() => {}); });
  socket.on('pk:turn', d => {
    bot.turn = d; bot.turnNo = d.turn;
    if (!bot.auto.play || d.forced) return;
    setTimeout(() => {
      if (bot.turn !== d) return;
      const own = d.legal.filter(id => BOT_ONLY.includes(id)), pool = own.length && Math.random() < 0.7 ? own : d.legal;
      const id = pool[Math.floor(Math.random() * pool.length)];
      bot.picks[d.turn] = id;
      call(socket, 'pk:pick', { matchId: d.matchId, turn: d.turn, skillId: id }).catch(() => {});
    }, bot.delay);
  });
  socket.on('pk:reveal', d => { bot.lastReveal = d; });
  socket.on('pk:end', d => { bot.end = d; });
  socket.on('arena:upd', d => { bot.upd = d; });
  socket.on('arena:add', r => { bot.rows.set(r.name, r); });
  const ack = await call(socket, 'place:set', { place: 'arena' });
  assert.ok(ack.ok, 'bot ra sân: ' + ack.reason);
  return bot;
}

/* ---------- trang ---------- */
const IGNORE = /Failed to load resource|dojo\.(js|css)|fonts\.g|ERR_|favicon/;
async function newPage(browser, srv, kind) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: kind === 'reduced' ? 'reduce' : 'no-preference' });
  ctxs.push(ctx);
  const page = await ctx.newPage();
  page.errs = [];
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.test(m.text())) page.errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => page.errs.push('pageerror: ' + e.message));
  return page;
}
async function enterHall(page, srv, name) {
  await page.goto(srv.url + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#jName');
  if (!(await page.inputValue('#jName'))) await page.fill('#jName', name);
  await page.click('#joinBtn');
  await page.waitForSelector('.mapbar-btn[data-map="arena"]:not([hidden])', { timeout: 10000 });
}
async function goArena(page) {
  await page.click('.mapbar-btn[data-map="arena"]');
  await page.waitForSelector('#place-arena:not([hidden]) .ar-root');
  await page.waitForSelector('.ar-screen:not([hidden])');
}
const text = (pg, sel) => pg.$eval(sel, e => e.textContent);
const vis = (pg, sel) => pg.locator(sel).first().isVisible();
const shot = (pg, n) => pg.screenshot({ path: path.join(SHOTS, 'real-' + n + '.png') });
const leaks = (pg, needles, allow) => pg.evaluate(([ns, al]) => {
  const all = document.documentElement.outerHTML + '\n' + document.body.innerText, ok = [...document.querySelectorAll(al)].map(e => e.outerHTML + e.innerText).join('\n');
  const cnt = (s, n) => s.split(n).length - 1;
  return ns.map(n => cnt(all, n) - cnt(ok, n)).reduce((a, b) => a + Math.max(0, b), 0);
}, [needles, allow]);
/** Sân là khung vẽ đi lại được; danh sách người nằm trong ngăn kéo "Danh sách". */
async function openList(page) { await page.waitForSelector('.ar-listbtn'); if (await page.$eval('.ar-drawer', d => d.hidden)) await page.click('.ar-listbtn'); }
async function rowOf(page, name) { await openList(page); return page.locator('.ar-row', { hasText: name }).first(); }
async function inviteBot(page, botName, mode) {
  const row = await rowOf(page, botName);
  await row.locator('.ar-inv').click();
  await page.waitForSelector('dialog[open]');
  if (mode === 'buff') await page.click('dialog[open] .opt >> nth=1');
  await page.click('dialog[open] button[type=submit]');
}
const waitTurnOrEnd = (page, after) => page.waitForFunction(n => {
  if (document.querySelector('.ar-end:not([hidden])')) return 'end';
  const m = /Lượt (\d+)/.exec((document.querySelector('.ar-turn') || {}).textContent || ''), p = document.querySelector('.ar-pickui');
  return m && +m[1] > n && p && !p.hidden && document.querySelector('.ar-matchbox:not([hidden])') ? +m[1] : false;
}, after, { timeout: 40000 }).then(h => h.jsonValue());

/** Chơi hết trận phía trình duyệt: mỗi lượt chọn một chiêu chọn được, khóa, kiểm tra không lộ chiêu bot trước khi lật. */
async function playMatch(page, bot, info) {
  let last = 0, turns = 0;
  for (;;) {
    const r = await waitTurnOrEnd(page, last);
    if (r === 'end') break;
    last = r; turns++;
    const forced = await page.$eval('.ar-status', e => /tự tung/.test(e.textContent));
    // bot đã chọn xong thì kiểm tra DOM: không được có tên chiêu bot chọn (ngoài hàng bộ chiêu công bố và nhật ký)
    if (!forced) {
      for (let i = 0; i < 30 && !bot.picks[r]; i++) await sleep(50);
      const pk = bot.picks[r];
      if (pk && BOT_ONLY.includes(pk) && (await vis(page, '.ar-pickui'))) {
        const n = await leaks(page, [nm(pk), pk], '.ar-oploadout, .ar-logpanel');
        if (n) throw new Error(`lộ chiêu của bot (${pk}) lượt ${r} trước khi lật`);
        info.leakChecks++;
      }
      const cards = await page.$$('.ar-pk:not(:disabled)');
      assert.ok(cards.length >= 1, 'không có thẻ nào chọn được lượt ' + r);
      let pick = null;
      for (const c of cards) if (/Công/.test(await c.textContent())) { pick = c; break; }
      pick = pick || cards[Math.floor(Math.random() * cards.length)];
      await pick.click();
      await page.click('.ar-lockbtn');
      await page.waitForFunction(k => /Đã khóa|Lượt/.test(document.querySelector('.ar-status').textContent) || document.querySelector('.ar-reveal:not([hidden])'), r, { timeout: 5000 });
    }
    // lật chiêu: khi hoạt ảnh xong, HP hai bên phải khớp pk:reveal mà bot nhận (đảo you / op)
    await page.waitForSelector('.ar-reveal:not([hidden])', { timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll('.ar-flip.on').length === 2, null, { timeout: 8000 });
    const rv = bot.lastReveal;
    if (rv && rv.turn === r) {
      const want = [`${rv.state.op.hp}/${rv.state.op.hpMax}`, `${rv.state.you.hp}/${rv.state.you.hpMax}`];
      await page.waitForFunction(([a, b]) => document.querySelector('.ar-fc-you .ar-hp .ar-m-v').textContent === a && document.querySelector('.ar-fc-op .ar-hp .ar-m-v').textContent === b, want, { timeout: 8000 });
      const flips = await page.$$eval('.ar-flip', fs => fs.map(f => f.textContent));
      assert.ok(flips[1].includes(nm(rv.picks.you.skill)), 'thẻ lật của đối thủ phải là chiêu bot đã chọn: ' + flips[1] + ' vs ' + rv.picks.you.skill);
      const narr = rv.events.filter(e => !['pick', 'rage', 'end'].includes(e.k)).length + (rv.ended ? 1 : 0);
      await page.waitForFunction(k => document.querySelectorAll('.ar-lines li').length >= k, narr, { timeout: 5000 });
      info.reveals++;
    }
    if (rv && rv.turn === r && rv.ended) { await page.waitForSelector('.ar-end:not([hidden])', { timeout: 15000 }); break; }
  }
  info.turns = turns;
}

async function t(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;   // ONLY="giảm chuyển động" để chạy riêng một kiểm tra
  const t0 = Date.now();
  try { await fn(); results.push([true, name]); console.log(`PASS  ${name}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`); }
  catch (e) { results.push([false, name, e]); console.log(`FAIL  ${name}\n      ${String(e && e.stack || e).split('\n').slice(0, 8).join('\n      ')}`); }
}

(async () => {
  const browser = await chromium.launch();
  const servers = [];
  const open = [];

  /* ===== 1. Trận đầy đủ, thời gian nhanh gấp đôi ===== */
  await t('Máy chủ thật: sân, mời đi, nhận lời, sảnh, trận đầy đủ tới phân thắng bại, kết quả khớp, về sân', async () => {
    const srv = await startServer({ PK_TIME_SCALE: '0.5' }); servers.push(srv);
    const bot = await makeBot(srv, 'Huyen Trang', 'uid-bot-real-0001'); open.push(bot.socket);
    const page = await newPage(browser, srv);
    await enterHall(page, srv, 'Diệu Liên');
    assert.ok(!(await vis(page, '#place-arena')), 'chánh điện không được có màn sân đấu');
    await goArena(page);
    await openList(page);
    await page.waitForSelector('.ar-row:has-text("Huyen Trang")');
    assert.match(await text(page, '.ar-drawer'), /Rảnh/);
    await shot(page, 'roster');
    // công tắc không nhận lời mời: bot thấy st = dnd rồi trở lại
    await page.click('.ar-switch'); await page.waitForFunction(() => document.querySelector('.ar-switch').getAttribute('aria-checked') === 'true');
    await sleep(200);
    assert.ok(bot.upd && bot.upd.st === 'dnd', 'bot phải nhận arena:upd st=dnd, nhận: ' + JSON.stringify(bot.upd));
    await page.click('.ar-switch'); await page.waitForFunction(() => document.querySelector('.ar-switch').getAttribute('aria-checked') === 'false');
    await sleep(200);
    assert.equal(bot.upd.st, 'free');
    // mời bot (cân bằng), bot nhận lời
    await inviteBot(page, 'Huyen Trang', 'balanced');
    await page.waitForSelector('.ar-lobby:not([hidden])', { timeout: 10000 });
    assert.ok(await page.evaluate(() => Arena.inMatch()));
    await page.waitForSelector('.ar-slot.on');
    assert.equal(await page.locator('.ar-slot.on').count(), 4);
    assert.ok(await page.locator('.ar-picker .ar-card').count() >= 6);
    await shot(page, 'lobby');
    await page.click('.ar-lb-act .btn');
    const info = { leakChecks: 0, reveals: 0, turns: 0 };
    await playMatch(page, bot, info);
    await page.waitForSelector('.ar-end:not([hidden])', { timeout: 20000 });
    await sleep(300);
    // khớp kết quả với pk:end của bot (góc nhìn đảo)
    const be = bot.end, mine = { win: 'Bạn thua', lose: 'Bạn thắng', draw: 'Hòa' }[be.result];
    const title = await text(page, '.ar-etitle');
    if (be.reason === 'void' || be.reason === 'both-away') assert.equal(title, 'Trận bị hủy'); else assert.equal(title, mine);
    const et = await text(page, '.ar-end');
    assert.match(et, /Thành tích\s*Thắng \d+ · Thua \d+ · Hòa \d+/);
    assert.match(et, new RegExp('Số lượt\\s*' + be.turns));
    assert.ok(new RegExp(`${be.state.op.hp}/200`).test(et) && new RegExp(`${be.state.you.hp}/200`).test(et), 'HP còn lại khớp');
    await shot(page, 'end');
    console.log(`      ${info.turns} lượt, ${info.reveals} lượt lật đối chiếu với máy chủ, ${info.leakChecks} lần kiểm tra không lộ chiêu; kết quả: ${title} (${be.reason}); bot: ${be.result}`);
    // về sân: bot hiện lại là Rảnh, thành tích cập nhật
    await page.click('.ar-eact .btn.primary');
    await page.waitForSelector('.ar-roster:not([hidden])');
    await openList(page);
    await page.waitForFunction(() => /Rảnh/.test((document.querySelector('.ar-row') || {}).textContent || ''), null, { timeout: 5000 });
    const meta = await text(page, '.ar-row:has-text("Huyen Trang") .ar-rmeta');
    const total = (be.record.wins || 0) + (be.record.losses || 0);
    assert.ok(total >= 0 && /thắng/.test(meta), meta);
    assert.deepEqual(page.errs, [], 'console');
    await page.close();
    bot.socket.close();
  });

  /* ===== 2. Bot mời, phòng buff, chặn, từ chối ===== */
  await t('Máy chủ thật: bot mời (phòng buff) → thẻ lời mời, từ chối, mời lại bị khóa 5 phút, chặn', async () => {
    const srv = await startServer({ PK_TIME_SCALE: '1' }); servers.push(srv);
    const bot = await makeBot(srv, 'Huyen Trang', 'uid-bot-real-0002'); open.push(bot.socket);
    bot.auto.accept = false;
    const page = await newPage(browser, srv);
    await enterHall(page, srv, 'Diệu Liên');
    await goArena(page);
    await openList(page);
    await page.waitForSelector('.ar-row:has-text("Huyen Trang")');
    const me = bot.rows.get('Diệu Liên');                      // bot nhận arena:add khi người chơi ra sân
    assert.ok(me, 'bot phải thấy người chơi ra sân');
    const inv =await call(bot.socket, 'pk:invite', { toPid: me.pid, mode: 'buff' });
    assert.ok(inv.ok, inv.reason);
    await page.waitForSelector('.ar-ic .ar-bt', { timeout: 5000 });
    const card = await text(page, '.ar-ic');
    assert.ok(/Huyen Trang/.test(card) && /Phòng có buff/.test(card) && /Không có buff/.test(card) && /bản xem trước/.test(card), card);
    assert.ok(await page.evaluate(() => { const b = document.querySelector('.ar-back').getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!e.closest('.ar-back'); }), 'thẻ che nút Về chánh điện');
    await shot(page, 'invite-buff');
    await page.click('.ar-ic .btn:not(.primary)');
    await page.waitForSelector('.ar-ic', { state: 'detached' });
    await sleep(300);
    const again = await call(bot.socket, 'pk:invite', { toPid: me.pid, mode: 'balanced' });
    assert.equal(again.ok, false, 'bị từ chối thì không mời lại ngay được');
    // chặn bot từ giao diện
    await (await rowOf(page, 'Huyen Trang')).locator('.ar-blk').click();
    await page.click('dialog[open] .btn.primary');
    await page.waitForFunction(() => /Đã chặn/.test(document.querySelector('#toast').textContent));
    await page.click('.ar-blocks');
    await page.waitForSelector('.ar-bli');
    assert.match(await text(page, '.ar-bl'), /Huyen Trang/);
    await page.click('.ar-bli .btn');
    await page.waitForFunction(() => !document.querySelector('.ar-bli'));
    assert.deepEqual(page.errs, [], 'console');
    await page.close();
    bot.socket.close();
  });

  /* ===== 3. Phòng buff từ phía người chơi mời, bỏ cuộc giữa trận bằng nút Về chánh điện ===== */
  await t('Máy chủ thật: bỏ cuộc giữa trận qua nút Về chánh điện (xác nhận) → bot thắng, người chơi về chánh điện', async () => {
    const srv = await startServer({ PK_TIME_SCALE: '1' }); servers.push(srv);
    const bot = await makeBot(srv, 'Huyen Trang', 'uid-bot-real-0003'); open.push(bot.socket);
    const page = await newPage(browser, srv);
    await enterHall(page, srv, 'Diệu Liên');
    await goArena(page);
    await openList(page);
    await page.waitForSelector('.ar-row:has-text("Huyen Trang")');
    await inviteBot(page, 'Huyen Trang', 'buff');
    await page.waitForSelector('.ar-lobby:not([hidden])', { timeout: 10000 });
    assert.ok(/Không có buff/.test(await text(page, '.ar-lobby')), 'chưa có công đức / cúng dường thì không có buff');
    assert.match(await text(page, '.ar-lobby'), /chụp một lần lúc nhận lời/);
    await page.click('.ar-lb-act .btn');
    await page.waitForSelector('.ar-matchbox:not([hidden])', { timeout: 10000 });
    await page.waitForSelector('.ar-pickui:not([hidden]) .ar-pk:not(:disabled)');
    const fits = await page.evaluate(() => { const b = document.querySelector('.ar-matchbox'); return b.scrollHeight - b.clientHeight; });
    assert.ok(fits <= 1, 'trận cuộn dọc ' + fits);
    await shot(page, 'match');
    await page.evaluate(() => history.back());                // nút Back điện thoại: bị chặn khi có trận
    await page.waitForFunction(() => /Đang có trận/.test(document.querySelector('#toast').textContent));
    assert.equal(await page.evaluate(() => Places.current), 'arena');
    await page.click('.ar-back');
    await page.waitForSelector('dialog[open]');
    await page.click('dialog[open] .btn:has-text("Bỏ cuộc")');
    await page.waitForFunction(() => Places.current === 'hall', null, { timeout: 8000 });
    await sleep(500);
    assert.ok(bot.end, 'bot phải nhận pk:end');
    assert.equal(bot.end.reason, 'forfeit'); assert.equal(bot.end.result, 'win'); assert.equal(bot.end.who, 'op');
    assert.ok(!(await vis(page, '#place-arena')));
    assert.deepEqual(page.errs, [], 'console');
    await page.close();
    bot.socket.close();
  });

  /* ===== 4. Tải lại trang giữa trận: pk:resume trả snapshot từng pha ===== */
  await t('Máy chủ thật: tải lại trang ở sảnh, khi đang chọn chiêu, khi đang lật → vào lại đúng pha', async () => {
    const srv = await startServer({ PK_TIME_SCALE: '1' }); servers.push(srv);
    const bot = await makeBot(srv, 'Huyen Trang', 'uid-bot-real-0004'); open.push(bot.socket);
    bot.auto.lock = false; bot.auto.play = false;
    const page = await newPage(browser, srv);
    await enterHall(page, srv, 'Diệu Liên');
    await goArena(page);
    await openList(page);
    await page.waitForSelector('.ar-row:has-text("Huyen Trang")');
    await inviteBot(page, 'Huyen Trang', 'balanced');
    await page.waitForSelector('.ar-lobby:not([hidden])', { timeout: 10000 });
    // (a) sảnh: bot khóa trước, rồi tải lại
    await call(bot.socket, 'pk:loadout', { matchId: bot.lobby.matchId, skills: BOT_LOADOUT });
    await page.waitForSelector('.ar-ready:not([hidden])');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#jName'); await page.click('#joinBtn'); await page.waitForSelector('.mapbar-btn[data-map="arena"]:not([hidden])');
    await goArena(page);
    await page.waitForSelector('.ar-lobby:not([hidden])', { timeout: 8000 });
    assert.ok(await vis(page, '.ar-ready'), 'vào lại sảnh: đối thủ đã sẵn sàng');
    assert.ok(await page.locator('.ar-picker .ar-card').count() >= 6, 'danh sách chiêu đã học lấy từ snapshot');
    assert.match(await text(page, '.ar-clock'), /\d+ giây/);
    // khóa bộ chiêu → lượt 1
    await page.click('.ar-lb-act .btn');
    await page.waitForSelector('.ar-matchbox:not([hidden])', { timeout: 10000 });
    await page.waitForSelector('.ar-pickui:not([hidden]) .ar-pk:not(:disabled)');
    // (b) đang chọn: bot khóa trước, rồi tải lại
    await call(bot.socket, 'pk:pick', { matchId: bot.lobby.matchId, turn: 1, skillId: 'nhu-van-bo' });
    await page.waitForSelector('.ar-lockb.on');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#jName'); await page.click('#joinBtn'); await page.waitForSelector('.mapbar-btn[data-map="arena"]:not([hidden])');
    await goArena(page);
    await page.waitForSelector('.ar-matchbox:not([hidden])', { timeout: 8000 });
    assert.match(await page.$eval('.ar-turn', e => e.textContent), /Lượt 1/);
    assert.ok(await page.$eval('.ar-lockb', e => e.classList.contains('on')), 'vào lại: đối thủ đã khóa');
    assert.equal(await leaks(page, [nm('nhu-van-bo')], '.ar-oploadout, .ar-logpanel'), 0, 'snapshot không được làm lộ chiêu bot chọn');
    assert.equal(await page.locator('.ar-oploadout .ar-ol').count(), 4);
    // (c) chọn Trọng Quyền, khóa → lật → tải lại trong lúc lật
    await page.click('.ar-pk[data-skill="trong-quyen"]'); await page.click('.ar-lockbtn');
    await page.waitForSelector('.ar-reveal:not([hidden])', { timeout: 5000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#jName'); await page.click('#joinBtn'); await page.waitForSelector('.mapbar-btn[data-map="arena"]:not([hidden])');
    await goArena(page);
    await page.waitForSelector('.ar-matchbox:not([hidden])', { timeout: 8000 });
    await page.waitForFunction(() => document.querySelectorAll('.ar-lines li').length >= 1 || !document.querySelector('.ar-pickui').hidden, null, { timeout: 6000 });
    // sau 4 giây sang lượt 2
    await page.waitForFunction(() => /Lượt 2/.test(document.querySelector('.ar-turn').textContent) && !document.querySelector('.ar-pickui').hidden, null, { timeout: 8000 });
    assert.match(await text(page, '.ar-logpanel'), /Lượt 1/, 'nhật ký có lượt 1');
    assert.deepEqual(page.errs, [], 'console');
    await page.close();
    bot.socket.close();
  });

  /* ===== 5. Giảm chuyển động trên máy chủ thật ===== */
  await t('Máy chủ thật + giảm chuyển động: một lượt, lật chiêu hiện ngay', async () => {
    const srv = await startServer({ PK_TIME_SCALE: '1' }); servers.push(srv);
    const bot = await makeBot(srv, 'Huyen Trang', 'uid-bot-real-0005'); open.push(bot.socket);
    const page = await newPage(browser, srv, 'reduced');
    await enterHall(page, srv, 'Diệu Liên');
    await goArena(page);
    await openList(page);
    await page.waitForSelector('.ar-row:has-text("Huyen Trang")');
    await inviteBot(page, 'Huyen Trang', 'balanced');
    await page.waitForSelector('.ar-lobby:not([hidden])', { timeout: 10000 });
    await page.click('.ar-lb-act .btn');
    await page.waitForSelector('.ar-pickui:not([hidden]) .ar-pk:not(:disabled)', { timeout: 10000 });
    await page.click('.ar-pk[data-skill="trong-quyen"]');
    await page.click('.ar-lockbtn');
    await page.waitForSelector('.ar-reveal:not([hidden])', { timeout: 8000 });
    await sleep(200);
    assert.equal(await page.locator('.ar-flip.on').count(), 2);
    assert.ok(await page.locator('.ar-lines li').count() >= 1);
    assert.deepEqual(page.errs, [], 'console');
    await page.close();
    bot.socket.close();
  });

  for (const c of ctxs) await c.close().catch(() => {});
  await browser.close();
  for (const s of open) try { s.close(); } catch (e) { /* bỏ qua */ }
  for (const s of servers) await s.stop();
  const bad = results.filter(r => !r[0]);
  console.log(`\n${results.length - bad.length}/${results.length} kiểm tra đạt. Ảnh chụp: ${SHOTS}`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
