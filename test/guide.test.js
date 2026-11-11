'use strict';
/* Sổ tay (T-061): nội dung public/data/so-tay.vi.json, chỗ giữ chỗ số liệu, ẩn mục theo tính năng, không lộ bí mật. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const G = require('../public/js/guide');
const MERIT = require('../public/js/merit');
const MARTIAL = require('../public/js/martial');
const AURA = require('../public/js/aura');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/so-tay.vi.json'), 'utf8'));

// /api/config mẫu (cùng khóa với clientConfig() trong server.js)
const CFG = { meritPerVnd: MERIT.EARN.perVnd, incenseMinutes: 5, martial: { enabled: true, pk: true, speedup: true, loginRequired: true }, donation: { mode: 'test' }, voice: true };
const ctx = G.makeContext({ MERIT, MARTIAL, AURA }, CFG);
const ALL = () => true, NONE = () => false;

function textsOf(d) {
  const out = [];
  for (const s of d.sections) {
    out.push(s.title);
    for (const b of s.blocks) {
      if (b.text) out.push(b.text);
      for (const it of b.items || []) { if (typeof it === 'string') out.push(it); else out.push(it.term, it.def); }
    }
  }
  return out;
}

test('Sổ tay: đủ 13 mục theo KH §8.4, id không trùng', () => {
  assert.equal(data.sections.length, 13);
  assert.deepEqual(data.sections.map(s => s.id), ['start', 'merit', 'chant', 'donate', 'voice', 'yard', 'kydao', 'library', 'dojo', 'arena', 'titles', 'account', 'glossary']);
});

test('Sổ tay: mọi chỗ giữ chỗ đều thay được bằng giá trị từ MERIT.EARN, MARTIAL.PK, AURA, /api/config', () => {
  assert.deepEqual(G.missingPlaceholders(data, ctx), []);
  const used = new Set();
  for (const t of textsOf(data)) for (const m of t.matchAll(/\{([A-Za-z_]\w*(?:\.\w+)+)\}/g)) used.add(m[1]);
  for (const k of ['EARN.incense', 'PK.TURN_SECONDS', 'PK.IDLE_FORFEIT_TURNS', 'PK.MAX_TURNS', 'MARTIAL.LEVEL_MAX']) assert.ok(used.has(k), `Sổ tay chưa dùng {${k}}`);
});

test('Sổ tay: chỗ giữ chỗ không thay được thì bị báo (không lặng lẽ để trống)', () => {
  const bad = { sections: [{ id: 'x', title: 'T', blocks: [{ type: 'p', text: 'A {EARN.khong_co} B {PK.HP} C {NOPE.x}' }] }] };
  assert.deepEqual(G.missingPlaceholders(bad, ctx).sort(), ['EARN.khong_co', 'NOPE.x']);
  assert.equal(G.resolve('Máu {PK.HP}, chờ {PK.REVEAL_SECONDS} giây', ctx).text, 'Máu 200, chờ 6,5 giây');
  assert.equal(G.resolve('{EARN.__proto__.x}', ctx).missing.length, 1);
});

test('Sổ tay: số liệu thay đúng giá trị trong mã', () => {
  assert.equal(G.resolve('{EARN.incense}', ctx).text, String(MERIT.EARN.incense));
  assert.equal(G.resolve('{PK.IDLE_FORFEIT_TURNS}', ctx).text, String(require('../lib/pk/rules').IDLE_FORFEIT_TURNS));
  assert.equal(G.resolve('{MERIT.RANKS}', ctx).text, String(MERIT.RANKS.length));
  assert.equal(G.resolve('{AURA.TIERS}', ctx).text, String(AURA.TIERS.length));
});

test('Sổ tay: bật đủ tính năng thì hiện cả 13 mục; tắt hết thì chỉ còn mục luôn có', () => {
  assert.equal(G.visibleSections(data, ALL).length, 13);
  const off = G.visibleSections(data, NONE).map(s => s.id);
  assert.deepEqual(off, ['start', 'merit', 'chant', 'voice', 'yard', 'library', 'glossary']);
  for (const s of G.visibleSections(data, NONE)) assert.ok(s.blocks.length > 0);
  // đoạn của tính năng tắt không lọt vào mục còn hiện
  const voiceOff = G.visibleSections(data, n => n !== 'voice').find(s => s.id === 'voice');
  assert.ok(!JSON.stringify(voiceOff).includes('micro'));
  // thuật ngữ của tính năng tắt cũng bị ẩn
  const gloss = G.visibleSections(data, NONE).find(s => s.id === 'glossary').blocks[0].items.map(i => i.term);
  assert.ok(!gloss.includes('Elo') && !gloss.includes('Nội công') && gloss.includes('Công đức'));
});

test('Sổ tay: chỉ bật pk thì vẫn thấy điểm chiến tích và bậc chiến tích; danh hiệu lịch sử vẫn ẩn', () => {
  const secs = G.visibleSections(data, n => n === 'pk' || n === 'martial');
  const t = secs.find(s => s.id === 'titles');
  assert.ok(t, 'mục Danh hiệu phải hiện khi pk bật');
  const text = G.resolve(JSON.stringify(t), ctx).text;
  assert.match(text, /Điểm chiến tích là 3 điểm/);
  assert.match(text, /9 bậc chiến tích/);
  assert.match(text, /Tay Mơ Tập Võ/);
  assert.ok(!/lịch sử/.test(text) && !/mùa/i.test(text));
  const gloss = secs.find(s => s.id === 'glossary').blocks[0].items.map(i => i.term);
  assert.ok(gloss.includes('Điểm chiến tích') && gloss.includes('Bậc chiến tích') && !gloss.includes('Danh hiệu'));
  // pk tắt thì mục không còn gì để hiện
  assert.ok(!G.visibleSections(data, NONE).some(s => s.id === 'titles'));
});

test('Sổ tay: thầy Tử vi, thầy Tarot hiện ở Sân chùa khi có Fortune; bản mới (tuvi5, tarot5) thay câu cũ', () => {
  const yard = on => JSON.stringify(G.visibleSections(data, n => on.includes(n)).find(s => s.id === 'yard'));
  assert.ok(!/Tử vi/.test(yard([])));
  const now = yard(['tuvi', 'tarot', 'fortune']);
  assert.match(now, /địa chi năm sinh/);
  assert.match(now, /ba lá bài/);
  assert.match(now, /hũ xăm/);
  assert.ok(!/lá số\./.test(now.replace('Chưa lập lá số hay an sao', '')));
  const next = yard(['tuvi', 'tuvi5', 'tarot', 'tarot5']);
  assert.match(next, /Lá số tính ngay/);
  assert.match(next, /5 lá bài/);
  assert.ok(!/địa chi năm sinh/.test(next) && !/ba lá bài/.test(next));
});

test('Sổ tay: has() bật tuvi/tarot/fortune khi có Fortune phía trình duyệt, tắt khi không', () => {
  assert.equal(G.has('tuvi'), false);
  const prev = global.Fortune;
  // ở Node, guide.js lấy globalThis làm root nên đặt Fortune trực tiếp được
  global.Fortune = {};
  try { assert.equal(G.has('tuvi'), true); assert.equal(G.has('tarot'), true); assert.equal(G.has('fortune'), true); }
  finally { if (prev === undefined) delete global.Fortune; else global.Fortune = prev; }
});

test('Sổ tay: has() ánh xạ cờ /api/config; cờ tắt thì mục và đoạn tương ứng ẩn', () => {
  const flags = () => ['pk', 'voice', 'donation', 'speedup', 'login'].map(n => G.has(n));
  try {
    G.configure({ martial: { enabled: true, pk: false, speedup: false, loginRequired: false }, donation: null, voice: false });
    assert.deepEqual(flags(), [false, false, false, false, false]);
    const ids = G.visibleSections(data, G.has).map(s => s.id);
    assert.ok(!ids.includes('arena') && !ids.includes('donate') && !ids.includes('account') && ids.includes('dojo'));
    const txt = JSON.stringify(G.visibleSections(data, G.has));
    assert.ok(!/Hoàn thành ngay/.test(txt), 'speedup tắt thì ẩn Hoàn thành ngay');
    assert.ok(!/Cúng dường tịnh tài/.test(txt), 'donation tắt thì ẩn câu cúng dường ở mục công đức');

    G.configure({ martial: { enabled: true, pk: true, speedup: true, loginRequired: true }, donation: { mode: 'test' }, voice: true });
    assert.deepEqual(flags(), [true, true, true, true, true]);
    const on = JSON.stringify(G.visibleSections(data, G.has));
    assert.match(on, /Hoàn thành ngay/);
    assert.match(on, /Cúng dường tịnh tài/);

    // martial tắt thì pk, speedup cũng tắt dù cờ con còn bật
    G.configure({ martial: { enabled: false, pk: true, speedup: true }, donation: null, voice: false });
    assert.equal(G.has('pk'), false);
    assert.equal(G.has('speedup'), false);
  } finally { G.configure(null); }
});

test('Sổ tay: chỗ giữ chỗ không đọc được khóa kế thừa của Object', () => {
  const r = G.resolve('{EARN.constructor.name} {EARN.toString}', ctx);
  assert.equal(r.missing.length, 2);
  assert.ok(!/Object|function/.test(r.text));
});

test('Sổ tay: số bậc / điểm chiến tích lấy từ MARTIAL, không viết cứng', () => {
  assert.equal(ctx.MARTIAL.PK_TITLES, MARTIAL.PK_TITLES.length);
  assert.equal(ctx.MARTIAL.WIN_POINTS, 3);
  assert.equal(ctx.MARTIAL.DRAW_POINTS, 1);
  assert.equal(ctx.MARTIAL.PK_TITLE_LAST, MARTIAL.PK_TITLES[MARTIAL.PK_TITLES.length - 1].name);
  const used = textsOf(data).join('\n');
  for (const k of ['EARN.mo', 'EARN.heart', 'EARN.rejoice', 'MARTIAL.PK_TITLES', 'MARTIAL.WIN_POINTS']) assert.ok(used.includes(`{${k}}`), `chưa dùng {${k}}`);
});

test('Sổ tay: mục của tính năng đang tắt trong cấu hình thì ẩn (pk tắt → không có Sân đấu)', () => {
  const only = new Set(['martial', 'donation', 'voice', 'login']);
  const ids = G.visibleSections(data, n => only.has(n)).map(s => s.id);
  assert.ok(ids.includes('dojo') && !ids.includes('arena') && !ids.includes('kydao'));
});

test('Sổ tay: không lộ bí mật (HUONG-DAN-VIET §3)', () => {
  const all = textsOf(data).join('\n');
  for (const secret of [/666/, /Như Lai/i, /Tẩu Vi/i, /Kamui/i, /Tảo Địa/i, /Ma Vương/i, /\bbuff\b/i, /đối đầu/i, /meme/i, /celebrate/i]) {
    assert.ok(!secret.test(all), `Sổ tay nhắc bí mật: ${secret}`);
  }
});

test('Sổ tay: không dùng từ cũ đã bỏ trong bảng thuật ngữ', () => {
  const all = textsOf(data).join('\n');
  assert.ok(!/Danh hiệu PK/.test(all), 'dùng "Bậc chiến tích", không dùng "Danh hiệu PK"');
  assert.ok(!/cảnh giới hào quang/i.test(all), 'hào quang có "tầng", "cảnh giới" chỉ dành cho nội công');
  assert.ok(!/thuần thục/i.test(all), 'dùng "thành thạo"');
});

test('Sổ tay: câu ngắn (tối đa 20 chữ mỗi câu, Q1 trong HUONG-DAN-VIET)', () => {
  for (const t of textsOf(data)) {
    const text = G.resolve(t, ctx).text;
    for (const sentence of text.split(/(?<=[.!?:])\s+/)) {
      const words = sentence.trim().split(/\s+/).filter(Boolean).length;
      assert.ok(words <= 20, `Câu quá dài (${words} chữ): ${sentence}`);
    }
  }
});

test('Sổ tay: index.html có nút "?", hộp #dlg-guide, guide.js nạp trước app.js, guide.css', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  assert.match(html, /id="btnGuide"/);
  assert.match(html, /<dialog[^>]*id="dlg-guide"/);
  assert.match(html, /css\/guide\.css\?v=/);
  const g = html.indexOf('/js/guide.js?v='), a = html.indexOf('/js/app.js?v=');
  assert.ok(g > 0 && a > g, 'guide.js phải nạp trước app.js');
  // Sổ tay không dùng innerHTML với dữ liệu
  assert.ok(!/innerHTML/.test(fs.readFileSync(path.join(ROOT, 'public/js/guide.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')), 'guide.js không được dùng innerHTML');
});
