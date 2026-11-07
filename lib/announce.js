'use strict';
/*
 * Thông báo cúng dường bằng giọng đọc.
 *
 * Máy chủ chùa soạn câu thông báo rồi nhờ máy chủ đọc của VieNeu-TTS (apps.openai_speech,
 * chuẩn POST /v1/audio/speech) đọc bằng giọng nữ có sẵn. File âm thanh giữ trong bộ nhớ,
 * phát cho mọi người trong chánh điện qua /api/announce/<id>.
 *
 * Chưa đặt TTS_URL (hoặc máy chủ đọc lỗi) thì trình duyệt tự đọc bằng giọng tiếng Việt có sẵn.
 */
const { spawn } = require('child_process');
const crypto = require('crypto');

const TTS_URL = (process.env.TTS_URL || '').trim().replace(/\/+$/, '');
const TTS_VOICE = (process.env.TTS_VOICE || 'Mai Anh').trim();
const TTS_API_KEY = process.env.TTS_API_KEY || '';
const TTS_TIMEOUT = Math.max(5, Number(process.env.TTS_TIMEOUT) || 45) * 1000;

/* ---------- đọc số tiền thành chữ ---------- */
const DIG = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function read3(n, full) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, u = n % 10, out = [];
  if (h || full) out.push(DIG[h], 'trăm');
  if (t === 0) { if (u) { if (h || full) out.push('linh'); out.push(DIG[u]); } }
  else if (t === 1) { out.push('mười'); if (u === 5) out.push('lăm'); else if (u) out.push(DIG[u]); }
  else {
    out.push(DIG[t], 'mươi');
    if (u === 1) out.push('mốt'); else if (u === 4) out.push('tư'); else if (u === 5) out.push('lăm'); else if (u) out.push(DIG[u]);
  }
  return out;
}
/** 150000 → "một trăm năm mươi nghìn" */
function numberWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (!n) return 'không';
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ'], groups = [];
  while (n > 0 && groups.length < units.length) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const out = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    out.push(...read3(groups[i], i < groups.length - 1));
    if (units[i]) out.push(units[i]);
  }
  return out.join(' ');
}
const vnd = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

/**
 * Soạn câu thông báo: { speak } để đọc (số viết bằng chữ), { text } để hiện chữ.
 * d: lượt cúng dường đã xác nhận; aura: kết quả AURA.stack (hoặc null); tier: thông tin cảnh giới mới.
 */
function compose(d, aura, tierInfo) {
  const who = d.anon ? 'Phật tử hảo tâm' : `Phật tử ${d.name}`;
  const Who = who.charAt(0).toUpperCase() + who.slice(1);
  // Tôn trọng lựa chọn không công khai số tiền của người cúng.
  const amountSpeak = d.hide ? 'tịnh tài' : `${numberWords(d.amount)} đồng`;
  const amountText = d.hide ? 'tịnh tài' : vnd(d.amount);
  const templates = [
    (w, a) => `Nam mô A Di Đà Phật. Chánh điện xin tùy hỷ công đức ${w} đã cúng dường ${a}.`,
    (w, a) => `Xin tri ân ${w} đã phát tâm cúng dường ${a}. Nguyện bình an đến với gia đình.`,
    (w, a) => `Chùa Tâm An xin ghi nhận tấm lòng của ${w}, cúng dường ${a}. Tùy hỷ công đức.`,
    (w, a) => `Một tấm lòng thiện lành vừa được gửi đến chùa: ${w} cúng dường ${a}. Xin tùy hỷ.`,
    (w, a) => `Nam mô A Di Đà Phật. ${w} vừa hoan hỷ cúng dường ${a}. Kính chúc thân tâm an lạc.`,
    (w, a) => `Xin đại chúng cùng tùy hỷ: ${w} đã gửi ${a} cúng dường chùa Tâm An.`,
    (w, a) => `Chánh điện xin cảm niệm tấm lòng của ${w}, vừa phát tâm cúng dường ${a}.`,
    (w, a) => `Tùy hỷ công đức ${w} đã cúng dường ${a}. Nguyện điều lành lan tỏa khắp muôn nơi.`
  ];
  // Chọn một lần trên máy chủ để lời đọc và chữ hiển thị khớp trên mọi máy.
  const template = templates[Math.floor(Math.random() * templates.length)];
  let speak = template(who, amountSpeak);
  let text = template(who, amountText);
  if (aura && aura.up && tierInfo) {
    const name = d.anon ? 'Phật tử' : d.name;
    speak += ` Hào quang bừng sáng! ${name} đã đột phá cảnh giới ${tierInfo.name}.`;
    text += ` Hào quang bừng sáng: ${name} đột phá cảnh giới ${tierInfo.name}!`;
  }
  return { speak, text: text.charAt(0).toUpperCase() + text.slice(1), who: Who };
}

/* ---------- mã hóa âm thanh ---------- */
let ffmpegOk = null;
function hasFfmpeg() {
  if (ffmpegOk !== null) return Promise.resolve(ffmpegOk);
  return new Promise(res => {
    try {
      const p = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { stdio: 'ignore' });
      p.on('error', () => res(ffmpegOk = false));
      p.on('close', code => res(ffmpegOk = code === 0));
    } catch (e) { res(ffmpegOk = false); }
  });
}
function toMp3(pcm, rate) {
  return new Promise((res, rej) => {
    const p = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0',
      '-af', 'loudnorm=I=-18:TP=-2', '-codec:a', 'libmp3lame', '-b:a', '56k', '-f', 'mp3', 'pipe:1']);
    const out = [];
    p.stdout.on('data', c => out.push(c));
    p.on('error', rej);
    p.on('close', code => (code === 0 && out.length ? res(Buffer.concat(out)) : rej(new Error('ffmpeg thoát với mã ' + code))));
    p.stdin.on('error', () => {});
    p.stdin.end(pcm);
  });
}
function toWav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/* ---------- gọi máy chủ đọc VieNeu ---------- */
async function synth(text) {
  const mp3 = await hasFfmpeg();
  const rate = mp3 ? 24000 : 16000;               // không có ffmpeg thì gửi WAV 16 kHz cho nhẹ
  const headers = { 'content-type': 'application/json' };
  if (TTS_API_KEY) headers.authorization = 'Bearer ' + TTS_API_KEY;
  const r = await fetch(TTS_URL + '/v1/audio/speech', {
    method: 'POST', headers, signal: AbortSignal.timeout(TTS_TIMEOUT),
    body: JSON.stringify({ model: 'vieneu-v3-turbo', input: text, voice: TTS_VOICE, response_format: 'pcm', sample_rate: rate })
  });
  if (!r.ok) throw new Error(`máy chủ đọc trả lỗi ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
  const pcm = Buffer.from(await r.arrayBuffer());
  if (pcm.length < rate / 5) throw new Error('máy chủ đọc trả về âm thanh rỗng');
  if (mp3) {
    try { return { buf: await toMp3(pcm, rate), type: 'audio/mpeg' }; } catch (e) { console.error('[announce] ffmpeg lỗi, gửi WAV:', e.message); }
  }
  return { buf: toWav(pcm, rate), type: 'audio/wav' };
}

/* ---------- kho file trong bộ nhớ ---------- */
const clips = new Map();
function put(clip) {
  const id = crypto.randomBytes(9).toString('base64url');
  clips.set(id, Object.assign(clip, { t: Date.now() }));
  for (const [k, v] of clips) if (clips.size > 30 || Date.now() - v.t > 30 * 60e3) clips.delete(k); else break;
  return id;
}
const get = id => clips.get(String(id || '').replace(/\.(mp3|wav)$/, ''));

// Đọc lần lượt từng thông báo (máy chủ đọc trên CPU chỉ nên chạy một yêu cầu một lúc).
let chain = Promise.resolve();
let warned = false;
/** Trả về { audio: url | null, type } — không bao giờ ném lỗi. */
function speak(text) {
  if (!TTS_URL) return Promise.resolve({ audio: null });
  const job = chain.then(async () => {
    try {
      const clip = await synth(text);
      const id = put(clip);
      warned = false;
      return { audio: `/api/announce/${id}.${clip.type === 'audio/mpeg' ? 'mp3' : 'wav'}` };
    } catch (e) {
      if (!warned) console.error('[announce] Không đọc được bằng VieNeu, trình duyệt sẽ tự đọc:', e.message);
      warned = true;
      return { audio: null };
    }
  });
  chain = job.catch(() => {});
  return job;
}

module.exports = { enabled: !!TTS_URL, voice: TTS_VOICE, url: TTS_URL, compose, speak, get, numberWords };
