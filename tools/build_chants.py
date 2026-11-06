#!/usr/bin/env python3
"""
Dựng các bài tụng của Chùa Tâm An thành file MP3 hoàn chỉnh (giọng tụng + mõ + chuông)
kèm file JSON ghi mốc thời gian từng chữ để trình duyệt cho chữ chạy theo tiếng.

Cách làm:
  1. VieNeu-TTS v3 Turbo đọc LIỀN từng câu kinh. Không cắt rời từng chữ: đo bằng Whisper,
     cắt rời làm mất rõ chữ (sai 56–75%), đọc liền rõ nhất (sai ~24%).
  2. Whisper dò mốc thời gian từng chữ trong câu.
  3. Tốc độ chỉnh trơn tru trên cả câu (WSOLA, không cắt): thần chú nhanh hơn, niệm danh hiệu
     nhanh dần đều, câu cuối lơi dần.
  4. Mõ gõ đúng lúc từng chữ cất lên (mõ nương theo người tụng), chuông theo nghi thức.

Quy tắc mõ (theo hướng dẫn sử dụng chuông mõ của các đạo tràng):
  - Vào mõ: chữ thứ nhất chưa gõ, chữ thứ hai gõ một tiếng, chữ thứ ba không gõ,
    từ chữ thứ tư gõ đều mỗi chữ một tiếng.
  - Tụng kinh: tốc độ vừa phải; thần chú nhanh hơn; niệm danh hiệu Phật nhanh dần đều.
  - Kết thúc: lơi dần; hai tiếng mõ áp chót gõ dính liền nhau, tiếng mõ cuối gõ rời ra;
    sau đó thỉnh chuông.

Cài đặt (CPU là đủ):
    pip install vieneu librosa soundfile audiotsm faster-whisper "onnxruntime==1.22.1"
Chạy:
    python tools/build_chants.py                      # dựng mọi bài
    python tools/build_chants.py --tracks batnha      # chỉ một bài
    python tools/build_chants.py --tracks daibi,duocsu   # Chú Đại Bi, Chú Dược Sư

Nhân bản giọng (tùy chọn): thay giọng mẫu "Thiền Tâm Đức" bằng giọng của một người cụ thể, với
sự đồng ý của chính người đó. VieNeu-TTS v3 Turbo không cần lời thoại của file mẫu; chỉ cần một
đoạn nói rõ, ít ồn. Mọi thứ còn lại (đọc liền từng câu, dò mốc chữ, tốc độ, mõ, chuông) giữ nguyên:
    python tools/build_chants.py --ref-audio /duong/dan/ngoai/repo/giong_mau.wav
    python tools/build_chants.py --ref-audio giong_mau.wav --ref-mode speaker   # chỉ lấy âm sắc
    python tools/build_chants.py --ref-audio giong_mau.wav --no-denoise-ref     # không khử nhiễu mẫu
  --ref-mode full     (mặc định) lấy cả âm sắc lẫn cách nhả chữ từ ~8 giây đầu của file mẫu.
  --ref-mode speaker  chỉ lấy âm sắc người nói, cách đọc theo mô hình (đôi khi rõ chữ hơn).
  Chỉ ~8 giây đầu của file mẫu được dùng; nên cắt đoạn 8–20 giây nói rõ, một người, ít ồn.
LƯU Ý RIÊNG TƯ: file giọng mẫu là dữ liệu cá nhân, phải để NGOÀI repo (công cụ từ chối đường dẫn
nằm trong repo), không commit, không tải lên dịch vụ nào. Mọi bước chạy ngay trên máy này.
Trong MP3/JSON và cache chỉ ghi nhãn "nhân bản từ giọng mẫu #xxxxxxxx" (8 ký tự đầu của sha256
nội dung file) — không có tên người, không có đường dẫn. File .npz của --cache chỉ chứa âm thanh
đã tổng hợp, không chứa bản ghi mẫu.
"""
import argparse
import difflib
import hashlib
import importlib.metadata
import json
import math
import subprocess
import tempfile
import time
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf
import librosa

ROOT = Path(__file__).resolve().parent.parent
SR = 24000

# Tốc độ (1 = tốc độ đọc tự nhiên; < 1 chậm hơn; > 1 nhanh hơn)
TEMPO = {
    'batnha':   {'kind': 'kinh',  'speed': 1.0, 'mantra_from': 23, 'mantra_speed': 1.12},
    'daibi':    {'kind': 'kinh',  'speed': 1.0, 'mantra_from': 4, 'mantra_speed': 1.12},
    # khai kinh, ba biến chú, rồi niệm hồng danh nhanh dần từ câu niem_from
    'duocsu':   {'kind': 'kinh',  'speed': 1.0, 'mantra_from': 3, 'mantra_speed': 1.12,
                 'niem_from': 15, 'speed_start': 0.88, 'speed_end': 1.18},
    'niemphat': {'kind': 'niem',  'speed_start': 0.82, 'speed_end': 1.15},
    'quanam':   {'kind': 'niem',  'speed_start': 0.88, 'speed_end': 1.18},
    'thien':    {'kind': 'thien', 'beat': 1.3},
}
LEAD = 3.4            # thỉnh chuông khai kinh rồi mới vào câu đầu
END_BELLS = 3
END_BELL_GAP = 3.2
PAUSE_COMMA = 0.32    # nghỉ giữa hai câu nối tiếp
PAUSE_STOP = 0.7      # nghỉ sau câu kết bằng dấu chấm
PAUSE_NIEM = 0.22     # nghỉ giữa các lượt niệm danh hiệu
DOUBLE_GAP = 0.17     # hai tiếng mõ áp chót "dính liền"
FINAL_GAP = 0.55      # khoảng lặng trước chữ cuối để tiếng mõ cuối "rời ra"


def key(s):
    s = unicodedata.normalize('NFC', s.lower())
    return ''.join(ch for ch in s if ch.isalpha())


def chant_data():
    js = ("const C=require('./public/js/chants.js');const o={};for(const k in C.TRACKS){const t=C.TRACKS[k];"
          "o[k]={title:t.title,voice:t.voice,lines:t.lines}};console.log(JSON.stringify(o))")
    r = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


# ---------------- dò mốc chữ ----------------
def rms_env(y, hop):
    return librosa.feature.rms(y=y, frame_length=hop * 4, hop_length=hop)[0]


def speech_bounds(y):
    hop = int(SR * 0.01)
    r = rms_env(y, hop)
    on = np.where(r > r.max() * 0.06)[0]
    return (on[0] * hop / SR, (on[-1] + 1) * hop / SR) if len(on) else (0, len(y) / SR)


def align(model, y, words):
    """Mốc bắt đầu từng chữ (giây) và điểm kết thúc câu."""
    ref = [key(w) for w in words]
    y16 = librosa.resample(y, orig_sr=SR, target_sr=16000)
    segs, _ = model.transcribe(y16, language='vi', word_timestamps=True, beam_size=5,
                               initial_prompt=' '.join(words), condition_on_previous_text=False, vad_filter=False)
    hyp = [(key(w.word), w.start) for s in segs for w in (s.words or []) if key(w.word)]
    starts = [None] * len(ref)
    sm = difflib.SequenceMatcher(a=ref, b=[h[0] for h in hyp], autojunk=False)
    matched = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                starts[i1 + k] = hyp[j1 + k][1]
            matched += (i2 - i1) if tag == 'equal' else 0
    t0, t1 = speech_bounds(y)
    starts[0] = t0
    known = [(i, s) for i, s in enumerate(starts) if s is not None] + [(len(ref), t1)]
    for (ia, sa), (ib, sb) in zip(known, known[1:]):
        for i in range(ia + 1, ib):
            starts[i] = sa + (sb - sa) * (i - ia) / (ib - ia)
    hop = int(SR * 0.005)
    env = rms_env(y, hop)
    fixed = [max(0.0, t0 - 0.02)]
    for i in range(1, len(starts)):                      # chỉnh mốc về khe lặng gần nhất
        c = starts[i]
        a, b = int(max(fixed[-1] + 0.06, c - 0.06) * SR / hop), int(min(t1 - 0.04, c + 0.04) * SR / hop)
        if b > a + 1:
            c = (a + int(np.argmin(env[a:b]))) * hop / SR
        fixed.append(max(c, fixed[-1] + 0.06))
    return fixed, min(len(y) / SR, t1 + 0.08), matched


def warp(y, bounds, speeds):
    """Đổi tốc độ trơn tru theo từng đoạn, KHÔNG cắt rời (WSOLA chạy liên tục)."""
    from audiotsm import wsola
    from audiotsm.io.array import ArrayReader, ArrayWriter
    tsm, w = wsola(1, frame_length=768, synthesis_hop=192), ArrayWriter(1)
    for i, sp in enumerate(speeds):
        seg = y[int(bounds[i] * SR):int(bounds[i + 1] * SR)]
        if not len(seg):
            continue
        tsm.set_speed(float(sp))
        r = ArrayReader(seg[np.newaxis, :].astype(np.float32))
        while not r.empty:
            tsm.read_from(r)
            tsm.write_to(w)
    while True:
        n = tsm.flush_to(w)
        n = n[0] if isinstance(n, tuple) else n
        if not n:
            break
    return w.data[0].astype(np.float32)


def niem_from(cfg):
    """Câu đầu tiên của phần niệm danh hiệu (bài 'niem' niệm từ đầu; bài 'kinh' có thể niệm ở cuối)."""
    return cfg.get('niem_from', 0 if cfg['kind'] == 'niem' else 10 ** 9)


def line_speeds(track_id, li, n_lines, n_words, last):
    cfg = TEMPO[track_id]
    n0 = niem_from(cfg)
    if li < n0:
        base = cfg['mantra_speed'] if li >= cfg.get('mantra_from', 10 ** 9) else cfg['speed']
    else:
        frac = (li - n0) / max(1, n_lines - 1 - n0)          # niệm danh hiệu: nhanh dần đều
        base = cfg['speed_start'] + (cfg['speed_end'] - cfg['speed_start']) * frac
    sp = np.full(n_words, base, dtype=np.float64)
    if last:                                                 # câu cuối: lơi dần
        k = min(n_words, 6)
        sp[-k:] *= np.linspace(0.95, 0.68, k)
    return sp


# ---------------- mõ, chuông, trộn ----------------
def synth_mo():
    n = int(0.25 * SR); t = np.arange(n) / SR
    f = 390 + (560 - 390) * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045) * 0.75
    click = np.sin(2 * np.pi * 1210 * t) * np.exp(-t / 0.012) * 0.16
    noise = np.random.RandomState(7).randn(n) * np.exp(-t / 0.006) * 0.08
    return (body + click + noise).astype(np.float32)


def load_bell():
    y, _ = librosa.load(ROOT / 'public' / 'audio' / 'bell.mp3', sr=SR, mono=True)
    return (y / max(1e-6, np.abs(y).max())).astype(np.float32)


def voice_line(track_id, li, lines, y, model, last):
    """Một câu đã chỉnh tốc độ + mốc từng chữ trong câu (giây)."""
    words = lines[li].split()
    starts, end, matched = align(model, y, words)
    bounds = starts + [end]
    sp = line_speeds(track_id, li, len(lines), len(words), last)
    if np.allclose(sp, 1.0):
        out = y[int(bounds[0] * SR):int(end * SR)].copy()
    else:
        out = warp(y, bounds, sp)
    d = np.diff(bounds) / sp
    onsets = list(np.concatenate([[0.0], np.cumsum(d)[:-1]]))
    if last and len(words) >= 3:                           # tiếng mõ cuối rời ra
        cut = int(onsets[-1] * SR)
        out = np.concatenate([out[:cut], np.zeros(int(FINAL_GAP * SR), np.float32), out[cut:]])
        onsets[-1] += FINAL_GAP
    return out, onsets, matched


def render(track_id, data, tts, model, voice, cache, variants, voice_only=False, max_lines=None):
    lines = data['lines'][:max_lines] if max_lines else data['lines']
    cfg = TEMPO[track_id]
    mo, bell = synth_mo(), load_bell()
    voice_bus, perc = np.zeros(SR * 600, np.float32), np.zeros(SR * 600, np.float32)
    events, mo_times, bell_times = [], [], [0.3]

    def add(buf, sig, at, g=1.0):
        i = int(at * SR); buf[i:i + len(sig)] += sig[:max(0, len(buf) - i)] * g

    add(perc, bell, 0.3, 0.55)                               # thỉnh chuông khai kinh
    t = LEAD
    order = 0                                                 # số thứ tự chữ trong bài (cho luật vào mõ)
    seen = {}
    total_words = sum(len(l.split()) for l in lines)
    for li, line in enumerate(lines):
        words = line.split()
        last = li == len(lines) - 1
        if cfg['kind'] == 'thien':
            for si in range(len(words)):
                events.append([round(t, 3), li, si])
                if si == 0:
                    add(perc, mo, t, 0.8); mo_times.append(round(t, 3))
                    if li and li % 4 == 0:
                        add(perc, bell, t, 0.28); bell_times.append(round(t, 3))
                t += cfg['beat']
            if not last:
                events.append([round(t, 3), li, -1])
                t += cfg['beat'] * 2
            continue
        v = seen.get(line, 0); seen[line] = v + 1
        ck = f'{voice}|{line}|{v % variants}'
        if ck not in cache:
            yy = np.asarray(tts.infer(line, voice=voice), dtype=np.float32)
            cache[ck] = librosa.resample(yy, orig_sr=48000, target_sr=SR)
        out, onsets, matched = voice_line(track_id, li, lines, cache[ck], model, last)
        print(f'    câu {li + 1}/{len(lines)}: {len(words)} chữ, Whisper khớp {matched}')
        add(voice_bus, out, t)
        for si, on in enumerate(onsets):
            at = t + on
            events.append([round(at, 3), li, si])
            strike = not (order == 0 or order == 2)          # vào mõ: chữ 1 không, chữ 2 có, chữ 3 không, từ chữ 4 đều
            if order == total_words - 2:                      # hai tiếng áp chót dính liền
                prev = mo_times[-1] if mo_times else at
                at = prev + DOUBLE_GAP
            if strike:
                add(perc, mo, at, 0.85 if si == 0 else 0.72); mo_times.append(round(at, 3))
            order += 1
        t += len(out) / SR
        if not last:
            events.append([round(t, 3), li, -1])
            t += PAUSE_NIEM if li >= niem_from(cfg) else (PAUSE_STOP if line.rstrip()[-1:] in '.!:' else PAUSE_COMMA)
    t_end = t
    for k in range(END_BELLS):                                # thỉnh chuông kết
        bt = t_end + 0.9 + k * END_BELL_GAP
        add(perc, bell, bt, 0.6); bell_times.append(round(bt, 3))
    duration = bell_times[-1] + 5.0

    n = int(duration * SR)
    voice_bus, perc = voice_bus[:n], perc[:n]
    loud = np.abs(voice_bus) > 0.01
    v_rms = math.sqrt(float(np.mean(voice_bus[loud] ** 2))) if np.any(loud) else 1.0
    mix = voice_bus * (0.16 / max(v_rms, 1e-4)) + (0 if voice_only else perc * 0.5)
    n_ir = int(2.2 * SR)                                     # vang nhẹ như trong chánh điện
    ir = np.random.RandomState(3).randn(n_ir).astype(np.float32) * np.power(1 - np.arange(n_ir) / n_ir, 3.6)
    wet = np.convolve(mix, ir * 0.018, mode='full')[:len(mix)]
    mix = mix + 0.28 * wet
    mix = mix / max(1e-6, float(np.abs(mix).max())) * 0.9
    return mix.astype(np.float32), events, mo_times, bell_times, duration


def encode(mix, path):
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / 'x.wav'
        sf.write(wav, mix, SR)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', str(path)], check=True)


class CloneVoice:
    """Bọc VieNeu để mọi câu đều đọc bằng giọng nhân bản từ file mẫu (render() không phải sửa).
    render() vẫn gọi tts.infer(câu, voice=nhãn): nhãn chỉ để làm khóa cache, giọng thật lấy từ file mẫu."""

    def __init__(self, tts, ref_audio, denoise=True, speaker_only=False):
        self.tts, self.ref_audio, self.denoise, self.speaker_only = tts, str(ref_audio), denoise, speaker_only

    def infer(self, text, voice=None, **kw):
        return self.tts.infer(text, ref_audio=self.ref_audio, denoise=self.denoise,
                              use_ref_codes=not self.speaker_only, **kw)


def clone_label(ref_audio, denoise, speaker_only):
    """Nhãn giọng nhân bản: không chứa tên người hay đường dẫn, chỉ 8 ký tự đầu sha256 nội dung file mẫu."""
    h = hashlib.sha256(Path(ref_audio).read_bytes()).hexdigest()[:8]
    return f'nhân bản từ giọng mẫu #{h} ({"âm sắc" if speaker_only else "đầy đủ"}, {"khử nhiễu" if denoise else "không khử nhiễu"})'


def main():
    ap = argparse.ArgumentParser(description='Dựng bài tụng (MP3 + JSON) bằng VieNeu-TTS v3 Turbo')
    ap.add_argument('--voice', default='Thiền Tâm Đức')
    ap.add_argument('--tracks', default=','.join(TEMPO))
    ap.add_argument('--variants', type=int, default=3, help='Số bản đọc khác nhau cho câu lặp lại')
    ap.add_argument('--onnx-dir', default=None)
    ap.add_argument('--whisper', default='small')
    ap.add_argument('--cache', default=None, help='File .npz lưu câu đã đọc để dựng lại nhanh')
    ap.add_argument('--out', default=str(ROOT / 'public' / 'audio' / 'chants'))
    ap.add_argument('--eval', default=None, help='Chỉ xuất phần giọng vài câu đầu ra file WAV để đánh giá')
    ap.add_argument('--eval-lines', type=int, default=10)
    ap.add_argument('--ref-audio', default=None, help='Nhân bản giọng từ file mẫu (đặt NGOÀI repo; xem phần đầu file)')
    ap.add_argument('--denoise-ref', action=argparse.BooleanOptionalAction, default=True,
                    help='Khử nhiễu file mẫu trước khi nhân bản (mặc định: có)')
    ap.add_argument('--ref-mode', choices=['full', 'speaker'], default='full',
                    help='full: âm sắc + cách nhả chữ của mẫu; speaker: chỉ âm sắc')
    args = ap.parse_args()
    if args.ref_audio:
        ref = Path(args.ref_audio).expanduser().resolve()
        if not ref.is_file():
            ap.error(f'không thấy file giọng mẫu: {args.ref_audio}')
        if ROOT in ref.parents:
            ap.error('file giọng mẫu là dữ liệu cá nhân, phải để NGOÀI thư mục dự án; hãy chuyển nó ra ngoài rồi chạy lại')
        args.voice = clone_label(ref, args.denoise_ref, args.ref_mode == 'speaker')
        print(f'Nhân bản giọng: {args.voice}')

    data = chant_data()
    ids = [t for t in args.tracks.split(',') if t in data]
    cache = {}
    if args.cache and Path(args.cache).exists():
        z = np.load(args.cache, allow_pickle=False)
        cache = {k: z[k] for k in z.files}
    tts = model = None
    if any(data[t]['voice'] for t in ids):
        from vieneu import Vieneu
        from faster_whisper import WhisperModel
        tts = Vieneu(onnx_dir=args.onnx_dir) if args.onnx_dir else Vieneu()
        if args.ref_audio:
            tts = CloneVoice(tts, ref, args.denoise_ref, args.ref_mode == 'speaker')
        model = WhisperModel(args.whisper, device='cpu', compute_type='int8')
    if args.eval:
        tid = ids[0]
        mix, events, *_ = render(tid, data[tid], tts, model, args.voice, cache, args.variants, voice_only=True, max_lines=args.eval_lines)
        sf.write(args.eval, mix, SR)
        Path(args.eval + '.json').write_text(json.dumps({'lines': data[tid]['lines'][:args.eval_lines], 'events': events}, ensure_ascii=False), encoding='utf-8')
        return
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    man_path = out / 'manifest.json'
    manifest = json.loads(man_path.read_text(encoding='utf-8')) if man_path.exists() else {'tracks': {}}
    for tid in ids:
        t0 = time.time()
        print(f'== {data[tid]["title"]}')
        mix, events, mo_times, bell_times, duration = render(tid, data[tid], tts, model, args.voice, cache, args.variants)
        encode(mix, out / f'{tid}.mp3')
        meta = {
            'id': tid, 'title': data[tid]['title'], 'file': f'{tid}.mp3', 'duration': round(duration, 2),
            'lines': data[tid]['lines'], 'events': events, 'mo': mo_times, 'bells': bell_times,
            'voice': args.voice if data[tid]['voice'] else None,
            'model': ('pnnbao-ump/VieNeu-TTS-v3-Turbo (vieneu ' + importlib.metadata.version('vieneu') + ')') if data[tid]['voice'] else None
        }
        (out / f'{tid}.json').write_text(json.dumps(meta, ensure_ascii=False), encoding='utf-8')
        manifest['tracks'][tid] = {'title': data[tid]['title'], 'file': f'{tid}.mp3', 'json': f'{tid}.json', 'duration': round(duration, 2)}
        print(f'   {duration:.0f}s âm thanh · {(out / f"{tid}.mp3").stat().st_size // 1024} KB · {time.time() - t0:.0f}s dựng')
        if args.cache:
            np.savez_compressed(args.cache, **cache)
    order = list(data) + [k for k in manifest['tracks'] if k not in data]   # theo thứ tự trong chants.js
    manifest['tracks'] = {k: manifest['tracks'][k] for k in order if k in manifest['tracks']}
    man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
