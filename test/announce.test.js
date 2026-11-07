'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const announce = require('../lib/announce');

test('các mẫu thông báo luôn khớp tên, số tiền và lời đọc', () => {
  const original = Math.random;
  const texts = new Set();
  try {
    for (let i = 0; i < 8; i++) {
      Math.random = () => (i + 0.5) / 8;
      const msg = announce.compose({ name: 'Minh An', amount: 150000, anon: false, hide: false }, null, null);
      texts.add(msg.text);
      assert.match(msg.text, /Phật tử Minh An/);
      assert.match(msg.text, /150\.000đ/);
      assert.match(msg.speak, /Phật tử Minh An/);
      assert.match(msg.speak, /một trăm năm mươi nghìn đồng/);
      const anon = announce.compose({ name: 'Tên bí mật', amount: 150000, anon: true, hide: false }, null, null);
      for (const value of [anon.text, anon.speak]) {
        assert.match(value, /Phật tử hảo tâm/);
        assert.doesNotMatch(value, /Tên bí mật/);
      }
      assert.match(anon.text, /150\.000đ/);
      const hidden = announce.compose({ name: 'Minh An', amount: 150000, hide: true }, null, null);
      assert.doesNotMatch(hidden.text, /150\.000/);
      assert.doesNotMatch(hidden.speak, /một trăm năm mươi nghìn/);
    }
  } finally { Math.random = original; }
  assert.equal(texts.size, 8);
});

test('thông báo đột phá hào quang vẫn được thêm vào', () => {
  const msg = announce.compose({ name: 'Minh An', amount: 10000 }, { up: true }, { name: 'Kim Quang' });
  assert.match(msg.text, /Minh An đột phá cảnh giới Kim Quang/);
  assert.match(msg.speak, /Minh An đã đột phá cảnh giới Kim Quang/);
});
