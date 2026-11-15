'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('khung chat bỏ tin quá 24 giờ khi để mở và giữ 512 tin mới nhất', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public/js/app.js'), 'utf8');
  const chat = app.slice(app.indexOf('  let chatExpiryTimer;'), app.indexOf('  const isMod ='));
  const rows = [];
  const feed = {
    get firstElementChild() { return rows[0]; },
    get childElementCount() { return rows.length; },
    appendChild(row) { rows.push(row); }
  };
  const day = 24 * 60 * 60 * 1000;
  let now = 2 * day;
  let timer;
  const context = {
    $: () => feed,
    cfg: { chatHistory: { maxAgeMs: day, maxMessages: 512 } },
    document: {
      addEventListener() {},
      createElement() {
        return { dataset: {}, remove() { rows.splice(rows.indexOf(this), 1); } };
      }
    },
    serverNow: () => now,
    clearTimeout: () => { timer = undefined; },
    setTimeout(callback, delay) { timer = { callback, delay }; }
  };
  vm.runInNewContext(chat, context);
  const add = (id, t) => context.addMsg({ id, t, sys: true, text: 'Chào đạo hữu' });
  add(1, now - day - 1);
  add(2, now - day + 500);
  context.pruneChat();
  assert.deepEqual(rows.map(row => row.dataset.id), [2]);
  assert.equal(timer.delay, 501);
  now += timer.delay;
  timer.callback();
  assert.equal(rows.length, 0);
  assert.equal(timer, undefined);

  for (let id = 3; id <= 515; id++) {
    add(id, now);
    context.pruneChat();
  }
  assert.equal(rows.length, 512);
  assert.equal(rows[0].dataset.id, 4);
  assert.equal(rows.at(-1).dataset.id, 515);
});

test('máy chủ lọc tuổi tin và tin ẩn trước khi lấy 512 tin, vẫn giữ tin gần đây để kiểm duyệt', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const limits = server.slice(server.indexOf('const CHAT_HISTORY ='), server.indexOf('const SEPAY_API_KEY ='));
  const helpers = server.slice(server.indexOf('function recentChat('), server.indexOf('function sys('));
  const day = 24 * 60 * 60 * 1000;
  const now = 2 * day;
  const expired = { id: 1, t: now - day - 1 };
  const edge = { id: 2, t: now - day };
  const hidden = { id: 3, t: now, hidden: true };
  const db = { chat: [expired, edge, hidden] };
  const sent = [];
  const context = {
    db, publicMsg: m => m.id, store: { save() {} },
    io: { emit: (event, id) => sent.push({ event, id }) }
  };
  vm.runInNewContext(limits + helpers, context);
  const history = () => Array.from(context.recentChat(now));
  assert.deepEqual(history(), [edge.id]);

  const visible = Array.from({ length: 1002 }, (_, i) => ({ id: i + 4, t: now }));
  const hiddenRecent = Array.from({ length: 251 }, (_, i) => ({ id: i + 1006, t: now, hidden: true }));
  db.chat.push(...visible, ...hiddenRecent);
  assert.deepEqual(history(), visible.slice(-512).map(m => m.id));
  const newest = { id: 1257, t: now, sys: true };
  context.appendChat(newest);
  assert.deepEqual(history(), [...visible.slice(-511).map(m => m.id), newest.id]);
  assert.deepEqual(sent, [{ event: 'chat', id: newest.id }]);
  assert.equal(db.chat.filter(m => !m.hidden).length, 512);
  assert.ok(db.chat.includes(hiddenRecent.at(-1)));
});
