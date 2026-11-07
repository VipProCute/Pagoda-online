#!/usr/bin/env node
'use strict';
/*
 * Công cụ dòng lệnh cho kho PostgreSQL (Neon): nhập từ JSON, đối chiếu, xuất ra JSON, thống kê.
 * Dùng biến môi trường DATABASE_URL (và PG_SSL nếu cần), ví dụ:  node --env-file=.env tools/db-migrate.js stats
 * Mật khẩu trong chuỗi kết nối luôn được che khi in.
 */
const fs = require('fs');
const path = require('path');
const S = require('../lib/store-sections');
const { createStore } = require('../lib/store');
const { createPool, maskUrl } = require('../lib/store-pg');

const USAGE = `Cách dùng:  node tools/db-migrate.js <lệnh> [tham số]

  import <file.json> [--replace --yes]
        Nhập file db.json cũ vào CSDL. Mặc định từ chối nếu CSDL đã có dữ liệu.
        --replace --yes: THAY TOÀN BỘ dữ liệu trong CSDL bằng nội dung file (xóa cả những gì file không có).
  verify <file.json>
        So file với CSDL: số lượng từng phần, tổng công đức, tổng tiền cúng dường đã xác nhận, số phiên đăng nhập,
        và nội dung từng tài liệu. In OK hoặc các khác biệt; thoát mã 1 nếu khác.
  export [out.json] [--with-sessions]
        Xuất CSDL ra file cùng hình dạng db.json (chạy lại được ở chế độ JSON, hoặc nhập lại).
        Mặc định KHÔNG ghi phiên đăng nhập (nhạy cảm); thêm --with-sessions nếu thật sự cần. out.json là "-" thì in ra màn hình.
  stats
        Đếm tài liệu và dung lượng từng phần.

Cần đặt DATABASE_URL. Chạy với file .env:  node --env-file=.env tools/db-migrate.js stats`;

const fmtN = n => Number(n).toLocaleString('vi-VN');
const fmtB = n => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
const say = (...a) => console.log(...a);
const errLog = { log: (...a) => console.error(...a), warn: (...a) => console.error(...a), error: (...a) => console.error(...a) };

class Stop extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}

function dbUrl() {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) throw new Stop(2, 'Chưa đặt DATABASE_URL (chuỗi kết nối Neon). Xem docs/NEON.md.');
  return url;
}
const openStore = readOnly => createStore({
  backend: 'pg', databaseUrl: dbUrl(), importJson: false, readOnly, log: errLog, ssl: process.env.PG_SSL
});

function readJson(file) {
  if (!file) throw new Stop(2, 'Thiếu đường dẫn file JSON.\n\n' + USAGE);
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (e) { throw new Stop(1, `Không đọc được ${file}: ${e.message}`); }
  let raw;
  try { raw = JSON.parse(text); }
  catch (e) { throw new Stop(1, `File ${file} không phải JSON hợp lệ: ${e.message}`); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Stop(1, `File ${file} không có dạng db.json (phải là một object).`);
  return raw;
}

/* ---- so sánh ---- */

function compare(a, b) {
  const ca = S.counts(a), cb = S.counts(b), ta = S.totals(a), tb = S.totals(b);
  const sa = S.snapshot(a), sb = S.snapshot(b);
  const rows = [];
  let diffs = 0;
  for (const s of S.SECTIONS) {
    const ma = sa.get(s.name), mb = sb.get(s.name);
    let only = 0, onlyDb = 0, changed = 0;
    for (const [k, x] of ma) {
      if (!mb.has(k)) only++;
      else if (S.canon(JSON.parse(x)) !== S.canon(JSON.parse(mb.get(k)))) changed++;
    }
    for (const k of mb.keys()) if (!ma.has(k)) onlyDb++;
    const na = s.kind === 'meta' ? 1 : ca[s.name], nb = s.kind === 'meta' ? 1 : cb[s.name];
    const ok = na === nb && !only && !onlyDb && !changed;
    if (!ok) diffs++;
    rows.push({ name: s.name, label: s.label, file: na, db: nb, only, onlyDb, changed, ok });
  }
  const sums = [
    ['Tổng công đức', ta.merit, tb.merit],
    ['Tổng tiền cúng dường đã xác nhận (đồng)', ta.donated, tb.donated],
    ['Số phiên đăng nhập', ta.sessions, tb.sessions]
  ].map(([label, f, d]) => ({ label, file: f, db: d, ok: f === d }));
  for (const x of sums) if (!x.ok) diffs++;
  return { rows, sums, diffs };
}

function report(r, fileLabel = 'Tệp') {
  const w = Math.max(...r.rows.map(x => x.name.length)) + 2;
  say(`${'Phần'.padEnd(w)}${fileLabel.padStart(10)}${'CSDL'.padStart(10)}  Ghi chú`);
  for (const x of r.rows) {
    const note = x.ok ? '' : `KHÁC${x.only ? `, chỉ có ở ${fileLabel.toLowerCase()}: ${x.only}` : ''}${x.onlyDb ? `, chỉ có ở CSDL: ${x.onlyDb}` : ''}${x.changed ? `, nội dung khác: ${x.changed}` : ''}`;
    say(`${x.name.padEnd(w)}${fmtN(x.file).padStart(10)}${fmtN(x.db).padStart(10)}  ${note}`);
  }
  say('');
  for (const x of r.sums) say(`${x.label}: ${fmtN(x.file)} (${fileLabel.toLowerCase()}) / ${fmtN(x.db)} (CSDL)${x.ok ? '' : '  <-- KHÁC'}`);
  say('');
  say(r.diffs ? `KHÁC BIỆT: ${r.diffs} mục không khớp.` : 'OK: mọi phần khớp.');
}

/* ---- các lệnh ---- */

async function cmdImport(file, flags) {
  const raw = readJson(file);
  const fileDb = S.repairSeq(S.adopt({}, raw));
  const extra = S.unknownKeys(fileDb);
  if (extra.length) console.error(`Cảnh báo: file có khóa mà kho không lưu (sẽ bị bỏ): ${extra.join(', ')}`);
  const store = openStore(false);
  try {
    await store.init();
    const have = store.docCount();
    say(`CSDL: ${maskUrl(dbUrl())}`);
    if (have > 0 && !flags.replace) {
      throw new Stop(1, `CSDL đã có ${fmtN(have)} tài liệu nên KHÔNG nhập (tránh đè dữ liệu đang chạy).\nMuốn thay toàn bộ bằng file này: thêm --replace --yes (nên xuất bản sao trước bằng lệnh export).`);
    }
    if (have > 0 && !flags.yes) {
      throw new Stop(1, `--replace sẽ XÓA ${fmtN(have)} tài liệu hiện có trong CSDL và thay bằng nội dung file. Thêm --yes để xác nhận.`);
    }
    say(`Đang nhập ${path.resolve(file)} ...`);
    const info = await store.importData(raw, { file: path.resolve(file) });
    say(`Đã nhập: ${Object.entries(info.counts).map(([k, v]) => `${k} ${fmtN(v)}`).join(', ')}.`);
    say('Đối chiếu lại với file:');
    const r = compare(fileDb, store.get());
    report(r);
    if (r.diffs) throw new Stop(1, 'Sau khi nhập vẫn có khác biệt, xem bảng trên.');
  } finally {
    await store.close();
  }
}

async function cmdVerify(file) {
  const fileDb = S.repairSeq(S.adopt({}, readJson(file)));
  const store = openStore(true);
  try {
    await store.init();
    say(`CSDL: ${maskUrl(dbUrl())}  ·  File: ${path.resolve(file)}`);
    if (!store.docCount()) say('(CSDL đang trống)');
    const r = compare(fileDb, store.get());
    report(r);
    if (r.diffs) throw new Stop(1, '');
  } finally {
    await store.close();
  }
}

async function cmdExport(out, flags) {
  const store = openStore(true);
  try {
    await store.init();
    const data = { ...store.get() };
    if (!flags['with-sessions']) delete data.authSessions;
    const text = JSON.stringify(data);
    const c = S.counts(store.get());
    if (out === '-') { process.stdout.write(text + '\n'); return; }
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const file = path.resolve(out || `pagoda-export-${stamp}.json`);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, text, { mode: 0o600 });
    fs.renameSync(tmp, file);
    say(`Đã xuất ${fmtB(Buffer.byteLength(text))} ra ${file}`);
    say(`  ${fmtN(c.merit)} người có công đức, ${fmtN(c.donations)} lượt cúng dường, ${fmtN(c.prayers)} lời nguyện, ${fmtN(c['martial.profiles'])} hồ sơ võ học`
      + (flags['with-sessions'] ? `, ${fmtN(c.authSessions)} phiên đăng nhập.` : '; không ghi phiên đăng nhập.'));
    say('File có thông tin cá nhân: giữ kín, đừng đưa lên GitHub.');
  } finally {
    await store.close();
  }
}

async function cmdStats() {
  const url = dbUrl();
  const pool = createPool(url, { ssl: process.env.PG_SSL });
  try {
    say(`CSDL: ${maskUrl(url)}`);
    const has = (await pool.query(`SELECT to_regclass('docs') IS NOT NULL AS ok`)).rows[0].ok;
    if (!has) { say('Chưa có bảng docs (máy chủ chưa chạy lần nào với CSDL này).'); return; }
    const r = await pool.query(`SELECT section, count(*)::int AS n, coalesce(sum(octet_length(v::text)), 0)::bigint AS bytes FROM docs GROUP BY section`);
    const by = new Map(r.rows.map(x => [x.section, x]));
    const names = S.SECTIONS.map(s => s.name).concat([...by.keys()].filter(k => !S.BY_NAME[k]).sort());
    const w = Math.max(...names.map(x => x.length)) + 2;
    say(`${'Phần'.padEnd(w)}${'Tài liệu'.padStart(10)}${'Dung lượng'.padStart(14)}`);
    let n = 0, bytes = 0;
    for (const name of names) {
      const x = by.get(name) || { n: 0, bytes: 0 };
      n += x.n; bytes += Number(x.bytes);
      say(`${name.padEnd(w)}${fmtN(x.n).padStart(10)}${fmtB(Number(x.bytes)).padStart(14)}${S.BY_NAME[name] ? '' : '  (phần lạ)'}`);
    }
    say(`${'Cộng'.padEnd(w)}${fmtN(n).padStart(10)}${fmtB(bytes).padStart(14)}`);
    const size = (await pool.query('SELECT pg_database_size(current_database()) AS b')).rows[0].b;
    say(`\nDung lượng cả CSDL: ${fmtB(Number(size))} (Neon Free cho 1 GB mỗi dự án).`);
    const info = await pool.query('SELECT key, value FROM schema_info ORDER BY key').catch(() => ({ rows: [] }));
    for (const { key, value } of info.rows) {
      if (key === 'imported_from_json') say(`Đã nhập từ JSON lúc ${value.at}${value.file ? ' (' + value.file + ')' : ''}.`);
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

/* ---- chạy ---- */

function parse(argv) {
  const pos = [], flags = {};
  for (const a of argv) {
    if (a === '-') pos.push(a);
    else if (a.startsWith('--')) flags[a.slice(2)] = true;
    else pos.push(a);
  }
  return { cmd: pos[0], args: pos.slice(1), flags };
}

async function main() {
  const { cmd, args, flags } = parse(process.argv.slice(2));
  if (!cmd || cmd === 'help' || flags.help) { say(USAGE); return; }
  switch (cmd) {
    case 'import': return cmdImport(args[0], flags);
    case 'verify': return cmdVerify(args[0]);
    case 'export': return cmdExport(args[0], flags);
    case 'stats': return cmdStats();
    default: throw new Stop(2, `Không có lệnh "${cmd}".\n\n${USAGE}`);
  }
}

main().catch(e => {
  const secret = (() => { try { return new URL(process.env.DATABASE_URL.trim()).password; } catch { return ''; } })();
  let msg = e instanceof Stop ? e.message : 'Lỗi: ' + (e && e.message || e);
  if (secret && secret.length >= 4) msg = msg.split(secret).join('***');
  if (msg) console.error(msg);
  process.exitCode = e instanceof Stop ? e.code : 1;
});
