'use strict';
/*
 * Lưu trạng thái vào một file JSON (đủ cho bản đầu, một máy chủ).
 * Khi đông người hơn: chuyển sang PostgreSQL + Redis như trong kế hoạch.
 */
const fs = require('fs');
const path = require('path');

const FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
const COUNTERS = () => ({ incense: 0, lotus: 0, rose: 0, lamp: 0, fruit: 0, hearts: 0, mo: 0, bows: 0, bells: 0, chants: 0, visits: 0 });

function fresh() {
  return {
    version: 1,
    day: '',
    today: COUNTERS(),
    total: COUNTERS(),
    merit: {},        // uid -> { name, total, today, day }
    prayers: [],      // lời nguyện công khai
    chat: [],         // tin nhắn gần đây
    incense: [],      // nhang đang cháy
    donations: [],    // lượt cúng dường tịnh tài
    seq: 1
  };
}

let db = fresh();
let timer = null;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    db = Object.assign(fresh(), raw);
    db.today = Object.assign(COUNTERS(), db.today);
    db.total = Object.assign(COUNTERS(), db.total);
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[store] Không đọc được dữ liệu, bắt đầu mới:', e.message);
    db = fresh();
  }
  return db;
}

function flush() {
  clearTimeout(timer); timer = null;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  } catch (e) {
    console.error('[store] Lỗi ghi dữ liệu:', e.message);
  }
}

function save() {
  if (!timer) timer = setTimeout(flush, 4000);
}

const get = () => db;
const nextId = () => db.seq++;

module.exports = { load, save, flush, get, nextId, COUNTERS, FILE };
