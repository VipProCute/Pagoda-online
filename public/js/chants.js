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

  // Chú Đại Bi: khai chú rồi 84 câu (public/kinh/chu-dai-bi.md). Câu ngắn ghép với câu kế tiếp
  // ("Án" với câu sau, câu trước với "Ta Bà Ha") để máy đọc liền hơi; phần kết tụng đủ ba lần.
  const KET_DAIBI = 'Án Tất Điện Đô, Mạn Đà Ra, Bạt Đà Dạ, Ta Bà Ha.';
  const DAIBI = [
    'Nam Mô Đại Bi Hội Thượng Phật Bồ Tát.',
    'Nam Mô Đại Bi Hội Thượng Phật Bồ Tát.',
    'Nam Mô Đại Bi Hội Thượng Phật Bồ Tát.',
    'Thiên Thủ Thiên Nhãn, Vô Ngại Đại Bi Tâm Đà La Ni.',
    'Nam Mô Hắc Ra Đát Na Đa Ra Dạ Da,',
    'Nam Mô A Rị Da,',
    'Bà Lô Yết Đế Thước Bát Ra Da,',
    'Bồ Đề Tát Đỏa Bà Da,',
    'Ma Ha Tát Đỏa Bà Da,',
    'Ma Ha Ca Lô Ni Ca Da,',
    'Án, Tát Bàn Ra Phạt Duệ,',
    'Số Đát Na Đát Tỏa,',
    'Nam Mô Tất Kiết Lật Đỏa Y Mông A Rị Da,',
    'Bà Lô Yết Đế Thất Phật Ra Lăng Đà Bà,',
    'Nam Mô Na Ra Cẩn Trì,',
    'Hê Rị Ma Ha Bàn Đa Sa Mế,',
    'Tát Bà A Tha Đậu Du Bằng,',
    'A Thệ Dựng,',
    'Tát Bà Tát Đa, Na Ma Bà Tát Đa, Na Ma Bà Già,',
    'Ma Phạt Đạt Đậu,',
    'Đát Điệt Tha,',
    'Án, A Bà Lô Hê,',
    'Lô Ca Đế,',
    'Ca Ra Đế,',
    'Di Hê Rị,',
    'Ma Ha Bồ Đề Tát Đỏa,',
    'Tát Bà Tát Bà,',
    'Ma Ra Ma Ra,',
    'Ma Hê Ma Hê Rị Đà Dựng,',
    'Cu Lô Cu Lô Yết Mông,',
    'Độ Lô Độ Lô Phạt Xà Da Đế,',
    'Ma Ha Phạt Xà Da Đế,',
    'Đà Ra Đà Ra,',
    'Địa Rị Ni,',
    'Thất Phật Ra Da,',
    'Giá Ra Giá Ra,',
    'Mạ Mạ Phạt Ma Ra,',
    'Mục Đế Lệ,',
    'Y Hê Y Hê,',
    'Thất Na Thất Na,',
    'A Ra Sâm Phật Ra Xá Lợi,',
    'Phạt Sa Phạt Sâm,',
    'Phật Ra Xá Da,',
    'Hô Lô Hô Lô Ma Ra,',
    'Hô Lô Hô Lô Hê Rị,',
    'Ta Ra Ta Ra,',
    'Tất Rị Tất Rị,',
    'Tô Rô Tô Rô,',
    'Bồ Đề Dạ Bồ Đề Dạ,',
    'Bồ Đà Dạ Bồ Đà Dạ,',
    'Di Đế Rị Dạ,',
    'Na Ra Cẩn Trì,',
    'Địa Rị Sắc Ni Na,',
    'Ba Dạ Ma Na, Ta Bà Ha,',
    'Tất Đà Dạ, Ta Bà Ha,',
    'Ma Ha Tất Đà Dạ, Ta Bà Ha,',
    'Tất Đà Du Nghệ,',
    'Thất Bàn Ra Dạ, Ta Bà Ha,',
    'Na Ra Cẩn Trì, Ta Bà Ha,',
    'Ma Ra Na Ra, Ta Bà Ha,',
    'Tất Ra Tăng A Mục Khê Da, Ta Bà Ha,',
    'Ta Bà Ma Ha A Tất Đà Dạ, Ta Bà Ha,',
    'Giả Kiết Ra A Tất Đà Dạ, Ta Bà Ha,',
    'Ba Đà Ma Yết Tất Đà Dạ, Ta Bà Ha,',
    'Na Ra Cẩn Trì Bàn Dà Ra Dạ, Ta Bà Ha,',
    'Ma Bà Lợi Thắng Yết Ra Dạ, Ta Bà Ha,',
    'Nam Mô Hắc Ra Đát Na Đa Ra Dạ Da,',
    'Nam Mô A Rị Da,',
    'Bà Lô Yết Đế,',
    'Thước Bàn Ra Dạ, Ta Bà Ha.',
    KET_DAIBI, KET_DAIBI, KET_DAIBI
  ];

  // Dược Sư: khai kinh, Chú Dược Sư ba biến (theo public/kinh/kinh-duoc-su.md), rồi niệm hồng danh.
  // Toàn văn kinh (khoảng 6.000 chữ) quá dài cho một khóa tụng chung nên đọc trong Tàng Kinh Các.
  const CHU_DUOCSU = [
    'Nam Mô Bạc Già Phạt Đế, Bệ Sát Xã, Lũ Rô, Bệ Lưu Ly,',
    'Bát Lạt Bà, Hắt Ra Xà Dã, Đát Tha Yết Đa Gia,',
    'A Ra Ha Đế, Tam Miệu Tam Bột Đà Gia.',
    'Đát Điệt Tha: Án, Bệ Sát Thệ, Bệ Sát Thệ, Bệ Sát Xã, Tam Một Yết Đế Sa Ha.'
  ];
  const DUOCSU = [].concat(
    Array(3).fill('Nam Mô Dược Sư Hội Thượng Phật Bồ Tát.'),
    CHU_DUOCSU, CHU_DUOCSU, CHU_DUOCSU,
    Array(9).fill('Nam Mô Dược Sư Lưu Ly Quang Vương Phật')
  );

  const TRACKS = {
    batnha: { title: 'Bát Nhã Tâm Kinh', beat: 0.6, f0: 130, voice: true, lines: BATNHA, restMode: 'stop', bellAfterStop: true, endBells: 3 },
    daibi: { title: 'Chú Đại Bi', beat: 0.5, f0: 130, voice: true, lines: DAIBI, restMode: 'stop', bellAfterStop: true, endBells: 3 },
    duocsu: { title: 'Chú Dược Sư', beat: 0.55, f0: 128, voice: true, lines: DUOCSU, restMode: 'stop', bellAfterStop: true, endBells: 3 },
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
