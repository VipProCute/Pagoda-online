'use strict';
/* T-180: danh sách loại nhang và bài kinh (dữ liệu từ máy chủ) phải dựng bằng DOM + textContent, không qua innerHTML. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '..', 'public/js/app.js'), 'utf8').replace(/\r\n/g, '\n');

const from = app.indexOf("$('#incKinds')");
const to = app.indexOf("$('#donCard').hidden", from);
const snippet = app.slice(from, to);

test('app.js: #incKinds và #trackList không còn gán bằng innerHTML', () => {
  assert.ok(from > 0 && to > from, 'không tìm thấy đoạn dựng #incKinds/#trackList');
  assert.doesNotMatch(snippet, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.doesNotMatch(app, /\$\('#incKinds'\)\.innerHTML/);
  assert.doesNotMatch(app, /\$\('#trackList'\)\.innerHTML/);
});

/** DOM giả tối thiểu: đủ createElement/append/replaceChildren/textContent/dataset để chạy đoạn dựng thật. */
function fakeDom() {
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.className = ''; this._text = ''; }
    append(...kids) { this.children.push(...kids); }
    replaceChildren(...kids) { this.children = [...kids]; }
    set textContent(v) { this._text = String(v); this.children = []; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  }
  return { document: { createElement: tag => new Node(tag) }, Node };
}

test('app.js: dựng #incKinds và #trackList giữ nguyên văn chữ lạ dưới dạng text, cấu trúc như cũ', () => {
  const { document, Node } = fakeDom();
  const boxes = { '#incKinds': new Node('div'), '#trackList': new Node('div') };
  const cfg = {
    kinds: ['<img src=x onerror=1>', 'Cầu an'],
    tracks: { '"><script>': { title: '<b>x</b>', duration: 125 }, 'tam-kinh': { title: 'Kinh', duration: 10 } }
  };
  vm.runInNewContext(snippet, { $: s => boxes[s], document, cfg });

  const kinds = boxes['#incKinds'].children;
  assert.equal(kinds.length, 2);
  kinds.forEach((lb, i) => {
    assert.equal(lb.tag, 'label'); assert.equal(lb.className, 'chipr');
    const [inp, sp] = lb.children;
    assert.equal(inp.tag, 'input'); assert.equal(inp.type, 'radio'); assert.equal(inp.name, 'kind');
    assert.equal(inp.value, cfg.kinds[i]);
    assert.equal(!!inp.checked, i === 0, 'chỉ radio đầu được chọn');
    assert.equal(sp.tag, 'span'); assert.equal(sp.textContent, cfg.kinds[i]);
    assert.equal(lb.children.length, 2, 'không sinh phần tử lạ');
  });

  const tracks = boxes['#trackList'].children;
  assert.equal(tracks.length, 2);
  const ids = Object.keys(cfg.tracks);
  tracks.forEach((btn, i) => {
    assert.equal(btn.tag, 'button'); assert.equal(btn.type, 'button'); assert.equal(btn.className, 'track');
    assert.equal(btn.dataset.track, ids[i]);
    const [b, sm] = btn.children;
    assert.equal(b.tag, 'b'); assert.equal(b.textContent, cfg.tracks[ids[i]].title);
    assert.equal(sm.tag, 'small'); assert.equal(btn.children.length, 2);
  });
  assert.equal(tracks[0].children[1].textContent, 'khoảng 2 phút');
  assert.equal(tracks[1].children[1].textContent, 'khoảng 1 phút', 'tối thiểu 1 phút');
});
