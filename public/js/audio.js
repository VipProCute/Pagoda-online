/*
 * Âm thanh chánh điện.
 * - Bài tụng: file MP3 dựng sẵn (giọng VieNeu-TTS đọc liền câu + mõ theo quy tắc + chuông),
 *   phát bằng thẻ <audio> và luôn chỉnh về đúng vị trí theo giờ máy chủ để mọi người nghe cùng một chữ.
 *   Dựng lại bằng tools/build_chants.py.
 * - Chuông: bản thu public/audio/bell.mp3. Mõ và tiếng "pop" khi thả tim: tạo bằng Web Audio.
 */
(function (root) {
  'use strict';
  let AC = null, OUT, BUS, REV, NOISE, BELL = null, bellLoading = null;
  let volume = 0.8, muted = false;

  function ctx() {
    if (!AC) {
      const C = root.AudioContext || root.webkitAudioContext;
      if (!C) return null;
      AC = new C();
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(AC.destination);
      OUT = AC.createGain(); OUT.gain.value = muted ? 0 : volume; OUT.connect(comp);
      BUS = AC.createGain(); BUS.connect(OUT);
      const conv = AC.createConvolver(); conv.buffer = impulse(2.8);
      REV = AC.createGain(); REV.gain.value = 0.3; REV.connect(conv); conv.connect(OUT);
      const len = AC.sampleRate; NOISE = AC.createBuffer(1, len, AC.sampleRate);
      const d = NOISE.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      loadBell();
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

  /* Chuông: bản thu thật */
  function decode(buf) { return new Promise((res, rej) => { const p = AC.decodeAudioData(buf, res, rej); if (p && p.catch) p.catch(rej); }); }
  function loadBell() {
    if (bellLoading || !root.fetch) return bellLoading;
    bellLoading = fetch('/audio/bell.mp3').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(decode).then(b => { BELL = b; })
      .catch(e => { bellLoading = null; if (root.console) console.warn('Không tải được tiếng chuông:', e); });
    return bellLoading;
  }
  function playBell(t, v, rate, maxDur) {
    if (!live() || !BELL) return;
    t = at(t);
    const src = AC.createBufferSource(), g = AC.createGain();
    src.buffer = BELL; src.playbackRate.value = rate;
    const len = Math.min(maxDur, BELL.duration / rate);
    g.gain.setValueAtTime(v, t);
    g.gain.setValueAtTime(v, t + Math.max(0, len - 0.4));
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    src.connect(g); out(g, 0.25);
    src.start(t); src.stop(t + len + 0.05);
  }
  const bell = (v = 1) => playBell(null, 0.9 * v, 1, 6);
  const ting = () => playBell(null, 0.3, 1.6, 2.2);      // chuông nhỏ khi thắp nhang, vái lạy
  function pop(t) {
    if (!live()) return; t = at(t);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
    env(g, t, 0.12, 0.004, 0.12); o.connect(g); out(g, 0.2); o.start(t); o.stop(t + 0.14);
  }

  /* Bài tụng chung: thẻ <audio> bám theo giờ máy chủ */
  let chEl = null, ch = null, blocked = false;
  function startChant(track, startedAt, file) {
    stopChant();
    ch = { track, startedAt };
    chEl = new Audio('/audio/chants/' + file);
    chEl.preload = 'auto';
    chEl.volume = volume;
    blocked = false;
  }
  function stopChant() {
    if (chEl) { chEl.pause(); chEl.removeAttribute('src'); chEl.load(); }
    chEl = null; ch = null;
  }
  function syncChant(serverNow) {
    if (!ch || !chEl) return;
    const pos = (serverNow - ch.startedAt) / 1000;
    const end = isFinite(chEl.duration) ? chEl.duration : Infinity;
    if (muted || !AC || pos < 0 || pos >= end) { if (!chEl.paused) chEl.pause(); return; }
    if (chEl.paused) {
      try { chEl.currentTime = pos; } catch (e) { /* chưa tải đủ, thử lại lần sau */ }
      const p = chEl.play();
      if (p && p.then) p.then(() => { blocked = false; }, () => { blocked = true; });
    } else if (Math.abs(chEl.currentTime - pos) > 0.35) {
      chEl.currentTime = pos;                                  // lệch quá 0,35 giây thì kéo lại
    }
  }

  root.SFX = {
    unlock() { const ok = !!ctx(); blocked = false; return ok; },
    context() { return ctx(); },
    get ready() { return live(); },
    get muted() { return muted; },
    get chantBlocked() { return blocked; },
    setMuted(m) {
      muted = !!m;
      if (OUT) OUT.gain.setTargetAtTime(muted ? 0 : volume, AC.currentTime, 0.05);
      if (muted && chEl && !chEl.paused) chEl.pause();
    },
    setVolume(v) { volume = v; if (OUT && !muted) OUT.gain.setTargetAtTime(volume, AC.currentTime, 0.05); if (chEl) chEl.volume = v; },
    mo: () => mo(), bell, ting, pop,
    startChant, stopChant, syncChant
  };
})(this);
