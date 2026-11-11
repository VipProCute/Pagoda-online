'use strict';
/*
 * Thanh lễ Phật và tab Khám phá (T-011): kiểm tĩnh trên mã nguồn giao diện, vì không có trình duyệt trong test.
 * Giữ cho các hành vi dễ bị phá âm thầm: đúng 9 nút lễ, thẻ trò phụ ẩn theo cờ tính năng, lễ khác map báo đúng lúc,
 * hộp tiếng không mất đường mở "Người gần" ở các cảnh trong chùa.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('public/index.html');
const app = read('public/js/app.js');
const css = read('public/css/style.css');

test('thanh lễ Phật có đúng 9 nút theo thứ tự, không còn nút trò phụ', () => {
  const nav = html.match(/<nav class="actions"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'phải có <nav class="actions">');
  const acts = [...nav[1].matchAll(/data-act="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(acts, ['incense', 'voice', 'flower', 'heart', 'bow', 'mo', 'bell', 'chant', 'donate']);
  for (const f of ['public/index.html', 'public/js/app.js', 'public/css/style.css', 'public/css/places.css']) {
    assert.doesNotMatch(read(f), /actDojo|actArena/, `${f} không còn id nút cũ`);
  }
});

test('thẻ Võ Học Các / Sân đấu ẩn theo cờ tính năng khi vào chùa', () => {
  assert.match(app, /\[data-place-card\][\s\S]{0,80}c\.hidden = !\(c\.dataset\.placeCard === 'dojo' \? mc\.enabled : c\.dataset\.placeCard === 'arena' \? mc\.pk : true\)/);
  assert.match(html, /data-place-card="dojo"/);
  assert.match(html, /data-place-card="arena"/);
});

test('thông báo lễ dâng ở chánh điện chỉ hiện khi máy chủ chấp nhận tiếng chuông của chính mình', () => {
  const caseBell = app.match(/case 'bell':[^\n]*/)[0];
  assert.doesNotMatch(caseBell, /toast|altarNote/, 'bấm nút không báo ngay');
  assert.match(app, /socket\.on\('bell', d => \{[^\n]*d\.pid === me && altarNote\(\)\) toast/);
});

test('lễ dâng chỉ báo "ở chánh điện" khi đang ở cảnh khác chánh điện', () => {
  assert.match(app, /function altarNote\(\) \{ return curScene !== 'hall' \? ' Lễ đã dâng/);
});

test('≤480px thanh lễ thành lưới 2 hàng, hộp tiếng và toast nâng lên trên thanh', () => {
  const m = css.match(/@media \(max-width: 480px\) \{\s*\.voicebar \{ bottom: calc\((\d+)px[^}]*\}\s*\.toast \{ bottom: calc\((\d+)px/);
  assert.ok(m, 'phải có khối nâng .voicebar và .toast ở ≤480px');
  assert.ok(Number(m[1]) >= 118 && Number(m[2]) >= Number(m[1]), 'cao hơn thanh 2 hàng');
});

test('toast thắp nhang và ack lễ vật đều kèm altarNote()', () => {
  assert.match(app, /toast\('Đã thắp nhang[^\n]*\+ altarNote\(\)\)/);
  const offer = app.match(/socket\.emit\('offer'[\s\S]*?\}\)\);/);
  assert.ok(offer, 'phải có emit offer');
  assert.match(offer[0], /if \(altarNote\(\)\) toast\(altarNote\(\)\.trim\(\)\)/);
});

test('≤480px lưới thanh lễ 5 cột, nút chạm tối thiểu 44px', () => {
  const blk = css.match(/@media \(max-width: 480px\) \{\s*\.actions \{([^}]*)\}\s*\.act \{([^}]*)\}/);
  assert.ok(blk, 'phải có khối .actions/.act ở ≤480px');
  assert.match(blk[1], /display: grid/);
  assert.match(blk[1], /grid-template-columns: repeat\(5,/);
  const mh = blk[2].match(/min-height: (\d+)px/);
  assert.ok(mh && Number(mh[1]) >= 44, '.act cao ít nhất 44px');
});

test('hộp tiếng tự thu nhỏ sau 6 giây', () => {
  assert.match(app, /vbTimer = setTimeout\(\(\) => vb\.classList\.add\('mini'\), 6000\)/);
});

test('hộp tiếng ngoài Võ Học Các / Sân đấu chỉ ẩn nút mic, giữ khung và nút Người gần', () => {
  assert.match(css, /body:not\(\[data-place="dojo"\]\):not\(\[data-place="arena"\]\) #vbMic \{ display: none; \}/);
  assert.doesNotMatch(css, /\) \.voicebar \{ display: none; \}/);
  assert.match(css, /\.voicebar\.mini #vbList \{ display: inline-flex; \}/);
});
