/*
 * Danh sách bài tụng — dùng chung cho máy chủ (tính thời lượng) và trình duyệt (chữ chạy + âm thanh).
 * Mỗi chữ (âm tiết) ứng với một tiếng mõ, như cách tụng ở chùa.
 */
(function (root) {
  'use strict';
  const BATNHA = [
    'Ma Ha Bát Nhã Ba La Mật Đa Tâm Kinh.',
    'Quán Tự Tại Bồ Tát hành thâm Bát Nhã Ba La Mật Đa thời,',
    'chiếu kiến ngũ uẩn giai không, độ nhất thiết khổ ách.',
    'Xá Lợi Tử! Sắc bất dị không, không bất dị sắc,',
    'sắc tức thị không, không tức thị sắc,',
    'thọ tưởng hành thức diệc phục như thị.',
    'Xá Lợi Tử! Thị chư pháp không tướng,',
    'bất sanh bất diệt, bất cấu bất tịnh, bất tăng bất giảm.',
    'Thị cố không trung vô sắc, vô thọ tưởng hành thức,',
    'vô nhãn nhĩ tỷ thiệt thân ý, vô sắc thanh hương vị xúc pháp,',
    'vô nhãn giới nãi chí vô ý thức giới,',
    'vô vô minh diệc vô vô minh tận,',
    'nãi chí vô lão tử, diệc vô lão tử tận,',
    'vô khổ tập diệt đạo, vô trí diệc vô đắc.',
    'Dĩ vô sở đắc cố, Bồ Đề Tát Đỏa y Bát Nhã Ba La Mật Đa cố,',
    'tâm vô quái ngại, vô quái ngại cố, vô hữu khủng bố,',
    'viễn ly điên đảo mộng tưởng, cứu cánh Niết Bàn.',
    'Tam thế chư Phật y Bát Nhã Ba La Mật Đa cố,',
    'đắc A Nậu Đa La Tam Miệu Tam Bồ Đề.',
    'Cố tri Bát Nhã Ba La Mật Đa thị đại thần chú, thị đại minh chú,',
    'thị vô thượng chú, thị vô đẳng đẳng chú,',
    'năng trừ nhất thiết khổ, chân thật bất hư.',
    'Cố thuyết Bát Nhã Ba La Mật Đa chú, tức thuyết chú viết:',
    'Yết đế yết đế, ba la yết đế, ba la tăng yết đế, Bồ Đề tát bà ha.',
    'Yết đế yết đế, ba la yết đế, ba la tăng yết đế, Bồ Đề tát bà ha.',
    'Yết đế yết đế, ba la yết đế, ba la tăng yết đế, Bồ Đề tát bà ha.'
  ];

  const TRACKS = {
    batnha: { title: 'Bát Nhã Tâm Kinh', beat: 0.6, f0: 130, voice: true, lines: BATNHA, restMode: 'stop', bellAfterStop: true, endBells: 3 },
    niemphat: { title: 'Niệm Phật A Di Đà', beat: 0.82, f0: 122, voice: true, lines: Array(12).fill('Nam Mô A Di Đà Phật'), restN: 2, bellEvery: 4, endBells: 2 },
    quanam: { title: 'Niệm Quán Thế Âm Bồ Tát', beat: 0.66, f0: 126, voice: true, lines: Array(9).fill('Nam Mô Đại Từ Đại Bi Cứu Khổ Cứu Nạn Quán Thế Âm Bồ Tát'), restN: 1, bellEvery: 3, endBells: 2 },
    thien: { title: 'Chuông mõ ngồi thiền', beat: 1.3, f0: 0, voice: false, lines: Array.from({ length: 20 }, (_, i) => (i % 2 ? 'Thở ra' : 'Hít vào')), restN: 2, moFirstOnly: true, bellEvery: 4, endBells: 3 }
  };

  const END_BELL_GAP = 2.6;

  function build(id) {
    const tr = TRACKS[id];
    if (!tr) return null;
    const beats = [];
    tr.lines.forEach((line, li) => {
      const first = beats.length;
      line.split(/\s+/).filter(Boolean).forEach((syl, si) => beats.push({ li, si, syl }));
      const rest = tr.restMode === 'stop' ? (/[.!:]$/.test(line) ? 1 : 0) : (tr.restN || 0);
      for (let k = 0; k < rest; k++) beats.push({ li, si: -1, syl: null });
      beats[first].first = true;
      if (li === 0 || (tr.bellEvery && li % tr.bellEvery === 0) || (tr.bellAfterStop && li > 0 && /[.!]$/.test(tr.lines[li - 1]))) beats[first].bell = true;
    });
    const endAt = beats.length * tr.beat;
    const endBells = Array.from({ length: tr.endBells }, (_, k) => endAt + 0.3 + k * END_BELL_GAP);
    const duration = endAt + 0.3 + tr.endBells * END_BELL_GAP + 1.5;
    return { id, tr, beats, endAt, endBells, duration };
  }

  const api = { TRACKS, build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CHANTS = api;
})(this);
