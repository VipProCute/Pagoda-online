'use strict';
/*
 * Chạy server.js thật với DATABASE_URL (PostgreSQL thật, schema riêng):
 * nhập file JSON cũ lần đầu, công đức cũ vẫn còn, tu luyện / học chiêu được ghi bền, khởi động lại vẫn nguyên.
 * Tự bỏ qua nếu không nối được PostgreSQL (đặt TEST_DATABASE_URL để chỉ chỗ khác).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client } = require('pg');
const { startServer } = require('./helpers/live');
const { connect, call, join, waitFor } = require('./helpers/client');

const BASE = process.env.TEST_DATABASE_URL || 'postgres://pagoda:pagoda@127.0.0.1:5432/pagoda_test?sslmode=disable';

test('PostgreSQL thật: nhập JSON cũ, ghi bền, khởi động lại vẫn nguyên', async t => {
  const admin = new Client({ connectionString: BASE });
  try { await admin.connect(); } catch (e) { return t.skip('Không nối được PostgreSQL: ' + e.message); }
  const schema = 'e2e_' + crypto.randomBytes(4).toString('hex');
  await admin.query(`CREATE SCHEMA ${schema}`);
  t.after(async () => { await admin.query(`DROP SCHEMA ${schema} CASCADE`).catch(() => {}); await admin.end().catch(() => {}); });

  const url = new URL(BASE);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chua-pg-'));
  const dataFile = path.join(dir, 'db.json');
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  fs.writeFileSync(dataFile, JSON.stringify({
    version: 1, day, seq: 500,
    merit: { 'khach-cu-0001': { name: 'Dieu Lien', total: 777, today: 7, day } },
    prayers: [{ id: 3, kind: 'Cầu an', text: 'Cầu cho gia đình bình an', name: 'Dieu Lien', t: 1, n: 2, by: [] }],
    donations: [{ code: 'CDOLD111', amount: 50000, fund: 'q0', fundName: 'Quy', name: 'Dieu Lien', status: 'confirmed', uid: 'khach-cu-0001', createdAt: 1, confirmedAt: 2 }]
  }));
  const srv = await startServer({
    DATABASE_URL: url.toString(), PG_SSL: '0', PG_FLUSH_MS: '300', DATA_FILE: dataFile,
    CULTIVATION_TIME_SCALE: '0.0001', BANK_ID: '970436', BANK_ACCOUNT: '0123456789', BANK_ACCOUNT_NAME: 'CHUA THU'
  });
  t.after(() => srv.stop());
  const open = [];
  t.after(() => open.forEach(s => s.close()));
  const enter = async () => { const socket = await connect(srv.port); open.push(socket); return { socket, join: await join(socket, 'Dieu Lien', 'khach-cu-0001') }; };

  let h = await (await fetch(srv.url + '/healthz')).json();
  assert.equal(h.db, 'pg');
  assert.equal(h.dbOk, true);

  // công đức cũ từ file JSON còn nguyên (đã nhập vào PostgreSQL)
  let c = await enter();
  assert.equal(c.join.merit.total, 777);
  assert.ok(c.join.prayers.some(p => p.text === 'Cầu cho gia đình bình an'));
  const imported = await admin.query(`SELECT value FROM ${schema}.schema_info WHERE key = 'imported_from_json'`);
  assert.equal(imported.rows.length, 1, 'ghi dấu đã nhập từ JSON');

  // tu luyện + học chiêu + cúng dường, ghi bền qua nhiều lần khởi động lại
  const ok = waitFor(c.socket, 'tu:update', u => u.kind === 'completed', 10000);
  assert.ok((await call(c.socket, 'tu:start', { methodId: 'tinh-tam-quyet', duration: '4h' })).ok);
  assert.equal((await ok).reward.congLuc, 45);
  const don = await call(c.socket, 'donate', { amount: 30000, fund: 'q0' });
  assert.ok(don.ok);
  assert.equal((await srv.admin(`/api/admin/donations/${don.code}/confirm`, 'POST')).status, 200);
  await new Promise(r => setTimeout(r, 800));     // đợi ghi nền
  const docs = await admin.query(`SELECT section, count(*)::int AS n FROM ${schema}.docs GROUP BY section ORDER BY section`);
  const bySec = Object.fromEntries(docs.rows.map(r => [r.section, r.n]));
  assert.ok(bySec.merit >= 1 && bySec.donations === 2 && bySec['martial.profiles'] === 1 && bySec['martial.sessions'] === 1, JSON.stringify(bySec));

  c.socket.close();
  await srv.restart();
  h = await (await fetch(srv.url + '/healthz')).json();
  assert.equal(h.dbOk, true);
  c = await enter();
  assert.ok(c.join.merit.total >= 777 + 30, 'công đức cũ + 30 điểm từ 30.000đ vừa cúng dường: ' + c.join.merit.total);
  const st = await call(c.socket, 'martial:state', {});
  assert.equal(st.profile.congLuc, 45);
  assert.equal(st.recent.length, 1);
  const sum = await call(c.socket, 'account:summary', {});
  assert.equal(sum.donated.count, 2, 'tịnh tài đã cúng dường (cũ và mới) còn nguyên');
  assert.equal(sum.donated.total, 80000);

  // khởi động lại lần nữa khi CSDL đã có dữ liệu: KHÔNG nhập lại file JSON, và id không lùi
  c.socket.close();
  await srv.restart();
  const c3 = await enter();
  assert.ok(c3.join.merit.total >= 777 + 30);
  const sum3 = await call(c3.socket, 'account:summary', {});
  assert.equal(sum3.donated.count, 2);
});
