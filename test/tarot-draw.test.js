'use strict';
/* Rút tarot (lib/tarot-draw.js): hạt giống theo ngày, 5 lá khác nhau, kiểm đầu vào, cờ "again". Logic thuần, không cần máy chủ. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAsk, tarotSeed, drawCards, createTarotDrawer, DECK_SIZE, SPREAD } = require('../lib/tarot-draw');

test('hạt giống: cùng đầu vào thì giống nhau; đổi ngày, chủ đề, khung, tình trạng hoặc uid thì khác', () => {
  const base = tarotSeed('uid-a', '2026-11-11', 'career', 30, '');
  assert.equal(base, tarotSeed('uid-a', '2026-11-11', 'career', 30, ''));
  assert.match(base, /^[0-9a-f]{64}$/);
  const others = [
    tarotSeed('uid-b', '2026-11-11', 'career', 30, ''),
    tarotSeed('uid-a', '2026-11-12', 'career', 30, ''),
    tarotSeed('uid-a', '2026-11-11', 'work', 30, ''),
    tarotSeed('uid-a', '2026-11-11', 'career', 7, ''),
    tarotSeed('uid-a', '2026-11-11', 'love', 30, 'single'),
    tarotSeed('uid-a', '2026-11-11', 'love', 30, 'couple')
  ];
  for (const s of others) assert.notEqual(s, base);
  assert.equal(new Set(others).size, others.length);
});

test('rút 5 lá khác nhau trong 0..77, ổn định theo hạt giống', () => {
  for (let i = 0; i < 300; i++) {
    const cards = drawCards(tarotSeed('uid-' + i, '2026-11-11', 'overview', 30, ''));
    assert.equal(cards.length, SPREAD);
    const ids = cards.map(c => c.id);
    assert.equal(new Set(ids).size, SPREAD, 'không trùng lá');
    for (const c of cards) {
      assert.ok(Number.isInteger(c.id) && c.id >= 0 && c.id < DECK_SIZE);
      assert.equal(typeof c.rev, 'boolean');
    }
    assert.deepEqual(cards, drawCards(tarotSeed('uid-' + i, '2026-11-11', 'overview', 30, '')));
  }
});

test('phân bố tạm đều: đủ cả lá xuôi lẫn ngược, và không lá nào áp đảo', () => {
  const count = new Array(DECK_SIZE).fill(0);
  let rev = 0, total = 0;
  for (let i = 0; i < 4000; i++) {
    for (const c of drawCards(tarotSeed('u' + i, '2026-11-11', 'money', 7, ''))) { count[c.id]++; total++; if (c.rev) rev++; }
  }
  const mean = total / DECK_SIZE;
  assert.ok(Math.min(...count) > mean * 0.6 && Math.max(...count) < mean * 1.4, 'mỗi lá xuất hiện gần mức trung bình');
  assert.ok(rev / total > 0.45 && rev / total < 0.55, 'khoảng một nửa là lá ngược');
});

test('createTarotDrawer: lần 2 trong ngày có again, khác ngày thì khác kết quả và again=false', () => {
  let day = '2026-11-11';
  const d = createTarotDrawer({ vnDay: () => day });
  const ask = { topic: 'health', span: 90, status: '' };
  const r1 = d.draw('uid-a', ask);
  assert.equal(r1.again, false);
  const r2 = d.draw('uid-a', ask);
  assert.equal(r2.again, true);
  assert.deepEqual(r2.cards, r1.cards);
  assert.equal(d.draw('uid-a', { topic: 'health', span: 30, status: '' }).again, false, 'khung khác là câu hỏi khác');
  assert.equal(d.draw('uid-b', ask).again, false, 'người khác');
  day = '2026-11-12';
  const r3 = d.draw('uid-a', ask);
  assert.equal(r3.again, false, 'sang ngày mới');
  assert.notDeepEqual(r3.cards, r1.cards, 'ngày khác thì quẻ khác');
});

test('createTarotDrawer: vượt ngưỡng ghi nhớ vẫn giữ again đúng cho người còn gần đây, mọi tổ hợp câu hỏi', () => {
  const d = createTarotDrawer({ vnDay: () => '2026-11-11' });
  const ask = { topic: 'love', span: 90, status: 'couple' };
  const ask2 = { topic: 'love', span: 90, status: 'single' };
  d.draw('uid-sớm', ask2);
  for (let i = 0; i < 50010; i++) d.draw('uid-' + i, ask);   // vượt MAX_REMEMBER (50.000)
  assert.equal(d.draw('uid-50009', ask).again, true, 'người mới rút vẫn được nhớ, không bị xoá cả lịch sử');
  assert.equal(d.draw('uid-50009', ask2).again, false, 'tổ hợp khác (status) là câu hỏi khác');
  assert.equal(d.draw('uid-50009', ask2).again, true);
  assert.equal(d.draw('uid-50000', ask).again, true);
});

test('normalizeAsk: chỉ nhận 8 chủ đề, span 7/30/90, love bắt buộc có status', () => {
  for (const topic of ['overview', 'career', 'work', 'money', 'family', 'health', 'study']) {
    assert.deepEqual(normalizeAsk({ topic, span: 30, status: 'couple' }), { ok: true, topic, span: 30, status: '' }, 'status bị bỏ nếu không phải love');
  }
  assert.deepEqual(normalizeAsk({ topic: 'love', span: 7, status: 'single' }), { ok: true, topic: 'love', span: 7, status: 'single' });
  assert.equal(normalizeAsk({ topic: 'love', span: 7 }).ok, false);
  assert.equal(normalizeAsk({ topic: 'love', span: 7, status: 'x' }).ok, false);
  for (const bad of [null, undefined, 'love', 5, [], {}, { topic: 'x', span: 30 }, { topic: '__proto__', span: 30 }, { topic: 'constructor', span: 30 },
    { topic: ['career'], span: 30 }, { topic: 'career' }, { topic: 'career', span: 14 }, { topic: 'career', span: '30' }, { topic: 'career', span: 30.5 }]) {
    const r = normalizeAsk(bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.ok(r.reason);
  }
});
