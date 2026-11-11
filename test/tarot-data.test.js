'use strict';
// Kiểm nội dung 78 lá tarot (public/data/tarot.vi.json): đủ trường, id đúng quy ước, không câu trùng, độ dài hợp lý, không HTML.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'tarot.vi.json'), 'utf8'));
const TOPIC_KEYS = ['overview', 'career', 'work', 'money', 'love_single', 'love_couple', 'family', 'health', 'study'];
const SUITS = ['wands', 'cups', 'swords', 'pentacles'];

/** Bỏ tiền tố/đuôi lời khuyên để so phần lõi. */
function loi(s) {
  return s.replace(/^(Điều nên làm trước hết là|Chưa cần vội, bạn có thể|Điều nhẹ nhàng nhất lúc này là|Trước hết, hãy|Chỉ cần|Hãy)\s+/, '').replace(/[.,;]\s*$/, '').toLowerCase();
}

/** Gom mọi câu (kèm đường dẫn) cần kiểm độ dài/trùng. */
function sentences() {
  const list = [];
  for (const c of data.cards) {
    for (const o of ['up', 'rev']) {
      list.push([`${c.id}.general.${o}`, c.general[o]], [`${c.id}.advice.${o}`, c.advice[o]]);
      for (const t of TOPIC_KEYS) list.push([`${c.id}.${t}.${o}`, c.topic[t][o]]);
    }
  }
  const s = data.synthesis;
  for (const k of ['majorMany', 'majorNone', 'reversedMany', 'courtMany', 'adviceLead', 'outlookLead']) list.push([`synthesis.${k}`, s[k]]);
  for (const [k, v] of Object.entries(s.suit)) list.push([`synthesis.suit.${k}`, v]);
  for (const [k, v] of Object.entries(s.closing)) list.push([`synthesis.closing.${k}`, v]);
  return list;
}

test('tarot: khung chung và 78 lá', () => {
  assert.equal(data.version, 1);
  assert.match(data.source, /Waite/);
  assert.equal(data.cards.length, 78);
  assert.deepEqual(Object.keys(data.positions), ['present', 'obstacle', 'support', 'advice', 'outlook']);
  for (const v of Object.values(data.positions)) assert.ok(typeof v === 'string' && v.trim().length > 0, 'câu dẫn vị trí rỗng');
  assert.deepEqual(Object.keys(data.synthesis.suit), SUITS);
  for (const k of ['overview', 'career', 'work', 'money', 'love', 'family', 'health', 'study']) {
    assert.ok(data.synthesis.closing[k], `thiếu câu kết ${k}`);
  }
});

test('tarot: id, bộ, hạng đúng quy ước', () => {
  data.cards.forEach((c, i) => {
    assert.equal(c.id, i);
    if (i < 22) {
      assert.equal(c.arcana, 'major');
      assert.equal(c.suit, null);
      assert.equal(c.rank, i);
    } else {
      assert.equal(c.arcana, 'minor');
      assert.equal(c.suit, SUITS[Math.floor((i - 22) / 14)]);
      assert.equal(c.rank, ((i - 22) % 14) + 1);
    }
  });
  assert.equal(data.cards[8].vi, 'Sức Mạnh');
  assert.equal(data.cards[11].vi, 'Công Lý');
  assert.equal(data.cards[35].vi, 'Vua Gậy');
  assert.equal(data.cards[77].vi, 'Vua Tiền');
  assert.equal(new Set(data.cards.map((c) => c.vi)).size, 78, 'tên Việt phải khác nhau');
  assert.equal(new Set(data.cards.map((c) => c.en)).size, 78, 'tên Anh phải khác nhau');
});

test('tarot: mỗi lá đủ trường, không chuỗi rỗng', () => {
  for (const c of data.cards) {
    assert.ok(c.vi && c.en, `lá ${c.id} thiếu tên`);
    for (const o of ['up', 'rev']) {
      for (const [name, v] of [['keys', c.keys[o]], ['general', c.general[o]], ['advice', c.advice[o]]]) {
        assert.equal(typeof v, 'string', `lá ${c.id} ${name}.${o}`);
        assert.ok(v.trim().length > 0, `lá ${c.id} ${name}.${o} rỗng`);
      }
    }
    assert.deepEqual(Object.keys(c.topic), TOPIC_KEYS, `lá ${c.id} sai khóa chủ đề`);
  }
});

test('tarot: câu dài 20–260 ký tự, không HTML', () => {
  for (const [where, s] of sentences()) {
    assert.equal(typeof s, 'string', where);
    assert.ok(s.trim() === s && s.length >= 20 && s.length <= 260, `${where} dài ${s.length}: ${s}`);
    assert.ok(!/[<>]/.test(s), `${where} có ký tự HTML`);
  }
});

test('tarot: không có câu trùng', () => {
  const seen = new Map();
  for (const [where, s] of sentences()) {
    assert.ok(!seen.has(s), `${where} trùng với ${seen.get(s)}: ${s}`);
    seen.set(s, where);
  }
});

test('tarot: lời nhắc giới hạn cho sức khỏe và tiền bạc', () => {
  assert.match(data.synthesis.closing.health, /thầy thuốc/);
  assert.match(data.synthesis.closing.money, /không phải lời khuyên/);
});

test('tarot: mọi lá viết không gây sợ, không phán chắc', () => {
  const hu = /tử vong|lìa đời|tai họa|thảm họa|bị nguyền|quỷ ám|địa ngục|bệnh nặng|bệnh hiểm|hiểm nghèo|tai nạn|qua khỏi|phá sản|ly hôn|quá muộn|trước khi nó đổ|chết/i;
  for (const c of data.cards) {
    // "cái chết thật" chỉ được nhắc để phủ định; tên lá Cái Chết là đầu vào hợp lệ.
    const all = JSON.stringify(c).replace(/không nói về (?:bệnh tật hay )?cái chết thật/g, '').replace(/Cái Chết/g, '');
    assert.ok(!hu.test(all), `lá ${c.vi} có từ gây sợ: ${all.match(hu)}`);
  }
  for (const i of [13, 15, 16, 52, 58, 59, 68]) {
    assert.ok(!/sẽ gặp|đang chờ bạn/.test(JSON.stringify(data.cards[i])), `lá ${data.cards[i].vi} phán chắc`);
  }
  assert.match(data.cards[13].general.up, /không nói về cái chết thật/);
  for (const o of ['up', 'rev']) {
    assert.match(data.cards[13].topic.health[o], /không nói về bệnh tật hay cái chết thật/, `13.health.${o} phải giải thích không phải chết thật`);
  }
});

test('tarot: chiều ngược mang nghĩa hồi phục/giải thoát không dùng khung "vướng/làm chậm lại"', () => {
  const xau = /vướng|làm chậm lại|bị chặn/;
  for (const i of [15, 18, 31, 39, 40, 42, 51, 52, 54, 57, 59, 68]) {
    const c = data.cards[i];
    for (const t of TOPIC_KEYS) assert.ok(!xau.test(c.topic[t].rev), `${c.id}.${t}.rev dùng khung xấu: ${c.topic[t].rev}`);
    assert.ok(!xau.test(c.general.rev) && !xau.test(c.advice.rev), `lá ${c.vi}: general/advice ngược dùng khung xấu`);
  }
});

test('tarot: ngữ pháp, lời khuyên và câu chủ đề', () => {
  const all = JSON.stringify(data);
  assert.ok(!/nên không |[Hh]ãy không /.test(all), 'còn "nên không"/"hãy không"');
  assert.ok(!/[<>]/.test(all), 'có ký tự HTML trong dữ liệu');
  for (const c of data.cards) {
    for (const o of ['up', 'rev']) {
      // Câu dẫn positions.advice đã có "Thầy khuyên bạn…", dữ liệu không lặp lại.
      assert.ok(!/^Thầy khuyên bạn/.test(c.advice[o]), `${c.id}.advice.${o} lặp tiền tố "Thầy khuyên bạn"`);
      const core = loi(c.advice[o]);
      for (const t of TOPIC_KEYS) {
        assert.ok(!loi(c.topic[t][o]).includes(core), `${c.id}.${t}.${o} chép lại lõi lời khuyên`);
      }
    }
  }
  // Mẫu ngữ pháp hỏng do ghép khuôn.
  assert.ok(!/[Hh]ãy đừng|nên đừng|có thể đừng|là đừng/.test(all), 'còn "hãy đừng/nên đừng/có thể đừng/là đừng"');
  assert.ok(!/trước khi[^.]*trước khi/.test(all), 'lặp "trước khi … trước khi"');
  assert.ok(!/đang chờ[^.]*đang chờ/.test(all), 'lặp "đang chờ … đang chờ"');
  assert.ok(!/đang chờ bạn/.test(all), 'giọng phán chắc "đang chờ bạn"');
});

test('tarot: câu mở đầu riêng của mỗi câu chủ đề không trùng ở cấp câu', () => {
  // Câu đầu của mỗi câu chủ đề mang nghĩa riêng của lá; câu kết là lời gợi chung theo chủ đề nên được phép lặp.
  const seen = new Map();
  for (const c of data.cards) {
    for (const o of ['up', 'rev']) {
      for (const t of TOPIC_KEYS) {
        const first = c.topic[t][o].split(/(?<=\.)\s+/)[0];
        const key = `${t}:${first}`;
        assert.ok(!seen.has(key), `${c.id}.${t}.${o} trùng câu đầu với ${seen.get(key)}: ${first}`);
        seen.set(key, `${c.id}.${t}.${o}`);
      }
    }
  }
});

test('tarot: tên 22 lá Ẩn chính, mẫu tên Ẩn phụ và độ dài câu dẫn vị trí', () => {
  const majors = ['Chàng Khờ', 'Nhà Ảo Thuật', 'Nữ Tư Tế', 'Hoàng Hậu', 'Hoàng Đế', 'Giáo Hoàng', 'Tình Nhân', 'Cỗ Xe', 'Sức Mạnh', 'Ẩn Sĩ', 'Bánh Xe Số Phận', 'Công Lý', 'Người Treo Ngược', 'Cái Chết', 'Tiết Độ', 'Ác Quỷ', 'Tòa Tháp', 'Ngôi Sao', 'Mặt Trăng', 'Mặt Trời', 'Phán Xét', 'Thế Giới'];
  majors.forEach((n, i) => assert.equal(data.cards[i].vi, n));
  const ranks = ['Át', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Tiểu Đồng', 'Hiệp Sĩ', 'Nữ Hoàng', 'Vua'];
  const suitVi = { wands: 'Gậy', cups: 'Cốc', swords: 'Kiếm', pentacles: 'Tiền' };
  for (let i = 22; i < 78; i++) {
    const c = data.cards[i];
    assert.equal(c.vi, `${ranks[c.rank - 1]} ${suitVi[c.suit]}`);
  }
  for (const v of Object.values(data.positions)) assert.ok(v.length >= 10, 'câu dẫn vị trí quá ngắn');
});
