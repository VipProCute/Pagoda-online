/*
 * Âm thanh chánh điện (Web Audio).
 * - Giọng tụng: từng chữ do VieNeu-TTS v3 Turbo đọc (public/audio/chant-voice.mp3 + .json),
 *   được đặt đúng vào nhịp mõ. Tạo lại bằng tools/build_chant_voice.py.
 * - Mõ, chuông: tiếng gõ tạo bằng toán (có thể thay bằng bản thu thật).
 * - Hiệu ứng mốc công đức: playClip (lời chúc), chime (chuông ting), scare (tiếng hù), xem celebrate.js.
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
      loadVoice();
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

  /* Chuông ting nhẹ: bốn nốt ngũ cung đi lên, dùng khi chúc mừng mà không có giọng đọc */
  function chime(t) {
    if (!live()) return; t = at(t);
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
   * Đo bằng ebur128 thì với mức 0.8 cũ nó to hơn tiếng chuông 3 LU và hơn tiếng mõ 15 LU; mức 0.5 (-4 dB) đưa nó về gần tiếng chuông:
   * vẫn đủ giật mình mà không làm người đang nghe tiếng mõ nhỏ bị đau tai. */
  const SCARE_GAIN = 0.5;
  function scare(t) {
    if (!live()) return; t = at(t);
    const D = 1.35, master = AC.createGain();
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
  function stopClip() { if (clipSrc) { try { clipSrc.stop(); } catch (e) { /* đã dừng */ } clipSrc = null; } }
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
        src.onended = () => { if (clipSrc === src) clipSrc = null; };
        src.start(); clipSrc = src;
        return { duration, played: true };
      });
    });
  }

  /* Giọng tụng VieNeu: một file MP3 chứa mọi chữ, bảng JSON cho biết vị trí từng chữ */
  let VOICE = null, VMAP = null, VPAD = 0.05, voiceLoading = null, voiceGain = 1.0;
  const vkey = s => s.toLowerCase().normalize('NFC').replace(/[^\p{L}]/gu, '');
  function decode(buf) { return new Promise((res, rej) => { const p = AC.decodeAudioData(buf, res, rej); if (p && p.catch) p.catch(rej); }); }
  function loadVoice() {
    if (voiceLoading || !root.fetch) return voiceLoading;
    voiceLoading = fetch('/audio/chant-voice.json')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(m => fetch('/audio/' + m.file).then(r => r.arrayBuffer()).then(decode).then(b => { VOICE = b; VMAP = m.items; VPAD = m.pad || 0.05; }))
      .catch(e => { voiceLoading = null; if (root.console) console.warn('Không tải được giọng tụng:', e); });
    return voiceLoading;
  }
  function voice(t, syl, maxDur) {
    if (!VOICE || !VMAP) return;
    const it = VMAP[vkey(syl)];
    if (!it) return;
    const [start, dur] = it;
    const off = Math.max(0, start - VPAD), lead = start - off;
    const len = Math.min(dur + lead + VPAD, maxDur + lead);
    const at = Math.max(AC.currentTime, t - lead);
    const src = AC.createBufferSource(), g = AC.createGain();
    src.buffer = VOICE;
    g.gain.setValueAtTime(voiceGain, at);
    g.gain.setValueAtTime(voiceGain, at + Math.max(0, len - 0.05));
    g.gain.linearRampToValueAtTime(0.0001, at + len);
    src.connect(g); out(g, 0.5);
    src.start(at, off, len); src.stop(at + len + 0.02);
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
      if (b.syl && tr.voice && voiceOn) voice(t + 0.01, b.syl, tr.beat * 0.98);
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
    get voiceReady() { return !!VOICE; },
    loadVoice,
    mo: () => mo(), bell: (v) => bell(null, v), ting: () => ting(), pop: () => pop(),
    chime: () => chime(), scare: () => scare(), playClip, preloadClip, stopClip,
    startChant, stopChant, tickChant
  };
})(this);
