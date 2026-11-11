'use strict';
// Kiểm hàm tổng hợp lời thầy của tarot (public/js/tarot.js, KH §7.2 bước 4) trên dữ liệu thật.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Tarot = require('../public/js/tarot.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'tarot.vi.json'), 'utf8'));
const s = data.synthesis;
const up = ids => ids.map(id => ({ id, rev: false }));

test('topicKey: tình duyên tách theo tình trạng', () => {
  assert.equal(Tarot.topicKey('love', 'couple'), 'love_couple');
  assert.equal(Tarot.topicKey('love', 'single'), 'love_single');
  assert.equal(Tarot.topicKey('money', ''), 'money');
});

test('từ 3 lá Ẩn chính: câu majorMany, không có majorNone', () => {
  const out = Tarot.synthesize(data, up([0, 1, 2, 50, 64]), 'overview', '');
  assert.ok(out.includes(s.majorMany));
  assert.ok(!out.includes(s.majorNone));
});

test('không lá Ẩn chính: câu majorNone', () => {
  const out = Tarot.synthesize(data, up([22, 36, 50, 64, 23]), 'overview', '');
  assert.ok(out.includes(s.majorNone));
  assert.ok(!out.includes(s.majorMany));
});

test('1–2 lá Ẩn chính: không câu Ẩn chính nào', () => {
  const out = Tarot.synthesize(data, up([0, 1, 50, 64, 36]), 'overview', '');
  assert.ok(!out.includes(s.majorMany) && !out.includes(s.majorNone));
});

test('bộ chiếm từ 2 lá được nhắc; mỗi bộ đúng câu của nó', () => {
  const out = Tarot.synthesize(data, up([22, 23, 36, 50, 64]), 'overview', '');
  assert.ok(out.includes(s.suit.wands));
  assert.ok(!out.includes(s.suit.cups));
});

test('từ 3 lá ngược: reversedMany; 2 lá ngược thì không', () => {
  const mk = n => [0, 22, 36, 50, 64].map((id, i) => ({ id, rev: i < n }));
  assert.ok(Tarot.synthesize(data, mk(3), 'overview', '').includes(s.reversedMany));
  assert.ok(!Tarot.synthesize(data, mk(2), 'overview', '').includes(s.reversedMany));
});

test('từ 2 lá Hoàng gia (rank ≥ 11, không tính Ẩn chính): courtMany', () => {
  // 32 = Tiểu Đồng Gậy (rank 11), 46 = Tiểu Đồng Cốc (rank 11)
  const out = Tarot.synthesize(data, up([32, 46, 3, 57, 70]), 'overview', '');
  assert.ok(out.includes(s.courtMany));
  const one = Tarot.synthesize(data, up([32, 40, 3, 57, 70]), 'overview', '');
  assert.ok(!one.includes(s.courtMany));
});

test('lá Ẩn chính có rank 11–14 không bị tính là Hoàng gia', () => {
  const out = Tarot.synthesize(data, up([11, 12, 13, 14, 15]), 'overview', '');
  assert.ok(!out.includes(s.courtMany));
});

test('luôn nhắc lá Lời khuyên (vị trí 4) và Xu hướng (vị trí 5), kết theo chủ đề', () => {
  const draw = [{ id: 0, rev: false }, { id: 22, rev: false }, { id: 36, rev: false }, { id: 50, rev: true }, { id: 64, rev: false }];
  const out = Tarot.synthesize(data, draw, 'health', '');
  assert.ok(out.some(x => x.includes(data.cards[50].advice.rev)));
  assert.ok(out.some(x => x.includes(Tarot.cardText(data.cards[64], 'health', '', false))));
  assert.equal(out[out.length - 1], s.closing.health);
});

test('lá hạng 10 không bị tính là Hoàng gia (biên rank 11)', () => {
  const ids = data.cards.map((c, id) => ({ c, id })).filter(x => x.c.arcana !== 'major' && x.c.rank === 10).map(x => x.id);
  assert.ok(ids.length >= 2);
  const out = Tarot.synthesize(data, up([ids[0], ids[1], 3, 57, 70]), 'overview', '');
  assert.ok(!out.includes(s.courtMany));
});

test('ca 1–2 lá Ẩn chính, ít dấu hiệu: vẫn đủ 5 dòng, có lá Hiện tại', () => {
  const out = Tarot.synthesize(data, up([0, 22, 36, 50, 64]), 'overview', '');
  assert.ok(out.length >= 5, `số dòng ${out.length}`);
  assert.ok(out.some(x => x.includes(Tarot.cardText(data.cards[0], 'overview', '', false))));
});

test('độ dài 5–8 dòng với mọi chủ đề và nhiều bộ bài ngẫu nhiên (tất định)', () => {
  let seed = 7;
  const rnd = n => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
  for (let k = 0; k < 400; k++) {
    const ids = new Set();
    while (ids.size < 5) ids.add(rnd(78));
    const draw = [...ids].map(id => ({ id, rev: rnd(2) === 1 }));
    const topic = Tarot.TOPICS[rnd(8)];
    const out = Tarot.synthesize(data, draw, topic, topic === 'love' ? 'couple' : '');
    assert.ok(out.length >= 5 && out.length <= 8, `số câu ${out.length}`);
    assert.ok(out.every(x => typeof x === 'string' && x.length > 0));
  }
});

test('chủ đề tình duyên dùng đúng khóa theo tình trạng', () => {
  const card = data.cards[0];
  assert.equal(Tarot.cardText(card, 'love', 'couple', false), card.topic.love_couple.up);
  assert.equal(Tarot.cardText(card, 'love', 'single', true), card.topic.love_single.rev);
});
