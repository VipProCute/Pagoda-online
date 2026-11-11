/* Tarot theo chủ đề (KH §7.2, D10): chọn chủ đề → khung → trải 5 lá → lời thầy.
 * Máy chủ rút bài (tarot:draw); file này chỉ hiển thị. Hàm tổng hợp `synthesize` là hàm thuần (dùng được ở Node để test).
 * Chữ từ dữ liệu gán bằng textContent, không innerHTML. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tarot = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const TOPICS = ['overview', 'career', 'work', 'money', 'love', 'family', 'health', 'study'];
  const TOPIC_ICON = { overview: '☯', career: '⛰', work: '✎', money: '◎', love: '❀', family: '⌂', health: '☘', study: '✧' };
  const SPANS = [7, 30, 90];
  const POSITIONS = ['present', 'obstacle', 'support', 'advice', 'outlook'];   // thứ tự lá 1..5 máy chủ trả về
  const SUIT_KEYS = ['wands', 'cups', 'swords', 'pentacles'];
  const MIN_LINES = 5;   // lời thầy tối thiểu 5 dòng (KH §7.2 bước 4)

  /** Khóa nội dung theo chủ đề: tình duyên tách theo tình trạng. */
  function topicKey(topic, status) {
    return topic === 'love' ? (status === 'couple' ? 'love_couple' : 'love_single') : topic;
  }

  /** Thay {topic} / {span} trong câu dẫn. */
  function fill(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
  }

  /** Câu của một lá ở một chiều: chủ đề (hoặc phần chung nếu thiếu). */
  function cardText(card, topic, status, rev) {
    const o = rev ? 'rev' : 'up';
    const t = card.topic && card.topic[topicKey(topic, status)];
    return (t && t[o]) || (card.general && card.general[o]) || '';
  }

  /**
   * Lời thầy tổng hợp (KH §7.2 bước 4). Thuần: không DOM, không ngẫu nhiên.
   * data: nội dung tarot.vi.json; draw: [{ id, rev }] đủ 5 lá theo thứ tự vị trí.
   * Trả mảng 5–8 dòng (mỗi dòng là một đoạn ngắn, có thể gồm 1–2 câu).
   */
  function synthesize(data, draw, topic, status) {
    const s = data.synthesis, out = [];
    const cards = draw.map(d => ({ card: data.cards[d.id], rev: !!d.rev }));
    const majors = cards.filter(c => c.card.arcana === 'major').length;
    if (majors >= 3) out.push(s.majorMany);
    else if (majors === 0) out.push(s.majorNone);
    const bySuit = {};
    for (const c of cards) if (c.card.suit) bySuit[c.card.suit] = (bySuit[c.card.suit] || 0) + 1;
    for (const k of SUIT_KEYS) if (bySuit[k] >= 2 && s.suit[k]) out.push(s.suit[k]);
    if (cards.filter(c => c.rev).length >= 3) out.push(s.reversedMany);
    if (cards.filter(c => c.card.arcana !== 'major' && c.card.rank >= 11).length >= 2) out.push(s.courtMany);
    // Đủ tối thiểu 5 dòng: thiếu thì tóm thêm lá Hiện tại, Điều cản trở, Điều nâng đỡ (theo thứ tự)
    const vars = { topic: String((data.topics && data.topics[topic]) || '').toLowerCase() };
    const tail = 2 + (s.closing && s.closing[topic] ? 1 : 0);   // lời khuyên, xu hướng, (câu kết)
    for (const pos of ['present', 'obstacle', 'support']) {
      if (out.length + tail >= MIN_LINES) break;
      const c = cards[POSITIONS.indexOf(pos)];
      out.push(`${fill(data.positions[pos], vars)} ${cardText(c.card, topic, status, c.rev)}`);
    }
    const adv = cards[POSITIONS.indexOf('advice')], out5 = cards[POSITIONS.indexOf('outlook')];
    out.push(`${s.adviceLead} ${adv.card.advice[adv.rev ? 'rev' : 'up']}`);
    out.push(`${s.outlookLead} ${cardText(out5.card, topic, status, out5.rev)}`);
    if (s.closing && s.closing[topic]) out.push(s.closing[topic]);
    return out;
  }

  /* ---------- Giao diện (chỉ chạy trong trình duyệt) ---------- */

  const DATA_URL = '/data/tarot.vi.json?v=1';
  let dataPromise = null;
  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL).then(r => { if (!r.ok) throw new Error('http'); return r.json(); })
        .catch(e => { dataPromise = null; throw e; });
    }
    return dataPromise;
  }

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  /** root: phần tử #tarot-app; socket; toast. Trả { open(), stop() }. */
  function init({ root: box, socket, toast }) {
    const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let data = null, ask = { topic: null, span: 30, status: '' }, timers = [], token = 0, busy = false;

    function stop() { timers.forEach(clearTimeout); timers = []; token++; busy = false; }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

    function show(list) { box.replaceChildren(...list); }

    function stepTopics() {
      stop();
      const grid = h('div', 'tarot-topics');
      TOPICS.forEach(t => {
        const b = h('button', 'tarot-topic'); b.type = 'button';
        b.append(h('span', 'tarot-ico', TOPIC_ICON[t]), h('span', null, data.topics[t]));
        b.onclick = () => { ask.topic = t; ask.status = ''; t === 'love' ? stepStatus() : stepSpan(); };
        grid.append(b);
      });
      show([h('p', 'tarot-step', 'Bước 1 · Bạn muốn hỏi về điều gì?'), grid, h('p', 'hint', data.disclaimer)]);
    }

    function stepStatus() {
      const row = h('div', 'tarot-choices');
      [['single', 'Đang một mình'], ['couple', 'Đang có đôi']].forEach(([v, label]) => {
        const b = h('button', 'tarot-choice', label); b.type = 'button';
        b.onclick = () => { ask.status = v; stepSpan(); };
        row.append(b);
      });
      show([h('p', 'tarot-step', 'Tình duyên · Hiện giờ bạn thế nào?'), row, backBtn(stepTopics)]);
    }

    function stepSpan() {
      const row = h('div', 'tarot-choices');
      SPANS.forEach(sp => {
        const b = h('button', 'tarot-choice' + (sp === 30 ? ' main' : ''), data.spans[sp]); b.type = 'button';
        b.onclick = () => { ask.span = sp; draw(); };
        row.append(b);
      });
      show([h('p', 'tarot-step', `Bước 2 · Chuyện ${data.topics[ask.topic].toLowerCase()}: nhìn trong bao lâu?`), row, backBtn(ask.topic === 'love' ? stepStatus : stepTopics)]);
    }

    function backBtn(fn) {
      const b = h('button', 'btn tarot-prev', '‹ Quay lại'); b.type = 'button'; b.onclick = fn; return b;
    }

    function draw() {
      if (busy) return;
      busy = true;
      show([h('p', 'tarot-step', 'Thầy đang xáo bài…')]);
      const my = ++token, payload = { topic: ask.topic, span: ask.span };
      if (ask.topic === 'love') payload.status = ask.status;
      socket.emit('tarot:draw', payload, r => {
        if (my !== token) return;
        busy = false;
        if (!r || !r.ok || !Array.isArray(r.cards) || r.cards.length !== 5) {
          toast((r && r.reason) || 'Chưa trải bài được, bạn thử lại nhé.');
          stepSpan(); return;
        }
        spread(r.cards, !!r.again);
      });
    }

    function spread(cards, again) {
      const topicLabel = data.topics[ask.topic].toLowerCase(), spanLabel = data.spans[ask.span];
      const vars = { topic: topicLabel, span: spanLabel };
      const wrap = h('div', 'tarot-spread');
      const faces = [], flipped = new Array(5).fill(false);
      const reading = h('div', 'tarot-reading'); reading.setAttribute('aria-live', 'polite');
      reading.hidden = true;

      function flip(i) {
        if (flipped[i]) return;
        flipped[i] = true;
        const el = faces[i];
        el.classList.add('flipped');
        el.querySelector('.tarot-back').hidden = true;
        el.querySelector('.tarot-front').hidden = false;
        el.removeAttribute('aria-label');   // để trình đọc màn hình đọc nội dung mặt trước
        if (flipped.every(Boolean)) finish();
      }
      function finish() {
        all.hidden = true;
        reading.replaceChildren(h('h3', null, 'Lời thầy'));
        synthesize(data, cards, ask.topic, ask.status).forEach(line => reading.append(h('p', null, line)));
        reading.hidden = false;
        const again2 = h('button', 'btn', 'Hỏi chủ đề khác'); again2.type = 'button'; again2.onclick = stepTopics;
        reading.append(again2, h('p', 'hint', data.disclaimer));
      }

      cards.forEach((d, i) => {
        const pos = POSITIONS[i], card = data.cards[d.id];
        const el = h('button', `tarot-card pos-${pos}${pos === 'advice' ? ' key' : ''}${d.rev ? ' rev' : ''}`);
        el.type = 'button';
        el.setAttribute('aria-label', `Lá ${i + 1}, ${fill(data.positions[pos], vars)} Chạm để lật.`);
        const back = h('span', 'tarot-back-face tarot-back');
        back.append(h('b', null, `${i + 1}`), h('span', null, pos === 'advice' ? 'Lời khuyên' : posName(pos)), h('small', null, 'Chạm để lật'));
        const front = h('span', 'tarot-front'); front.hidden = true;
        front.append(
          h('em', null, fill(data.positions[pos], vars)),
          h('strong', null, `${card.vi}${d.rev ? ' (ngược)' : ''}`),
          h('small', null, card.keys[d.rev ? 'rev' : 'up']),
          h('span', 'tarot-text', pos === 'advice' ? `${card.advice[d.rev ? 'rev' : 'up']} ${cardText(card, ask.topic, ask.status, d.rev)}` : cardText(card, ask.topic, ask.status, d.rev))
        );
        el.append(back, front);
        el.onclick = () => flip(i);   // chuỗi tự lật vẫn chạy tiếp (flip bỏ qua lá đã lật)
        faces.push(el); wrap.append(el);
      });

      const head = [h('p', 'tarot-step', `${data.topics[ask.topic]} · ${spanLabel}${ask.status ? (ask.status === 'couple' ? ' · đang có đôi' : ' · đang một mình') : ''}`)];
      if (again) head.push(h('p', 'tarot-again', data.againText));
      const all = h('button', 'btn', 'Lật hết'); all.type = 'button';
      all.onclick = () => { timers.forEach(clearTimeout); timers = []; faces.forEach((_, i) => flip(i)); all.hidden = true; };
      show([...head, wrap, all, reading, h('p', 'hint', 'Lá ngược được luận theo chiều ngược; tương lai là một khả năng, không phải dự đoán chắc chắn.')]);

      // lật lần lượt; giảm chuyển động thì lật ngay
      if (reduced()) { faces.forEach((_, i) => flip(i)); all.hidden = true; }
      else faces.forEach((_, i) => later(() => { flip(i); if (i === 4) all.hidden = true; }, 900 * (i + 1)));
    }

    const POS_NAME = { present: 'Hiện tại', obstacle: 'Điều cản trở', support: 'Điều nâng đỡ', advice: 'Lời khuyên', outlook: 'Xu hướng' };
    function posName(p) { return POS_NAME[p]; }

    /** Mở phần tarot: nạp dữ liệu lần đầu rồi về bước 1. */
    function open() {
      if (data) { stepTopics(); return; }
      show([h('p', 'tarot-step', 'Đang mở bộ bài…')]);
      loadData().then(d => { data = d; stepTopics(); })
        .catch(() => show([h('p', 'tarot-step', 'Chưa mở được bộ bài. Bạn đóng hộp rồi mở lại nhé.')]));
    }
    return { open, stop };
  }

  return { TOPICS, SPANS, POSITIONS, topicKey, cardText, synthesize, init };
});
