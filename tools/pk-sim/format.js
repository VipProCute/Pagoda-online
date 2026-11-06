'use strict';
/* Định dạng bảng chữ cho terminal / điện thoại. */
const strLen = s => [...String(s)].length;
const pad = (s, n) => { s = String(s); return s + ' '.repeat(Math.max(0, n - strLen(s))); };
const lpad = (s, n) => { s = String(s); return ' '.repeat(Math.max(0, n - strLen(s))) + s; };
const pct = (x, d = 0) => (x * 100).toFixed(d);

/** Bảng: headers[], rows[][]; align: chuỗi 'lrr…' (l trái, r phải). */
function table(headers, rows, align) {
  const all = [headers, ...rows].map(r => r.map(c => (c == null ? '' : String(c))));
  const w = headers.map((_, i) => Math.max(...all.map(r => strLen(r[i] || ''))));
  const a = align || headers.map((_, i) => (i === 0 ? 'l' : 'r'));
  const line = r => r.map((c, i) => (a[i] === 'l' ? pad(c, w[i]) : lpad(c, w[i]))).join('  ').replace(/\s+$/, '');
  return [line(all[0]), w.map(x => '-'.repeat(x)).join('  '), ...all.slice(1).map(line)].join('\n');
}

const title = s => `\n== ${s} ==`;

module.exports = { pad, lpad, pct, table, title, strLen };
