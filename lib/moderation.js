'use strict';
/*
 * Kiểm duyệt nội dung: làm sạch văn bản, che từ tục, chặn số tài khoản / số điện thoại / đường link.
 * Chặn số và link là để không ai giả danh nhà chùa xin tiền trong chat.
 */

// Từ tục: so khớp nguyên từ trên chữ thường CÓ DẤU (tránh che nhầm "lớn", "đeo"...)
const BAD_WORDS = [
  'đụ', 'địt', 'đéo', 'lồn', 'buồi', 'cặc', 'đĩ', 'đm', 'đmm', 'đcm', 'dcm', 'dmm', 'cmm', 'clm', 'vcl', 'vkl', 'vl', 'vãi lồn',
  'mẹ mày', 'óc chó', 'thằng chó', 'con chó', 'đồ chó', 'súc vật', 'djt', 'dit me', 'du ma', 'đù má', 'đụ má', 'địt mẹ', 'cc', 'loz', 'lozz'
];
const RESERVED_NAMES = ['ban điều hành', 'ban dieu hanh', 'admin', 'quản trị', 'quan tri', 'mod', 'moderator', 'trụ trì', 'tru tri', 'nhà chùa', 'nha chua', 'hệ thống', 'he thong'];

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// \p{L} để ranh giới từ hoạt động với chữ có dấu
const BAD_RE = new RegExp(`(^|[^\\p{L}\\p{N}])(${BAD_WORDS.map(esc).sort((a, b) => b.length - a.length).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');

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

function censor(text) {
  return text.replace(BAD_RE, (m, pre, word) => pre + '*'.repeat(Math.min(word.length, 5)));
}

function hasBad(text) {
  BAD_RE.lastIndex = 0;
  const r = BAD_RE.test(text.toLowerCase());
  BAD_RE.lastIndex = 0;
  return r;
}

/** Kiểm tra tin nhắn / lời nguyện. Trả về { ok, text } hoặc { ok:false, reason }. */
function checkMessage(raw, max = 300) {
  const text = clean(raw, max);
  if (!text) return { ok: false, reason: 'Tin nhắn trống.' };
  if (LINK_RE.test(text) || LONG_NUMBER_RE.test(text)) {
    return { ok: false, reason: 'Tin có số tài khoản, số điện thoại hoặc đường link nên chưa được gửi. Chánh điện chặn những nội dung này để tránh lừa đảo quyên góp.' };
  }
  if (/(.)\1{9,}/u.test(text)) return { ok: false, reason: 'Tin nhắn lặp ký tự quá nhiều.' };
  return { ok: true, text: censor(text) };
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

module.exports = { clean, censor, checkMessage, checkName, hasBad };
