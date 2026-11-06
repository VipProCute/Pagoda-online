'use strict';
/*
 * Kiểm duyệt nội dung: làm sạch văn bản, che từ tục, chặn số tài khoản / số điện thoại / đường link,
 * và LUẬT TRỪ CÔNG ĐỨC khi nói lời tục tĩu trong chat (không áp dụng cho nói chuyện bằng giọng).
 * Chặn số và link là để không ai giả danh nhà chùa xin tiền trong chat.
 *
 * Luật trừ công đức (chửi càng nặng trừ càng nhiều):
 *   Mức 1  Lời thô              −5    (vãi, vcl, đéo, mẹ kiếp…)
 *   Mức 2  Xúc phạm người khác  −15   (óc chó, súc vật, mất dạy, câm mồm…)
 *   Mức 3  Tục tĩu              −30   (từ chỉ bộ phận sinh dục, chửi thề viết tắt…)
 *   Mức 4  Chửi cha mẹ, trù ẻo  −60   (chửi đến cha mẹ, tổ tiên, mong người khác chết…)
 *   Mức 5  Báng bổ Tam Bảo      −100  (lời tục nhắm vào Phật, Bồ Tát, chư Tăng, nhà chùa)
 *   Cộng dồn mọi từ trong cùng một tin (mỗi từ tính tối đa 3 lần).
 *   Gào thét (viết HOA gần hết)            × 1,5
 *   Tái phạm trong 10 phút                 × (1 + 0,5 × số lần đã phạm), tối đa × 3
 *   Một tin trừ tối đa 300 công đức.
 */

// Từ có dấu (so khớp nguyên từ trên chữ thường có dấu, tránh nhầm "lớn", "đeo", "chim cút"…)
const RULES = [
  {
    lv: 1, pts: 5, name: 'Lời thô', note: 'Lời lẽ cộc cằn, chửi thề nhẹ',
    words: ['vãi', 'vl', 'vcl', 'vkl', 'vler', 'vđ', 'đéo', 'chết tiệt', 'mẹ kiếp', 'bố láo', 'láo toét', 'ngu học', 'ngu si', 'khùng', 'hâm', 'dở hơi', 'nhảm nhí'],
    ascii: ['vcl', 'vkl', 'vler', 'me kiep', 'chet tiet', 'bo lao']
  },
  {
    lv: 2, pts: 15, name: 'Xúc phạm', note: 'Mắng chửi, hạ nhục người khác',
    words: ['óc chó', 'não chó', 'đồ chó', 'thằng chó', 'chó má', 'chó chết', 'súc vật', 'súc sinh', 'mất dạy', 'vô học', 'vô giáo dục', 'mất nết',
      'khốn nạn', 'đồ khốn', 'thằng khốn', 'con khốn', 'thằng điên', 'con điên', 'đồ điên', 'đần độn', 'thằng đần', 'đồ ngu', 'thằng ngu', 'con ngu',
      'ngu như bò', 'ngu như chó', 'óc lợn', 'óc bò', 'não tôm', 'rác rưởi', 'cặn bã', 'câm mồm', 'câm miệng', 'im mồm', 'cút đi', 'cút xéo',
      'mặt dày', 'đồ thần kinh', 'bệnh hoạn', 'đồ tởm', 'đồ ăn hại', 'đồ vô dụng', 'đồ hèn', 'bố mày', 'tao đấm', 'cmn', 'cc', 'cl', 'clgt'],
    ascii: ['oc cho', 'do cho', 'thang cho', 'suc vat', 'suc sinh', 'mat day', 'vo hoc', 'khon nan', 'thang khon', 'cam mom', 'im mom', 'dan don', 'do ngu', 'thang ngu', 'cmn', 'clgt']
  },
  {
    lv: 3, pts: 30, name: 'Tục tĩu', note: 'Từ thô tục, chửi thề viết tắt, lời dâm ô',
    words: ['đụ', 'địt', 'đm', 'dm', 'lồn', 'loz', 'lozz', 'buồi', 'cặc', 'cặk', 'dái', 'đĩ', 'con đĩ', 'đĩ điếm', 'điếm', 'cave', 'chó đẻ', 'đồ chó đẻ',
      'djt', 'đù', 'vãi lồn', 'vãi cả lồn', 'vãi cặc', 'mặt lồn', 'óc lồn', 'ngu lồn', 'cái lồn', 'nứng', 'chịch', 'dâm đãng', 'bú cu'],
    ascii: ['dit', 'djt', 'loz', 'lozz', 'cho de', 'vai lon', 'vailon']
  },
  {
    lv: 4, pts: 60, name: 'Chửi cha mẹ, trù ẻo', note: 'Chửi đến cha mẹ, tổ tiên, mong người khác chết',
    words: ['địt mẹ', 'đụ mẹ', 'đụ má', 'đù má', 'đéo mẹ', 'địt cụ', 'địt bố', 'địt con mẹ', 'đmm', 'dmm', 'đcm', 'dcm', 'đkm', 'dkm', 'cmm', 'clm',
      'mẹ mày', 'má mày', 'cha mày', 'tổ cha', 'tổ sư', 'tiên sư', 'tiên nhân', 'cả lò nhà mày', 'cả họ nhà mày', 'mả mẹ', 'mả cha',
      'chết mẹ mày', 'mày chết đi', 'đi chết đi', 'đồ con hoang', 'giết mày', 'đâm chết'],
    ascii: ['dit me', 'ditme', 'dit cu', 'du ma', 'dume', 'duma', 'dmm', 'dcm', 'dkm', 'cmm', 'clm', 'me may', 'to su', 'tien su', 'di chet di', 'may chet di']
  },
  {
    lv: 5, pts: 100, name: 'Báng bổ Tam Bảo', note: 'Lời tục nhắm vào Phật, Bồ Tát, chư Tăng, nhà chùa',
    words: ['phật chó', 'phật ngu', 'phật đểu', 'phật lừa đảo', 'bụt chó', 'sư hổ mang', 'thầy chùa lừa đảo'],
    ascii: ['phat cho', 'phat ngu']
  }
];
const SACRED = ['phật', 'bụt', 'bồ tát', 'thích ca', 'a di đà', 'quán âm', 'quan âm', 'tam bảo', 'sư thầy', 'thầy chùa', 'hòa thượng', 'hoà thượng', 'ni cô', 'sư cô', 'nhà chùa', 'chư tăng'];
// Từ mức 1 vẫn được hiện (chỉ trừ công đức), trừ mấy chữ viết tắt thô
const SHOW_LV1 = new Set(['chết tiệt', 'mẹ kiếp', 'bố láo', 'láo toét', 'ngu học', 'ngu si', 'khùng', 'hâm', 'dở hơi', 'nhảm nhí', 'vãi', 'me kiep', 'chet tiet', 'bo lao']);
const RESERVED_NAMES = ['ban điều hành', 'ban dieu hanh', 'admin', 'quản trị', 'quan tri', 'mod', 'moderator', 'trụ trì', 'tru tri', 'nhà chùa', 'nha chua', 'hệ thống', 'he thong'];

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// \p{L} để ranh giới từ hoạt động với chữ có dấu
const wordRe = list => new RegExp(`(^|[^\\p{L}\\p{N}])(${list.map(esc).sort((a, b) => b.length - a.length).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
const ENTRIES = [];
for (const r of RULES) {
  for (const w of r.words) ENTRIES.push({ w, r, show: r.lv === 1 && SHOW_LV1.has(w) });
  for (const w of r.ascii) ENTRIES.push({ w, r, show: r.lv === 1 && SHOW_LV1.has(w) });
}
ENTRIES.sort((a, b) => b.w.length - a.w.length);              // cụm dài trước: "địt mẹ" trước "địt"
const ENTRY_OF = new Map(ENTRIES.map(e => [e.w, e]));
const ALL_RE = wordRe(ENTRIES.map(e => e.w));
const SACRED_RE = wordRe(SACRED);

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|vn|net|org|io|me|xyz|info|top|link|site|online|shop|store|app|ly|gg)\b|t\.me\/|zalo\.me)/i;
const LONG_NUMBER_RE = /(\d[\s.\-_,]?){8,}/; // số tài khoản, số điện thoại

function clean(text, max) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Chữ thường để so khớp, kèm vị trí ký tự gốc (để che đúng chỗ):
 *  - gộp chữ kéo dài cùng gốc từ 3 lần trở lên ("đụuuuu" → "đụ"),
 *  - bỏ dấu chấm/sao/gạch chen giữa chữ ("đ.m" → "đm").
 */
const base = ch => ch.normalize('NFD')[0];
const isL = ch => /\p{L}/u.test(ch);
function normMap(text) {
  const src = [...text.normalize('NFC')];
  const low = src.map(c => c.toLowerCase());
  const keep = low.map(() => true);
  for (let i = 0; i < low.length;) {                              // chữ kéo dài
    let j = i + 1;
    if (isL(low[i])) while (j < low.length && isL(low[j]) && base(low[j]) === base(low[i])) j++;
    if (j - i >= 3) for (let k = i + 1; k < j; k++) keep[k] = false;
    i = j;
  }
  for (let i = 1; i < low.length - 1; i++) {                      // dấu chen giữa chữ
    if (!/[.*_\-]/.test(low[i])) continue;
    let a = i - 1; while (a >= 0 && !keep[a]) a--;
    let b = i; while (b < low.length && /[.*_\-]/.test(low[b])) b++;
    if (a >= 0 && b < low.length && isL(low[a]) && isL(low[b])) for (let k = i; k < b; k++) keep[k] = false;
  }
  let s = ''; const map = []; let off = 0;
  for (let i = 0; i < src.length; i++) {
    if (keep[i]) { s += low[i]; for (let k = 0; k < low[i].length; k++) map.push(off); }
    off += src[i].length;
  }
  map.push(off);
  return { s, map, src: src.join('') };
}
const norm = text => normMap(text).s;

/**
 * Chấm điểm lời tục trong một tin. Trả về { pts, lv, name, hits:[{w, lv, pts}] } (pts = 0 nếu sạch).
 * Chưa tính hệ số tái phạm (máy chủ nhân thêm).
 */
function judge(raw) {
  const text = clean(raw, 2000);
  if (!text) return { pts: 0, lv: 0, name: '', hits: [] };
  const low = norm(text);
  const count = new Map(), hits = [];
  let pts = 0, lv = 0;
  ALL_RE.lastIndex = 0;
  for (const m of low.matchAll(ALL_RE)) {
    const e = ENTRY_OF.get(m[2]);
    if (!e) continue;
    const n = (count.get(e.w) || 0) + 1; count.set(e.w, n);
    if (n > 3) continue;                                        // một từ tính tối đa 3 lần
    pts += e.r.pts; lv = Math.max(lv, e.r.lv);
    hits.push({ w: e.w, lv: e.r.lv, pts: e.r.pts });
  }
  // Báng bổ: lời xúc phạm trở lên đi cùng danh hiệu Phật, Bồ Tát, chư Tăng, nhà chùa
  SACRED_RE.lastIndex = 0;
  if (lv >= 2 && lv < 5 && SACRED_RE.test(low)) { const r5 = RULES[4]; pts += r5.pts; lv = 5; hits.push({ w: '(báng bổ Tam Bảo)', lv: 5, pts: r5.pts }); }
  SACRED_RE.lastIndex = 0;
  // Gào thét: viết HOA gần hết
  const letters = text.replace(/[^\p{L}]/gu, ''), upper = text.replace(/[^\p{Lu}]/gu, '');
  const shout = pts > 0 && letters.length >= 6 && upper.length / letters.length >= 0.7;
  if (shout) pts = Math.round(pts * 1.5);
  return { pts, lv, name: lv ? RULES[lv - 1].name : '', shout, hits };
}

/** Che từ tục bằng dấu * ngay trên chữ gốc (giữ nguyên chữ hoa/thường phần còn lại). */
function censor(text) {
  const { s: low, map, src } = normMap(text);
  let out = '', last = 0;
  ALL_RE.lastIndex = 0;
  for (const m of low.matchAll(ALL_RE)) {
    const e = ENTRY_OF.get(m[2]);
    if (!e || e.show) continue;
    const a = m.index + m[1].length, b = a + m[2].length;
    const start = map[a], end = map[b];                            // gồm cả chữ kéo dài / dấu chen đã bỏ
    if (start < last) continue;
    out += src.slice(last, start) + '*'.repeat(Math.min(m[2].length, 5));
    last = end;
  }
  return out + src.slice(last);
}

function hasBad(text) {
  const low = norm(text);
  ALL_RE.lastIndex = 0;
  for (const m of low.matchAll(ALL_RE)) { const e = ENTRY_OF.get(m[2]); if (e && !e.show) return true; }
  return false;
}

/** Kiểm tra tin nhắn / lời nguyện. Trả về { ok, text, pen } (pen = kết quả judge) hoặc { ok:false, reason }. */
function checkMessage(raw, max = 300) {
  const text = clean(raw, max);
  if (!text) return { ok: false, reason: 'Tin nhắn trống.' };
  if (LINK_RE.test(text) || LONG_NUMBER_RE.test(text)) {
    return { ok: false, reason: 'Tin có số tài khoản, số điện thoại hoặc đường link nên chưa được gửi. Chánh điện chặn những nội dung này để tránh lừa đảo quyên góp.' };
  }
  if (/(.)\1{9,}/u.test(text)) return { ok: false, reason: 'Tin nhắn lặp ký tự quá nhiều.' };
  const pen = judge(text);
  return { ok: true, text: pen.pts ? censor(text) : text, pen };
}

/** Kiểm tra tên hiển thị. */
function checkName(raw, isMod) {
  const name = clean(raw, 24);
  if (name.length < 2) return { ok: false, reason: 'Tên cần ít nhất 2 ký tự.' };
  if (LINK_RE.test(name) || /\d{6,}/.test(name)) return { ok: false, reason: 'Tên không được chứa đường link hoặc dãy số dài.' };
  if (hasBad(name)) return { ok: false, reason: 'Tên có từ ngữ không phù hợp nơi cửa Phật.' };
  const lower = name.toLowerCase();
  if (!isMod && RESERVED_NAMES.some(r => lower === r || lower.startsWith(r + ' ') || lower.endsWith(' ' + r))) {
    return { ok: false, reason: 'Tên này dành cho ban điều hành. Bạn chọn tên khác nhé.' };
  }
  return { ok: true, name };
}

/** Bảng luật để hiện cho người dùng (ví dụ được che bớt chữ). */
function rulesSummary() {
  const mask = w => w.split(' ').map(x => x.length <= 1 ? x : x[0] + '*'.repeat(x.length - 1)).join(' ');
  return RULES.map(r => ({ lv: r.lv, pts: r.pts, name: r.name, note: r.note, ex: r.words.slice(0, 4).map(w => (r.lv === 1 && SHOW_LV1.has(w) ? w : mask(w))) }));
}

module.exports = { clean, censor, checkMessage, checkName, hasBad, judge, rulesSummary, RULES };
