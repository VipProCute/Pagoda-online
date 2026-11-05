/*
 * Âm thanh tạo bằng Web Audio: mõ, chuông, giọng tụng mô phỏng.
 * Khi có bản thu thật của chư tăng, thay phần "sing" bằng file âm thanh + mốc thời gian.
 */
(function (root) {
  'use strict';
  let AC = null, OUT, BUS, REV, NOISE;
  let volume = 0.8, muted = false, voiceOn = true;

  function ctx() {
    if (!AC) {
      const C = root.AudioContext || root.webkitAudioContext;
      if (!C) return null;
      AC = new C();
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(AC.destination);
      OUT = AC.createGain(); OUT.gain.value = muted ? 0 : volume; OUT.connect(comp);
      BUS = AC.createGain(); BUS.connect(OUT);
      const conv = AC.createConvolver(); conv.buffer = impulse(2.8);
      REV = AC.createGain(); REV.gain.value = 0.34; REV.connect(conv); conv.connect(OUT);
      const len = AC.sampleRate; NOISE = AC.createBuffer(1, len, AC.sampleRate);
      const d = NOISE.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  const live = () => !!(AC && AC.state === 'running' && !muted);
  function impulse(sec) {
    const len = Math.floor(AC.sampleRate * sec), b = AC.createBuffer(2, len, AC.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4); }
    return b;
  }
  function out(node, wet) { node.connect(BUS); const s = AC.createGain(); s.gain.value = wet; node.connect(s); s.connect(REV); }
  function env(g, t, peak, atk, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); }
  function noiseBurst(t, freq, q, peak, dur, wet) {
    const n = AC.createBufferSource(); n.buffer = NOISE;
    const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = AC.createGain(); env(g, t, peak, 0.002, dur);
    n.connect(f); f.connect(g); out(g, wet); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.02);
  }
  const at = t => (t == null ? AC.currentTime + 0.01 : t);

  function mo(t, v = 1) {
    if (!live()) return; t = at(t);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(560, t); o.frequency.exponentialRampToValueAtTime(390, t + 0.08);
    env(g, t, 0.75 * v, 0.004, 0.2); o.connect(g); out(g, 0.45); o.start(t); o.stop(t + 0.24);
    const o2 = AC.createOscillator(), g2 = AC.createGain();
    o2.type = 'triangle'; o2.frequency.setValueAtTime(1210, t);
    env(g2, t, 0.16 * v, 0.002, 0.06); o2.connect(g2); out(g2, 0.3); o2.start(t); o2.stop(t + 0.08);
    noiseBurst(t, 1900, 1.2, 0.22 * v, 0.03, 0.2);
  }
  function bell(t, v = 1, base = 174, decay = 1) {
    if (!live()) return; t = at(t);
    const P = [[0.5, .34, 9], [1, .55, 7], [1.19, .26, 5.5], [1.5, .17, 4.5], [2, .3, 4], [2.52, .11, 3], [2.66, .1, 2.6], [3.01, .11, 2.2], [4.07, .06, 1.6]];
    for (const [r, a, d] of P) for (const det of [-0.7, 0.7]) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = base * r + det;
      env(g, t, a * v * 0.28, 0.006, d * decay); o.connect(g); out(g, 0.6); o.start(t); o.stop(t + d * decay + 0.05);
    }
    noiseBurst(t, 3200, 1, 0.12 * v, 0.05, 0.4);
  }
  const ting = t => bell(t, 0.5, 523, 0.35);
  function pop(t) {
    if (!live()) return; t = at(t);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
    env(g, t, 0.12, 0.004, 0.12); o.connect(g); out(g, 0.2); o.start(t); o.stop(t + 0.14);
  }

  /* Giọng tụng mô phỏng: nguyên âm tiếng Việt → formant, dấu thanh → đường cao độ */
  const FORM = { a: [750, 1250], 'ă': [700, 1300], 'â': [550, 1350], e: [600, 1900], 'ê': [420, 2100], i: [300, 2300], y: [300, 2300], o: [550, 900], 'ô': [420, 850], 'ơ': [480, 1300], u: [320, 750], 'ư': [330, 1350] };
  const TONES = [[1, 1, 1], [1, 1, 1.09], [1, 0.97, 0.9], [0.98, 0.9, 0.98], [1, 0.94, 1.1], [0.97, 0.88, 0.86]];
  function phon(syl) {
    const nfd = syl.toLowerCase().normalize('NFD');
    let tone = 0;
    if (nfd.includes('́')) tone = 1; else if (nfd.includes('̀')) tone = 2; else if (nfd.includes('̉')) tone = 3; else if (nfd.includes('̃')) tone = 4; else if (nfd.includes('̣')) tone = 5;
    const base = nfd.replace(/[̣̀́̃̉]/g, '').normalize('NFC').replace(/[^a-zăâêôơưđ]/g, '');
    const init = (base.match(/^(ngh|ng|gh|gi(?=[aăâeêioôơuưy])|qu|ch|kh|nh|ph|th|tr|[bcdđghklmnpqrstvx])/) || [''])[0];
    const cluster = (base.slice(init.length).match(/^[aăâeêioôơuưy]+/) || ['a'])[0];
    let v = [...cluster].find(ch => 'ăâêôơư'.includes(ch));
    if (!v) v = (cluster.length > 1 && /[ou]/.test(cluster[0]) && /[aey]/.test(cluster[1])) ? cluster[1] : cluster[0];
    return { v, tone, fric: /^(s|x|th|ph|kh|ch|tr|h)/.test(init) };
  }
  function sing(t, dur, syl, f0) {
    const ph = phon(syl), [F1, F2] = FORM[ph.v] || FORM.a, C = TONES[ph.tone].map(c => 1 + (c - 1) * 0.7);
    const d = ph.tone === 5 ? dur * 0.7 : dur;
    const amp = AC.createGain();
    amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(0.6, t + 0.05);
    amp.gain.setValueAtTime(0.6, t + d * 0.72); amp.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    amp.connect(lp); out(lp, 0.85);
    const filters = [[F1, 7, 1], [F2, 9, 0.55], [2600, 10, 0.18]].map(([f, q, a]) => {
      const b = AC.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
      const g = AC.createGain(); g.gain.value = a * 3.2; b.connect(g); g.connect(amp); return b;
    });
    for (const [mul, det, a] of [[1, 0, 0.55], [1.004, 5, 0.32], [0.5, 0, 0.45]]) {
      const o = AC.createOscillator(), ga = AC.createGain();
      o.type = 'sawtooth'; o.detune.value = det; ga.gain.value = a;
      const f = f0 * mul;
      o.frequency.setValueAtTime(f * C[0], t); o.frequency.linearRampToValueAtTime(f * C[1], t + d * 0.5); o.frequency.linearRampToValueAtTime(f * C[2], t + d * 0.95);
      o.connect(ga); filters.forEach(fl => ga.connect(fl)); o.start(t); o.stop(t + d + 0.05);
    }
    if (ph.fric) noiseBurst(Math.max(AC.currentTime, t - 0.03), 4800, 1.5, 0.08, 0.06, 0.2);
  }

  /* Tụng chung: mọi người tính vị trí theo giờ máy chủ nên nghe cùng một chữ */
  let ch = null;
  function startChant(track, startedAt) {
    const b = root.CHANTS.build(track);
    ch = b ? { b, startedAt, last: -1, eb: [] } : null;
  }
  function stopChant() { ch = null; }
  function tickChant(serverNow) {
    if (!ch || !live()) return;
    const elapsed = (serverNow - ch.startedAt) / 1000, horizon = elapsed + 0.15, tr = ch.b.tr, beats = ch.b.beats;
    for (let i = ch.last + 1; i < beats.length; i++) {
      const bt = i * tr.beat;
      if (bt > horizon) break;
      ch.last = i;
      if (bt < elapsed - 0.05) continue;           // vào muộn: bỏ qua phần đã tụng
      const t = AC.currentTime + Math.max(0, bt - elapsed), b = beats[i];
      if (!tr.moFirstOnly || b.first) mo(t, b.first ? 1 : 0.8);
      if (b.bell) bell(t, i === 0 ? 0.9 : 0.6);
      if (b.syl && tr.voice && voiceOn) sing(t + 0.01, tr.beat * 0.84, b.syl, tr.f0);
    }
    ch.b.endBells.forEach((bt, k) => {
      if (ch.eb[k] || bt > horizon) return;
      ch.eb[k] = true;
      if (bt >= elapsed - 0.05) bell(AC.currentTime + Math.max(0, bt - elapsed), 0.8);
    });
  }

  root.SFX = {
    unlock() { return !!ctx(); },
    get ready() { return live(); },
    get muted() { return muted; },
    setMuted(m) { muted = !!m; if (OUT) OUT.gain.setTargetAtTime(muted ? 0 : volume, AC.currentTime, 0.05); },
    setVolume(v) { volume = v; if (OUT && !muted) OUT.gain.setTargetAtTime(volume, AC.currentTime, 0.05); },
    setVoice(v) { voiceOn = !!v; },
    mo: () => mo(), bell: (v) => bell(null, v), ting: () => ting(), pop: () => pop(),
    startChant, stopChant, tickChant
  };
})(this);
