'use strict';
/*
 * Liệt kê nhánh kết quả của MỘT lượt trên Duel thật: mỗi lần thử né / đỡ là một bit, dao động sát thương cố định ở 1,0.
 * Số lần thử và xác suất từng lần chỉ phụ thuộc trạng thái đầu lượt và hai lựa chọn, không phụ thuộc kết quả các lần thử trước.
 */
const HALF = () => 0.5;

/** Trả về [{ w, d }]: w là xác suất nhánh, d là bản sao Duel sau khi giải lượt (d.over, d.f.a, d.f.b...). Tổng w = 1. */
function outcomes(duel, pa, pb) {
  const ps = [];
  let k = 0, mask = 0, collect = true;
  const roll = p => {
    const i = k++;
    if (collect) { ps.push(p); return true; }
    return ((mask >> i) & 1) === 1;
  };
  const first = duel.clone({ roll, vari: HALF });
  first.step(pa, pb);
  collect = false;
  const n = ps.length, full = (1 << n) - 1, res = [];
  for (let m = 0; m <= full; m++) {
    let w = 1;
    for (let i = 0; i < n; i++) w *= ((m >> i) & 1) ? ps[i] : 1 - ps[i];
    if (w <= 0) continue;
    if (m === full) { res.push({ w, d: first }); continue; }
    mask = m; k = 0;
    const c = duel.clone({ roll, vari: HALF });
    c.step(pa, pb);
    res.push({ w, d: c });
  }
  return res;
}

/** Kỳ vọng của hàm fn(d) trên các nhánh. */
function expectedValue(branches, fn) {
  let s = 0;
  for (const b of branches) s += b.w * fn(b.d);
  return s;
}

module.exports = { outcomes, expectedValue };
