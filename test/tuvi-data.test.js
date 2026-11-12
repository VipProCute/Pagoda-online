'use strict';

// Kiểm dữ liệu luận giải tử vi (public/data/tuvi.vi.json): đủ khóa theo mã ở KH Phụ lục B,
// không trùng đoạn, độ dài hợp lý, không HTML, không lời phán nặng nề.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'public', 'data', 'tuvi.vi.json');
const raw = fs.readFileSync(FILE, 'utf8');
const data = JSON.parse(raw);

const PALACES = ['menh', 'phumau', 'phucduc', 'dientrach', 'quanloc', 'nopboc', 'thiendi', 'tatach', 'taibach', 'tutuc', 'phuthe', 'huynhde'];
const MAJOR = ['tuvi', 'thienco', 'thaiduong', 'vukhuc', 'thiendong', 'liemtrinh', 'thienphu', 'thaiam', 'thamlang', 'cumon', 'thientuong', 'thienluong', 'thatsat', 'phaquan'];
const MINOR = ['taphu', 'huubat', 'vanxuong', 'vankhuc', 'thienkhoi', 'thienviet', 'locton', 'kinhduong', 'dala', 'thienma', 'hoatinh', 'linhtinh', 'diakhong', 'diakiep', 'hoaloc', 'hoaquyen', 'hoakhoa', 'hoaky', 'tuan', 'triet', 'daohoa', 'hongloan', 'thienhy', 'thienhinh', 'thiendieu', 'thaitue'];
const TRANGSINH = ['trangsinh', 'mocduc', 'quandoi', 'lamquan', 'devuong', 'suy', 'benh', 'tu', 'mo', 'tuyet', 'thai', 'duong'];
const HOA = ['hoaloc', 'hoaquyen', 'hoakhoa', 'hoaky'];
const HANH = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
const CUC = ['thuy2', 'moc3', 'kim4', 'tho5', 'hoa6'];

// Duyệt mọi chuỗi lá, trả về [đường dẫn, chuỗi].
function leaves(node, prefix, out) {
  if (typeof node === 'string') out.push([prefix, node]);
  else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) leaves(node[k], prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}
const all = leaves(data, '', []);
const body = all.filter(([p]) => !p.startsWith('meta.') && !/^palaces\./.test(p) && !/\.name$/.test(p) && !/\.rule$/.test(p));

// Tên sao và tên cung (thuật ngữ miền) để chuẩn hóa khi đếm câu lặp giữa các đoạn.
const NAMES = ['Tử Vi', 'Thiên Cơ', 'Thái Dương', 'Vũ Khúc', 'Thiên Đồng', 'Liêm Trinh', 'Thiên Phủ', 'Thái Âm', 'Tham Lang', 'Cự Môn', 'Thiên Tướng', 'Thiên Lương', 'Thất Sát', 'Phá Quân',
  'Hóa Lộc', 'Hóa Quyền', 'Hóa Khoa', 'Hóa Kỵ', 'Thái Tuế', 'Tuần', 'Triệt',
  'Mệnh', 'Phụ Mẫu', 'Phúc Đức', 'Điền Trạch', 'Quan Lộc', 'Nô Bộc', 'Thiên Di', 'Tật Ách', 'Tài Bạch', 'Tử Tức', 'Phu Thê', 'Huynh Đệ'];
const NAME_RE = new RegExp(NAMES.join('|'), 'g');

function keysOf(obj) { return Object.keys(obj).sort(); }

test('tuvi.vi.json: đủ 12 cung với tên và chủ đề', () => {
  assert.deepEqual(keysOf(data.palaces), [...PALACES].sort());
  for (const p of PALACES) {
    assert.ok(data.palaces[p].name && data.palaces[p].topic, p);
  }
});

test('tuvi.vi.json: 14 chính tinh × 12 cung × 2 nhóm sáng', () => {
  assert.deepEqual(keysOf(data.stars), [...MAJOR].sort());
  for (const s of MAJOR) {
    assert.deepEqual(keysOf(data.stars[s]), [...PALACES].sort(), s);
    for (const p of PALACES) {
      assert.deepEqual(keysOf(data.stars[s][p]), ['sang', 'toi'], `${s}.${p}`);
    }
  }
});

test('tuvi.vi.json: phụ tinh, Tràng Sinh, Tứ Hóa, Tuần/Triệt, đại vận, lưu niên đủ khóa', () => {
  assert.deepEqual(keysOf(data.minor), [...MINOR].sort());
  assert.deepEqual(keysOf(data.trangsinh), [...TRANGSINH].sort());
  assert.deepEqual(keysOf(data.hoa), [...HOA].sort());
  for (const h of HOA) assert.deepEqual(keysOf(data.hoa[h]), [...PALACES].sort(), h);
  assert.deepEqual(keysOf(data.tuanTriet), ['triet', 'tuan']);
  for (const k of ['tuan', 'triet']) assert.deepEqual(keysOf(data.tuanTriet[k]), [...PALACES].sort(), k);
  assert.deepEqual(keysOf(data.daivan), [...PALACES].sort());
  assert.deepEqual(keysOf(data.luunien.thaitue), [...PALACES].sort());
  assert.deepEqual(keysOf(data.luunien.hoa), [...HOA].sort());
  for (const h of HOA) assert.deepEqual(keysOf(data.luunien.hoa[h]), [...PALACES].sort(), h);
  for (const k of ['luulocton', 'luukinhda', 'luuthienma']) {
    assert.equal(typeof data.luunien[k], 'string', k);
  }
});

test('tuvi.vi.json: ít nhất 40 cách cục, mã dạng kebab-case, có tên và lời', () => {
  const ids = Object.keys(data.combos);
  assert.ok(ids.length >= 40, `chỉ có ${ids.length} cách cục`);
  for (const id of ids) {
    assert.match(id, /^[a-z]+(-[a-z]+)*$/, id);
    assert.ok(data.combos[id].name && data.combos[id].text, id);
  }
  for (const must of ['tu-phu-dong-cung', 'sat-pha-tham', 'co-nguyet-dong-luong', 'nhat-nguyet-tinh-minh', 'ta-huu-giap-menh', 'loc-ma-giao-tri', 'khong-kiep-giap-menh', 'menh-vo-chinh-dieu']) {
    assert.ok(data.combos[must], must);
  }
});

test('tuvi.vi.json: sinh khắc Bản mệnh–Cục đủ 5 × 5 và đúng quan hệ', () => {
  assert.deepEqual(keysOf(data.sinhkhac), [...HANH].sort());
  for (const m of HANH) assert.deepEqual(keysOf(data.sinhkhac[m]), [...CUC].sort(), m);
  // Ví dụ trong KH: Mệnh Kim, Cục Thổ: Cục sinh Mệnh, thuận.
  assert.match(data.sinhkhac.kim.tho5, /Cục sinh Mệnh/);
  assert.match(data.sinhkhac.kim.kim4, /cùng hành/);
  assert.match(data.sinhkhac.kim.hoa6, /Cục khắc Mệnh/);
  assert.match(data.sinhkhac.kim.thuy2, /Mệnh sinh Cục/);
  assert.match(data.sinhkhac.kim.moc3, /Mệnh khắc Cục/);
});

test('tuvi.vi.json: đủ 25 ô sinh khắc đúng theo vòng ngũ hành', () => {
  const sinh = { kim: 'thuy', thuy: 'moc', moc: 'hoa', hoa: 'tho', tho: 'kim' };
  const khac = { kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim' };
  const tenHanh = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
  const tenCuc = { thuy2: 'Thủy nhị cục', moc3: 'Mộc tam cục', kim4: 'Kim tứ cục', tho5: 'Thổ ngũ cục', hoa6: 'Hỏa lục cục' };
  const hanhCuc = { thuy2: 'thuy', moc3: 'moc', kim4: 'kim', tho5: 'tho', hoa6: 'hoa' };
  const PHRASES = ['cùng hành', 'Mệnh sinh Cục', 'Cục sinh Mệnh', 'Mệnh khắc Cục', 'Cục khắc Mệnh'];
  for (const m of HANH) {
    for (const c of CUC) {
      const h = hanhCuc[c];
      let want;
      if (m === h) want = 'cùng hành';
      else if (sinh[m] === h) want = 'Mệnh sinh Cục';
      else if (sinh[h] === m) want = 'Cục sinh Mệnh';
      else if (khac[m] === h) want = 'Mệnh khắc Cục';
      else want = 'Cục khắc Mệnh';
      const s = data.sinhkhac[m][c];
      assert.ok(s.startsWith(`Mệnh ${tenHanh[m]}, ${tenCuc[c]}:`), `${m}.${c}: sai đầu câu`);
      for (const ph of PHRASES) {
        assert.equal(s.includes(ph), ph === want, `${m}.${c}: cần "${want}", gặp "${ph}"`);
      }
    }
  }
});

test('tuvi.vi.json: Tuần/Triệt đúng đặc điểm thời gian (Triệt mạnh đến khoảng 30 tuổi, Tuần nhẹ và rõ về sau)', () => {
  for (const p of PALACES) {
    assert.match(data.tuanTriet.triet[p], /Triệt/, p);
    assert.match(data.tuanTriet.tuan[p], /Tuần/, p);
  }
  assert.match(data.minor.triet, /ba mươi tuổi/);
  assert.match(data.minor.tuan, /hậu vận/);
  assert.ok(!/Tuần[^.]*chưa trọn vẹn lúc đầu/.test(data.minor.tuan));
});

test('tuvi.vi.json: chính tinh ở Phu Thê/Điền Trạch có ý riêng của sao (Sát Phá Tham Liêm Cự không nói "êm ấm đồng điệu" chung)', () => {
  for (const s of ['thatsat', 'phaquan', 'thamlang', 'liemtrinh', 'cumon']) {
    for (const k of ['sang', 'toi']) {
      assert.ok(!/êm ấm và dễ đồng điệu/.test(data.stars[s].phuthe[k]), `${s}.phuthe.${k}`);
    }
  }
  for (const s of ['thatsat', 'phaquan']) {
    for (const k of ['sang', 'toi']) {
      assert.match(data.stars[s].phuthe[k], /muộn/, `${s}.phuthe.${k}`);
      assert.match(data.stars[s].phuthe[k], /nhường nhịn/, `${s}.phuthe.${k}`);
    }
  }
  assert.ok(!/mái ấm ổn định/.test(data.stars.phaquan.dientrach.sang));
});

test('tuvi.vi.json: không có mẫu ghép câu hỏng ngữ pháp', () => {
  const broken = /dễ thói|khi bạn thói|khi bạn nhọc công|bạn dễ nhọc|có thể gặp (lo|hay|ham)|rơi vào (thói|nhọc)|\{|\}/i;
  for (const [p, s] of body) {
    assert.ok(!broken.test(s), `${p}: mẫu hỏng → ${s}`);
  }
});

test('tuvi.vi.json: một câu (bỏ tên sao, tên cung) không lặp quá 3 lần giữa các đoạn', () => {
  const MAX = 3;
  const count = new Map();
  for (const [p, s] of body) {
    const sents = s.split(/(?<=[.;!?])\s+/).map((x) => x.trim().toLowerCase().replace(NAME_RE, 'x').replace(/\s+/g, ' ')).filter(Boolean);
    for (const sent of new Set(sents)) {
      const e = count.get(sent) || { n: 0, at: p };
      e.n += 1;
      count.set(sent, e);
    }
  }
  const over = [...count].filter(([, e]) => e.n > MAX).map(([k, e]) => `${e.n}× "${k}" (vd ${e.at})`);
  assert.deepEqual(over, []);
});

test('tuvi.vi.json: mỗi cách cục có điều kiện rule bằng lời, mã cách cục nhất quán', () => {
  for (const id of Object.keys(data.combos)) {
    const r = data.combos[id].rule;
    assert.ok(typeof r === 'string' && r.length >= 20 && /[.]$/.test(r), `${id}: thiếu rule`);
  }
  assert.ok(data.combos['hoa-linh-dong-cung'] && !data.combos['linh-hoa-dong-cung']);
  assert.ok(data.combos['nhat-nguyet-chieu-menh'] && !data.combos['thai-duong-thai-am-chieu']);
  // Không dùng sao ngoài bản đầu (Đại Hao, Tiểu Hao) vì T-054 không tính.
  assert.ok(!data.combos['song-hao-dong-cung']);
  assert.ok(data.combos['vo-chinh-dieu-gap-tuan-triet']);
});

test('tuvi.vi.json: không trùng đoạn văn', () => {
  const seen = new Map();
  for (const [p, s] of body) {
    const key = s.trim().toLowerCase();
    assert.ok(!seen.has(key), `trùng: ${p} và ${seen.get(key)}`);
    seen.set(key, p);
  }
});

test('tuvi.vi.json: không trùng câu trong cùng một đoạn', () => {
  for (const [p, s] of body) {
    const sents = s.split(/(?<=[.;!?])\s+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    assert.equal(new Set(sents).size, sents.length, p);
  }
});

test('tuvi.vi.json: độ dài hợp lý, đúng dấu câu, có dấu tiếng Việt', () => {
  for (const [p, s] of body) {
    assert.ok(s.length >= 40 && s.length <= 700, `${p}: dài ${s.length}`);
    assert.equal(s, s.trim(), p);
    assert.ok(!/\s{2,}/.test(s), `${p}: có khoảng trắng thừa`);
    assert.match(s, /[.!?]$/, `${p}: không kết thúc bằng dấu câu`);
    assert.ok(!/\{\w+\}/.test(s), `${p}: còn chỗ trống chưa thay`);
    assert.match(s, /[àáảãạâăđêôơưéèíìóòúùýỳ]/i, `${p}: thiếu dấu tiếng Việt`);
  }
});

test('tuvi.vi.json: không chứa HTML hay đường dẫn', () => {
  for (const [p, s] of all) {
    assert.ok(!/[<>]/.test(s), `${p}: có ký tự < >`);
    assert.ok(!/&\w+;|https?:|www\./i.test(s), `${p}: có thực thể HTML hoặc link`);
  }
});

test('tuvi.vi.json: không có lời phán chết chóc, bệnh nặng, tai nạn', () => {
  const banned = /(chết|tử vong|qua đời|tang tóc|ung thư|bệnh nặng|bệnh hiểm|tai nạn|tàn tật|phá sản|ly dị|ly hôn|đoản mệnh|yểu|tuyệt tự|vô phương|họa lớn|tai ương|tai họa|bệnh tật|hình khắc|hiếm muộn|(^|[\s,;.])tù([\s,;.]|$))/i;
  for (const [p, s] of body) {
    assert.ok(!banned.test(s), `${p}: có từ nặng nề → ${s}`);
  }
});

test('tuvi.vi.json: có tuyên bố tham khảo', () => {
  assert.match(data.meta.disclaimer, /tham khảo/);
  assert.match(data.meta.disclaimer, /trên máy của bạn/);
});
