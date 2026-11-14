/* Kỳ Đài · danh mục skin sân và skin quân cờ (dùng chung Node + trình duyệt, không đụng DOM).
 * Đây là HỢP ĐỒNG giữa máy chủ (kiểm mã skin), bàn 2D, bàn 3D và công cụ Blender.
 * Thêm skin: thêm một mục ở đây + chạy tools/blender/kydao để sinh ảnh .webp và mô hình .glb cùng tên.
 * Thiết kế: docs/KE-HOACH-KY-DAI.md. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KydaoSkins = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Môn có hai nửa sân rõ ràng mới dùng skin sân và skin quân.
  const GAMES = ['chess', 'xiangqi', 'jieqi'];

  /* Skin sân. Mỗi người chỉ đổi NỬA SÂN CỦA MÌNH.
   * palette: light/dark = hai màu ô (cờ vua) hoặc nền/vân (cờ tướng); line = nét kẻ; glow = ánh viền và hiệu ứng; rim = thành bàn.
   * fx: kiểu hạt bay trên nửa sân ('ember' tàn lửa, 'ripple' gợn nước, 'leaf' lá, 'snow' tuyết, 'bubble' bọt, 'petal' cánh sen, 'spark' tia sét, 'sand' cát).
   * cry: khẩu hiệu hô khi khai mở; sub: dòng nhỏ dưới khẩu hiệu. */
  const FIELDS = {
    volcano: { name: 'Hỏa Diệm Sơn', cry: 'Khai mở lãnh địa!', sub: 'Hỏa Diệm Sơn · lửa thiêng rực cháy',
      palette: { light: '#d9743a', dark: '#3a1410', line: '#ffb347', glow: '#ff5a1f', rim: '#1d0c0a' }, fx: 'ember' },
    river: { name: 'Trường Giang', cry: 'Nước dâng ngập bờ!', sub: 'Trường Giang · sóng cuộn nghìn dặm',
      palette: { light: '#bfe3e0', dark: '#2f7f8c', line: '#e9fbff', glow: '#4fd6e8', rim: '#17424d' }, fx: 'ripple' },
    forest: { name: 'Đại Ngàn', cry: 'Vạn mộc trỗi dậy!', sub: 'Đại Ngàn · rừng thiêng che lối',
      palette: { light: '#b7d37a', dark: '#2f5d2b', line: '#f1ffc9', glow: '#7be35a', rim: '#1c3319' }, fx: 'leaf' },
    glacier: { name: 'Băng Sơn', cry: 'Vạn dặm đóng băng!', sub: 'Băng Sơn · tuyết phủ đỉnh trời',
      palette: { light: '#eaf6ff', dark: '#6fa3c8', line: '#ffffff', glow: '#9fe0ff', rim: '#2b4a66' }, fx: 'snow' },
    ocean: { name: 'Long Cung', cry: 'Biển sâu nổi sóng!', sub: 'Long Cung · đáy biển nghìn trùng',
      palette: { light: '#3fa7c9', dark: '#0b2f5c', line: '#9ff3ff', glow: '#27d3ff', rim: '#061a36' }, fx: 'bubble' },
    lotus: { name: 'Liên Hoa Đài', cry: 'Sen nở khắp cõi!', sub: 'Liên Hoa Đài · hương sen tịnh độ',
      palette: { light: '#ffe3ec', dark: '#c76a8f', line: '#fff7d6', glow: '#ffc94a', rim: '#6d2f4b' }, fx: 'petal' },
    thunder: { name: 'Lôi Vân Đỉnh', cry: 'Sấm rền chín tầng mây!', sub: 'Lôi Vân Đỉnh · mây giông vần vũ',
      palette: { light: '#b9b5e6', dark: '#2a2552', line: '#fff59a', glow: '#ffe84a', rim: '#15122e' }, fx: 'spark' },
    desert: { name: 'Sa Mạc Lưu Sa', cry: 'Cát vàng nổi bão!', sub: 'Lưu Sa · gió cuốn nghìn cồn',
      palette: { light: '#f1d79a', dark: '#b07a35', line: '#fff3cf', glow: '#ffcf5a', rim: '#5d3d17' }, fx: 'sand' }
  };

  /* Skin quân. Chỉ đổi chất liệu và dáng trang trí, KHÔNG đổi hình nhận diện quân.
   * a = quân bên đi trước (Trắng / Đỏ), b = bên đi sau (Đen). Hai bên luôn phải tương phản rõ.
   * base = màu thân, accent = viền/chi tiết, glow = ánh phát sáng (null = không), rough/metal cho bàn 3D. */
  const PIECES = {
    magma: { name: 'Dung Nham', a: { base: '#ffcf8a', accent: '#ff6a1f', glow: '#ff7a2a' }, b: { base: '#2a1512', accent: '#ff4a12', glow: '#ff3a00' }, rough: 0.55, metal: 0.1 },
    jade: { name: 'Ngọc Bích', a: { base: '#e8fff0', accent: '#58c08a', glow: null }, b: { base: '#1f5a43', accent: '#9be8c2', glow: null }, rough: 0.2, metal: 0.0 },
    wood: { name: 'Mộc Linh', a: { base: '#f0d9a8', accent: '#6fae3c', glow: null }, b: { base: '#4a2f1b', accent: '#8fd65a', glow: null }, rough: 0.8, metal: 0.0 },
    ice: { name: 'Băng Tinh', a: { base: '#f4fbff', accent: '#8fd0ff', glow: '#bfeaff' }, b: { base: '#274a73', accent: '#7fd4ff', glow: '#5fc4ff' }, rough: 0.08, metal: 0.0 },
    coral: { name: 'San Hô', a: { base: '#ffe9dc', accent: '#ff7f6a', glow: null }, b: { base: '#12365e', accent: '#35d0c8', glow: null }, rough: 0.5, metal: 0.0 },
    bronze: { name: 'Đồng Cổ', a: { base: '#e8c476', accent: '#fff0b8', glow: null }, b: { base: '#4b3a2a', accent: '#c9964a', glow: null }, rough: 0.35, metal: 0.9 },
    storm: { name: 'Lôi Thạch', a: { base: '#ecebff', accent: '#ffe84a', glow: '#fff59a' }, b: { base: '#221f45', accent: '#b9a8ff', glow: '#8f7bff' }, rough: 0.4, metal: 0.3 },
    sandstone: { name: 'Sa Thạch', a: { base: '#f6e3b4', accent: '#c98f3c', glow: null }, b: { base: '#6b4520', accent: '#f0c060', glow: null }, rough: 0.9, metal: 0.0 }
  };

  /* Skin ĐÁ cho cờ vây và caro (bàn của hai môn này không có skin).
   * a = bên đi trước (cờ vây: Đen; caro: X) luôn là viên TỐI; b = bên đi sau (Trắng; O) luôn là viên SÁNG.
   * base = màu thân viên đá, accent = vân/đốm, glow = ánh phát sáng (null = không), mark = màu dấu X/O khắc trên đá caro.
   * Ảnh render từ Blender: stonesAtlas(id) = 2 ô 128 px (a trái, b phải), nhìn từ trên xuống. */
  const STONE_GAMES = ['go', 'gomoku'];
  const STONES = {
    cosmos: { name: 'Tinh Hà', a: { base: '#120c2e', accent: '#8f7bff', glow: '#b9a8ff', mark: '#e9e4ff' }, b: { base: '#f3ecff', accent: '#ff9fd8', glow: '#ffd6f2', mark: '#3a1f6b' } },
    forest: { name: 'Lâm Tuyền', a: { base: '#14301c', accent: '#5fae4a', glow: null, mark: '#d9f7c4' }, b: { base: '#f1ecd6', accent: '#9bbf6a', glow: null, mark: '#24451f' } },
    ocean: { name: 'Bích Hải', a: { base: '#0a2348', accent: '#27c3e8', glow: '#27d3ff', mark: '#d2f6ff' }, b: { base: '#f4fbff', accent: '#8fd8ea', glow: null, mark: '#0d3566' } },
    magma: { name: 'Dung Nham', a: { base: '#1d0f0c', accent: '#ff5a1f', glow: '#ff7a2a', mark: '#ffd9a8' }, b: { base: '#ffd9a0', accent: '#ff8a3a', glow: '#ffb347', mark: '#5a1c0a' } },
    glacier: { name: 'Băng Phách', a: { base: '#173a5c', accent: '#7fd4ff', glow: '#9fe0ff', mark: '#eaf8ff' }, b: { base: '#f6fcff', accent: '#bfe6ff', glow: null, mark: '#1d4a73' } },
    lotus: { name: 'Liên Tử', a: { base: '#3a1f2c', accent: '#d9779c', glow: null, mark: '#ffe3ec' }, b: { base: '#ffe9f0', accent: '#ffc94a', glow: null, mark: '#7a2f4e' } },
    thunder: { name: 'Lôi Châu', a: { base: '#1a1740', accent: '#ffe84a', glow: '#fff59a', mark: '#fff7c2' }, b: { base: '#f2f0ff', accent: '#b9a8ff', glow: null, mark: '#2a2560' } },
    sand: { name: 'Kim Sa', a: { base: '#4a3018', accent: '#e0a84a', glow: null, mark: '#ffe9b8' }, b: { base: '#f7e6b8', accent: '#d9a441', glow: null, mark: '#5d3d17' } }
  };

  const has = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);

  /** Môn có skin SÂN (và skin quân kiểu cờ vua/cờ tướng). Giữ nghĩa cũ. */
  function supports(game) { return GAMES.indexOf(game) !== -1; }
  /** Môn có skin quân: ba môn trên dùng PIECES, cờ vây và caro dùng STONES. */
  function supportsPieces(game) { return supports(game) || STONE_GAMES.indexOf(game) !== -1; }
  /** Bảng skin quân của một môn: PIECES hoặc STONES. */
  function piecesTable(game) { return STONE_GAMES.indexOf(game) !== -1 ? STONES : PIECES; }

  /** Chuẩn hóa dữ liệu skin bất kỳ (kể cả từ client) về { field, pieces }; mã lạ thành null.
   *  game (tuỳ chọn): cờ vây/caro thì field luôn null và pieces tra trong STONES; thiếu game = như cờ vua/cờ tướng. */
  function normalize(input, game) {
    const o = input && typeof input === 'object' ? input : {};
    const stone = STONE_GAMES.indexOf(game) !== -1;
    return {
      field: !stone && has(FIELDS, o.field) ? o.field : null,
      pieces: has(stone ? STONES : PIECES, o.pieces) ? o.pieces : null
    };
  }

  function field(id) { return has(FIELDS, id) ? FIELDS[id] : null; }
  function pieces(id) { return has(PIECES, id) ? PIECES[id] : null; }
  function stones(id) { return has(STONES, id) ? STONES[id] : null; }
  /** Ảnh đá render từ Blender: 256x128, ô trái là đá bên a (tối), ô phải là đá bên b (sáng). */
  function stonesAtlas(id) { return has(STONES, id) ? '/img/kydao/stones/' + id + '.webp' : null; }

  /** Đường dẫn tài nguyên sinh từ Blender (xem tools/blender/kydao). */
  function fieldImage(id) { return has(FIELDS, id) ? '/img/kydao/fields/' + id + '.webp' : null; }
  /** Ảnh sân v2: cảnh 3D render từ trên xuống, có dải cảnh quanh bàn (1408x704, 128 px mỗi ô). Bản riêng cho cờ vua và cờ tướng/cờ úp. */
  function fieldImage2(id, game) { return has(FIELDS, id) ? '/img/kydao/fields2/' + id + (game === 'chess' ? '-chess' : '-xiangqi') + '.webp' : null; }
  /** Huy hiệu tròn của chủ đề sân (256x256), dùng trong bộ chọn và cạnh khẩu hiệu. */
  function crest(id) { return has(FIELDS, id) ? '/img/kydao/ui/crest-' + id + '.webp' : null; }
  /** Ảnh quân 2D render từ mô hình 3D: lưới 7 cột (K Q R B N P disc) x 2 hàng (a trên, b dưới), mỗi ô 128 px. */
  function piecesAtlas(id) { return has(PIECES, id) ? '/img/kydao/pieces2d/' + id + '.webp' : null; }
  function fieldModel(id) { return has(FIELDS, id) ? '/models/kydao/fields/' + id + '.glb' : null; }
  function piecesModel(id) { return has(PIECES, id) ? '/models/kydao/pieces/' + id + '.glb' : null; }
  function thumb(kind, id) {
    const ok = kind === 'field' ? has(FIELDS, id) : kind === 'pieces' ? has(PIECES, id) : false;
    return ok ? '/img/kydao/thumbs/' + kind + '-' + id + '.webp' : null;
  }

  return { GAMES, STONE_GAMES, FIELDS, PIECES, STONES, supports, supportsPieces, piecesTable, normalize, field, pieces, stones, stonesAtlas, fieldImage, fieldImage2, crest, piecesAtlas, fieldModel, piecesModel, thumb };
});
