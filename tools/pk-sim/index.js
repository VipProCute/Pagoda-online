#!/usr/bin/env node
'use strict';
/*
 * Công cụ mô phỏng cân bằng luận võ. Dùng đúng lib/pk/engine.js (Duel thật), không phụ thuộc gói ngoài.
 *   node tools/pk-sim roundrobin   Đấu vòng tròn các bộ chiêu tiêu biểu (--sets presets|pure|all)
 *   node tools/pk-sim grid         Quét mọi bộ 4 chiêu (C(15,4) = 1365) với mẫu đối thủ ngẫu nhiên, tìm bộ áp đảo
 *   node tools/pk-sim buffs        Bên có buff đấu bên không buff, theo Lc / Lq / Ld và BUFF_SCALE
 *   node tools/pk-sim levels       Chênh cấp nội công
 *   node tools/pk-sim param        Quét một hằng số (--key rules.REGEN --values 4,6,8)
 *   node tools/pk-sim progress     Thời gian tu luyện ước tính để học đủ chiêu
 * Tùy chọn chung: --games N · --seed S · --level L (mặc định 7) · --mode eq|greedy|random (mặc định eq)
 *   --set khóa=số (nhiều lần; đổi hằng số / số liệu chiêu trong bộ nhớ, không sửa file) · --json · --fast (gom nhóm trạng thái để nhanh gấp đôi, hơi xấp xỉ)
 * Bot: random (chọn đều), greedy (tham lam một lượt), eq (cân bằng kéo-búa-bao mỗi lượt). Xem docs/VO-HOC-CAN-BANG.md.
 */
const C = require('./commands');
const progress = require('./progress');
const F = require('./format');

const HELP = `Dùng: node tools/pk-sim <lệnh> [tùy chọn]

Lệnh:
  roundrobin   đấu vòng tròn   --sets presets|pure|all|random:N  --games 150
  grid         quét 1365 bộ    --opp 24 --games 5 --top 30 --sample 120 --opp2 12 --games2 3 --finalists 12 --finalOpp 20 --finalGames 6
  buffs        buff theo Lc/Lq/Ld  --scales 0.25,0.5,1 --sets "Cương1|Tốc1|TQ TPQ KTB TLB" --games 80 --full --only max
  levels       chênh cấp       --pairs 10:1,7:1,5:3 --sets Cương1|Tốc1 --games 200
  param        quét hằng số    --key rules.REGEN --values 4,6,8 --games 60 --triGames 20 --watch TQ,TL --watchSet Cương1,Nhu1
  progress     thời gian tu luyện học đủ chiêu

Tùy chọn chung: --seed S --level L --mode eq|greedy|random --set khóa=số --json --fast --quiet
Khóa --set: rules.HẰNG_SỐ · skill.<id>.<đường.dẫn> (vd skill.tu-luc-pha-son.mana) · mana.base · mana.perLevel`;

function parse(argv) {
  const o = { _: [], set: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    if (['json', 'fast', 'quiet', 'full', 'help'].includes(k)) { o[k] = true; continue; }
    const v = argv[++i];
    if (v === undefined) throw new Error('Thiếu giá trị cho --' + k);
    if (k === 'set') o.set.push(v); else o[k] = v;
  }
  return o;
}

function main(argv) {
  const o = parse(argv), cmd = o._[0];
  if (!cmd || o.help || cmd === 'help') { console.log(HELP); return; }
  if (cmd === 'progress') {
    const rows = progress.report();
    if (o.json) { console.log(JSON.stringify(rows, null, 1)); return; }
    const h = m => (Number.isFinite(m) ? (m / 60).toFixed(1) + ' giờ' : '-');
    console.log(F.table(['Kiểu người chơi', 'Bậc 2', 'Bậc 3', 'Đủ 15 chiêu', 'Cấp tối đa + tâm đắc đầy'], rows.map(r => [r.kind, h(r.tiers[2].minutes), h(r.tiers[3].minutes), h(r.tiers[4].minutes), h(r.max.minutes)]), ['l', 'r', 'r', 'r', 'r']));
    return;
  }
  const table = {
    roundrobin: [C.roundrobin, r => C.printRoundrobin(r, C.common(o).ctx)],
    grid: [C.grid, C.printGrid], buffs: [C.buffs, C.printBuffs], levels: [C.levels, C.printLevels], param: [C.param, C.printParam]
  };
  if (!table[cmd]) { console.error('Lệnh không có: ' + cmd + '\n\n' + HELP); process.exitCode = 1; return; }
  const [run, print] = table[cmd];
  const res = run(o);
  console.log(o.json ? JSON.stringify(res, null, 1) : print(res));
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error('Lỗi: ' + e.message); process.exitCode = 1; }
}
module.exports = { main, parse };
