/*
 * Âm thanh chánh điện.
 * - Bài tụng: file MP3 dựng sẵn (giọng VieNeu-TTS đọc liền câu + mõ theo quy tắc + chuông),
 *   phát bằng thẻ <audio> và luôn chỉnh về đúng vị trí theo giờ máy chủ để mọi người nghe cùng một chữ.
 *   Dựng lại bằng tools/build_chants.py.
 * - Nhạc nền: lặp qua Web Audio, hạ âm lượng khi có âm thanh chánh điện.
 * - Chuông: bản thu public/audio/bell.mp3. Mõ và tiếng "pop" khi thả tim: tạo bằng Web Audio.
 * - Hiệu ứng mốc công đức: playClip (lời chúc), chime (chuông ting), scare (tiếng hù), xem celebrate.js.
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
  const AMBIENCE_GAIN = 0.22;
  const AMBIENCE_DUCK = 0.10;
  const ambienceReasons = new Set();
  let ambience = null, ambienceGain = null, ambienceLevel = null;
  let duckUntil = 0, duckTimer = null;

  function updateAmbience() {
    if (!ambienceGain) return;
    const ducked = ambienceReasons.size || clipSrc || (chEl && !chEl.paused && !chEl.ended) || performance.now() < duckUntil;
    const level = AMBIENCE_GAIN * (ducked ? AMBIENCE_DUCK : 1);
    if (level === ambienceLevel) return;
    ambienceLevel = level;
    ambienceGain.gain.setTargetAtTime(level, AC.currentTime, level < AMBIENCE_GAIN ? 0.025 : 0.28);
  }

  function duckAmbience(seconds) {
    const until = performance.now() + seconds * 1000;
    if (until <= duckUntil) return;
    duckUntil = until;
    clearTimeout(duckTimer);
    duckTimer = setTimeout(updateAmbience, Math.ceil(seconds * 1000) + 1);
    updateAmbience();
  }

  function setAmbienceDuck(reason, active) {
    if (active) ambienceReasons.add(reason);
    else ambienceReasons.delete(reason);
    updateAmbience();
  }

  function startAmbience() {
    if (muted) return;
    if (!ambience) {
      ambience = new Audio('/audio/ambience-thien-am.mp3');
      ambience.loop = true;
      ambience.preload = 'none';
      ambienceGain = AC.createGain();
      ambienceGain.gain.value = 0;
      AC.createMediaElementSource(ambience).connect(ambienceGain);
      ambienceGain.connect(OUT);
      updateAmbience();
    }
    if (ambience.paused) {
      ambience.play().catch(e => {
        if (e.name !== 'NotAllowedError' && e.name !== 'AbortError' && root.console) {
          console.warn('Không phát được nhạc nền:', e);
        }
      });
    }
  }

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
    duckAmbience(0.45);
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
    duckAmbience(len + 0.1);
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
    duckAmbience(0.35);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
    env(g, t, 0.12, 0.004, 0.12); o.connect(g); out(g, 0.2); o.start(t); o.stop(t + 0.14);
  }

  /* Chuông ting nhẹ: bốn nốt ngũ cung đi lên, dùng khi chúc mừng mà không có giọng đọc */
  function chime(t) {
    if (!live()) return; t = at(t);
    duckAmbience(1.55);
    [1047, 1319, 1568, 2093].forEach((f, i) => {
      const s = t + i * 0.11, o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = f;
      env(g, s, 0.2, 0.004, 1.0); o.connect(g); out(g, 0.5); o.start(s); o.stop(s + 1.05);
      const o2 = AC.createOscillator(), g2 = AC.createGain();           // âm bội lệch hài tạo cảm giác kim loại
      o2.type = 'sine'; o2.frequency.value = f * 2.76;
      env(g2, s, 0.045, 0.003, 0.35); o2.connect(g2); out(g2, 0.4); o2.start(s); o2.stop(s + 0.4);
    });
  }

  /* Tiếng hù cho mốc 666: cú "bùm" trầm + tiếng rít răng cưa tụt xuống + chút nhiễu. Tổng ~1.4 giây, không đuôi vang.
   * Mức hù đặt theo tiếng chuông, hơi nhỏ hơn và không to hơn nó. Đo bằng ebur128 qua cùng chuỗi âm thanh chính, âm lượng 0.8,
   * đỉnh ngắn hạn (LUFS), lúc bộ nén đã chạy sẵn: chuông bản thu bell.mp3 -11.7, hù mức 0.7 -12.7 (nhỏ hơn chuông 1 LU; đo trực tiếp trên trang là 1.3 LU), mõ -20.2.
   * Các mức khác: 0.5 → -15.5, 0.6 → -14.0, 0.8 → -11.6 (bằng chuông), 0.9 → -10.7, 1.0 → -9.9.
   * Đo offline mà cho âm thanh bắt đầu ngay ở t=0 (bộ nén còn "lạnh") sẽ thấp hơn thực tế ~2 LU với mõ và hù; hãy bắt đầu sau
   * ≥0.5 giây hoặc đo trực tiếp trên trang. Đổi tiếng chuông thì đo lại và chỉnh hằng số này. */
  const SCARE_GAIN = 0.7;
  function scare(t) {
    if (!live()) return; t = at(t);
    const D = 1.35, master = AC.createGain();
    duckAmbience(D);
    master.gain.setValueAtTime(0.0001, t); master.gain.exponentialRampToValueAtTime(SCARE_GAIN, t + 0.012);
    master.gain.setValueAtTime(SCARE_GAIN, t + 0.75); master.gain.exponentialRampToValueAtTime(0.0001, t + D);
    master.connect(BUS);
    const boom = AC.createOscillator(), bg = AC.createGain();
    boom.type = 'sine'; boom.frequency.setValueAtTime(110, t); boom.frequency.exponentialRampToValueAtTime(32, t + 0.9);
    bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.85, t + 0.01); bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    boom.connect(bg); bg.connect(master); boom.start(t); boom.stop(t + 1.05);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(900, t + D);
    const sg = AC.createGain(); sg.gain.value = 0.2; lp.connect(sg); sg.connect(master);
    [-23, 0, 19].forEach((det, i) => {                                   // ba răng cưa lệch pha nghe như tiếng la
      const o = AC.createOscillator();
      o.type = 'sawtooth'; o.detune.value = det;
      o.frequency.setValueAtTime(1750 - i * 90, t); o.frequency.exponentialRampToValueAtTime(330 + i * 30, t + D - 0.1);
      o.connect(lp); o.start(t); o.stop(t + D);
    });
    const n = AC.createBufferSource(); n.buffer = NOISE;
    const nf = AC.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2600; nf.Q.value = 0.7;
    const ng = AC.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.32, t + 0.01); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    n.connect(nf); nf.connect(ng); ng.connect(master); n.start(t, Math.random() * 0.5); n.stop(t + 0.6);
  }

  /* Clip ngắn (lời chúc mừng): tải và giải mã một lần rồi nhớ lại; phát qua đúng chuỗi âm thanh chính
   * nên nút tắt tiếng và âm lượng đều có tác dụng. Trả về {duration, played}. */
  const CLIPS = new Map();       // url -> Promise<AudioBuffer>
  let clipSrc = null;
  function loadClip(url) {
    if (!root.fetch || !ctx()) return Promise.reject(new Error('Không có Web Audio'));
    let p = CLIPS.get(url);
    if (!p) {
      p = fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(decode);
      CLIPS.set(url, p);
      p.catch(() => CLIPS.delete(url));
    }
    return p;
  }
  function preloadClip(url) { try { loadClip(url).catch(() => {}); } catch (e) { /* bỏ qua */ } }
  function stopClip() {
    if (!clipSrc) return;
    try { clipSrc.stop(); } catch (e) { /* đã dừng */ }
    clipSrc = null;
    updateAmbience();
  }
  // opts.cancelled(): hàm kiểm tra ngay trước khi phát, để lời chúc đến muộn (người dùng đã đóng) không bật lên
  function playClip(url, opts) {
    return loadClip(url).then(buf => {
      const duration = buf.duration;
      if (muted || (opts && opts.cancelled && opts.cancelled())) return { duration, played: false };
      const running = AC.state === 'running' ? null : Promise.race([AC.resume().catch(() => {}), new Promise(r => setTimeout(r, 400))]);
      return Promise.resolve(running).then(() => {
        if (AC.state !== 'running' || muted || (opts && opts.cancelled && opts.cancelled())) return { duration, played: false };
        stopClip();
        const src = AC.createBufferSource(), g = AC.createGain();
        src.buffer = buf; src.connect(g); out(g, 0.12);
        src.onended = () => {
          if (clipSrc !== src) return;
          clipSrc = null;
          updateAmbience();
        };
        src.start(); clipSrc = src;
        updateAmbience();
        return { duration, played: true };
      });
    });
  }

  /* Bài tụng chung: thẻ <audio> bám theo giờ máy chủ */
  let chEl = null, ch = null, blocked = false;
  function startChant(track, startedAt, file) {
    stopChant();
    ch = { track, startedAt };
    chEl = new Audio('/audio/chants/' + file);
    chEl.preload = 'auto';
    for (const event of ['playing', 'pause', 'ended', 'error']) chEl.addEventListener(event, updateAmbience);
    chEl.volume = volume;
    blocked = false;
    updateAmbience();
  }
  function stopChant() {
    if (chEl) { chEl.pause(); chEl.removeAttribute('src'); chEl.load(); }
    chEl = null; ch = null;
    updateAmbience();
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
    unlock() { const ok = !!ctx(); if (ok) startAmbience(); blocked = false; return ok; },
    context() { return ctx(); },
    get ready() { return live(); },
    get muted() { return muted; },
    get chantBlocked() { return blocked; },
    setMuted(m) {
      muted = !!m;
      if (OUT) OUT.gain.setTargetAtTime(muted ? 0 : volume, AC.currentTime, 0.05);
      if (muted && chEl && !chEl.paused) chEl.pause();
      if (!muted && AC) startAmbience();
    },
    setVolume(v) { volume = v; if (OUT && !muted) OUT.gain.setTargetAtTime(volume, AC.currentTime, 0.05); if (chEl) chEl.volume = v; },
    mo: () => mo(), bell, ting, pop, setAmbienceDuck,
    chime: () => chime(), scare: () => scare(), playClip, preloadClip, stopClip,
    startChant, stopChant, syncChant
  };
})(this);
