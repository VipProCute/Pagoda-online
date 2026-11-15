'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer } = require('./helpers/live');
const { connect, call, join, waitFor } = require('./helpers/client');

const DAY = 24 * 60 * 60 * 1000;
const message = (id, t, extra) => ({ id, t, pid: 1, name: 'Minh Tâm', c: 0, text: 'A Di Đà Phật', ...extra });

async function openChat(t, messages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pagoda-chat-'));
  const file = path.join(dir, 'db.json');
  fs.writeFileSync(file, JSON.stringify({ chat: messages }));
  let server;
  const sockets = [];
  t.after(async () => {
    sockets.forEach(socket => socket.close());
    if (server) await server.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  server = await startServer({ DATA_FILE: file });
  return {
    server,
    async enter() {
      const socket = await connect(server.port);
      sockets.push(socket);
      const welcome = await join(socket, 'Minh Tâm', 'uid-chat-history01');
      assert.ok(welcome.ok, welcome.reason);
      return { socket, welcome };
    }
  };
}

test('lịch sử chat loại tin quá 24 giờ và tin đã ẩn dù chưa đủ 512 tin', async t => {
  const now = Date.now();
  const chat = await openChat(t, [
    message(1, now - DAY - 60000),
    message(2, now - DAY + 60000),
    message(3, now - 2000, { hidden: true }),
    message(4, now - 1000, { sys: true })
  ]);
  const { welcome } = await chat.enter();
  assert.deepEqual(welcome.config.chatHistory, { maxAgeMs: DAY, maxMessages: 512 });
  assert.deepEqual(welcome.chat.map(m => m.id), [2, 4]);
  const admin = await chat.server.admin('/api/admin/summary');
  assert.equal(admin.status, 200);
  assert.ok(admin.json.chat.some(m => m.id === 1));
  assert.ok(admin.json.chat.some(m => m.id === 3 && m.hidden));
});

test('lịch sử chat giữ 512 tin gần nhất theo thứ tự, kể cả sau khi nhận tin mới', async t => {
  const now = Date.now();
  const messages = Array.from({ length: 1253 }, (_, i) => message(i + 1, now - 2000 + i, { hidden: i >= 1002 }));
  const visible = messages.filter(m => !m.hidden);
  const chat = await openChat(t, messages);
  const { socket, welcome } = await chat.enter();
  assert.deepEqual(welcome.chat.map(m => m.id), visible.slice(-512).map(m => m.id));
  const received = waitFor(socket, 'chat', m => m.text === 'Chúc mọi người an lạc');
  assert.ok((await call(socket, 'chat', { text: 'Chúc mọi người an lạc' })).ok);
  const newest = await received;
  const rejoin = (await chat.enter()).welcome;
  assert.deepEqual(rejoin.chat.map(m => m.id), [...visible.slice(-511).map(m => m.id), newest.id]);
});
