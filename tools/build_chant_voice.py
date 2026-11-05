#!/usr/bin/env python3
"""
Tạo giọng tụng kinh bằng VieNeu-TTS v3 Turbo (mã nguồn mở, Apache-2.0).

Tụng kinh ở chùa là "mỗi tiếng mõ một chữ", nên script cho VieNeu đọc RIÊNG từng chữ
(âm tiết) có trong các bài tụng, rồi:
  1. sinh vài bản mỗi chữ, chọn bản sạch nhất (không đọc thừa, độ dài hợp lý),
  2. cắt khoảng lặng (tùy chọn --pitch: kéo cao độ cho đều; mặc định tắt vì làm mờ chữ),
  3. cân âm lượng, làm mềm đầu/cuối,
  4. ghép tất cả thành một file MP3 + bảng vị trí JSON.
Trình duyệt đặt từng chữ đúng vào nhịp mõ (xem public/js/audio.js).

Cài đặt (CPU là đủ, không cần GPU):
    python -m venv .venv && . .venv/bin/activate
    pip install vieneu librosa soundfile "onnxruntime==1.22.1"
Chạy:
    python tools/build_chant_voice.py --voice "Thiền Tâm Đức"
    python tools/build_chant_voice.py --demo demo.mp3      # thêm bản nghe thử Bát Nhã có mõ và chuông

Ghi chú: onnxruntime >= 1.23 từ chối đọc mô hình qua bộ nhớ đệm Hugging Face (lỗi
"External data path escapes model directory"), nên ghim 1.22.1. Nếu vẫn lỗi, dùng --onnx-dir
trỏ tới thư mục đã tải bằng huggingface_hub.snapshot_download(..., local_dir=...).
"""
import argparse
import importlib.metadata
import json
import math
import subprocess
import sys
import tempfile
import time
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf
import librosa

ROOT = Path(__file__).resolve().parent.parent
OUT_SR = 24000
GAP = 0.15            # khoảng lặng giữa các chữ trong file ghép (giây)
MAX_LEN = 0.62        # độ dài tối đa một chữ sau xử lý (giây)


def key(s: str) -> str:
    """Khóa tra cứu: chữ thường, NFC, bỏ dấu câu. Phải khớp với audio.js."""
    s = unicodedata.normalize('NFC', s.lower())
    return ''.join(ch for ch in s if ch.isalpha())


def chant_data():
    """Đọc bài tụng từ public/js/chants.js (dùng Node) để không phải chép lại kinh văn."""
    js = ("const C=require('./public/js/chants.js');"
          "const out={};for(const id in C.TRACKS){const t=C.TRACKS[id];"
          "out[id]={voice:t.voice,beat:t.beat,lines:t.lines,title:t.title}};"
          "console.log(JSON.stringify(out))")
    res = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def segments(y, sr, thr_ratio=0.08):
    hop = int(sr * 0.01)
    rms = librosa.feature.rms(y=y, frame_length=hop * 4, hop_length=hop)[0]
    if rms.max() <= 0:
        return rms, hop, []
    on = rms > rms.max() * thr_ratio
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        if not v and start is not None:
            segs.append([start, i]); start = None
    if start is not None:
        segs.append([start, len(on)])
    merged = []                              # gộp các đoạn cách nhau < 120 ms
    for s in segs:
        if merged and (s[0] - merged[-1][1]) * hop < sr * 0.12:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return rms, hop, merged


def trim(y, sr):
    rms, hop, segs = segments(y, sr)
    if not segs:
        return None, 0
    main = max(segs, key=lambda s: rms[s[0]:s[1]].sum())
    s = max(0, main[0] * hop - int(0.02 * sr))
    e = min(len(y), main[1] * hop + int(0.06 * sr))
    return y[s:e], len(segs)


def middle_of_three(y, sr):
    """Cắt chữ ở giữa trong "x x x": chữ giữa không bị hạ giọng như chữ cuối câu."""
    rms, hop, segs = segments(y, sr, thr_ratio=0.05)
    if not segs or len(segs) > 3:
        return None, len(segs)
    a, b = segs[0][0], segs[-1][1]
    env = np.convolve(rms, np.ones(3) / 3, mode='same')
    T = b - a
    if T * hop / sr < 0.45:
        return None, len(segs)
    lo1, hi1 = a + int(0.22 * T), a + int(0.46 * T)
    lo2, hi2 = a + int(0.54 * T), a + int(0.78 * T)
    b1 = lo1 + int(np.argmin(env[lo1:hi1]))
    b2 = lo2 + int(np.argmin(env[lo2:hi2]))
    s = max(0, b1 * hop - int(0.01 * sr))
    e = min(len(y), b2 * hop + int(0.03 * sr))
    mid = y[s:e]
    inner, n = trim(mid, sr)
    return (inner if inner is not None else mid), len(segs)


def median_f0(y, sr):
    y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
    f0, voiced, _ = librosa.pyin(y16, fmin=60, fmax=320, sr=16000, frame_length=1024)
    f0 = f0[voiced & ~np.isnan(f0)] if f0 is not None else []
    return float(np.median(f0)) if len(f0) >= 3 else None


def fade(y, sr, fin=0.008, fout=0.045):
    a, b = int(fin * sr), int(fout * sr)
    y = y.copy()
    if a: y[:a] *= np.sin(np.linspace(0, math.pi / 2, a)) ** 2
    if b: y[-b:] *= np.cos(np.linspace(0, math.pi / 2, b)) ** 2
    return y


def generate(tts, syllables, voice, tries, form='single'):
    picked = {}
    t0 = time.time()
    for n, syl in enumerate(syllables, 1):
        cands = []
        for _ in range(tries):
            if form == 'middle':
                raw = np.asarray(tts.infer(f'{syl} {syl} {syl}', voice=voice), dtype=np.float32)
                y, nseg = middle_of_three(raw, 48000)
                ok_seg = nseg <= 3
            else:
                raw = np.asarray(tts.infer(syl, voice=voice), dtype=np.float32)
                y, nseg = trim(raw, 48000)
                ok_seg = nseg == 1
            if y is None:
                continue
            dur = len(y) / 48000
            # bản tốt: không đọc thừa, dài 0.15–0.8 s; ưu tiên gần 0.36 s
            score = abs(dur - 0.36) + (0 if ok_seg else 1.0) + (0 if 0.15 <= dur <= 0.8 else 2.0)
            cands.append((score, y))
        if not cands:
            print(f'  ! bỏ qua "{syl}" (không sinh được)', file=sys.stderr)
            continue
        picked[syl] = min(cands, key=lambda c: c[0])[1]
        if n % 10 == 0 or n == len(syllables):
            print(f'  {n}/{len(syllables)} chữ · {time.time() - t0:.0f}s')
    return picked


def process(picked, pitch_amount):
    f0s = {k: median_f0(librosa.resample(v, orig_sr=48000, target_sr=OUT_SR), OUT_SR) for k, v in picked.items()}
    valid = [f for f in f0s.values() if f]
    target = float(np.median(valid)) if valid else None
    out = {}
    for k, y in picked.items():
        y = librosa.resample(y, orig_sr=48000, target_sr=OUT_SR)
        f = f0s.get(k)
        if target and f:
            steps = float(np.clip(pitch_amount * 12 * math.log2(target / f), -2.5, 2.5))
            if abs(steps) > 0.25:
                y = librosa.effects.pitch_shift(y, sr=OUT_SR, n_steps=steps)
        dur = len(y) / OUT_SR
        if dur > MAX_LEN:
            rate = dur / MAX_LEN
            y = librosa.effects.time_stretch(y, rate=min(rate, 1.35))
            y = y[:int(MAX_LEN * OUT_SR)]
        rms = math.sqrt(float(np.mean(y[np.abs(y) > 0.01] ** 2))) if np.any(np.abs(y) > 0.01) else 0.1
        y = y * (0.11 / max(rms, 1e-4))
        peak = float(np.abs(y).max())
        if peak > 0.9:
            y = y * (0.9 / peak)
        out[k] = fade(y.astype(np.float32), OUT_SR)
    return out, target


def write_sprite(clips, out_mp3: Path, out_json: Path, meta):
    gap = np.zeros(int(GAP * OUT_SR), dtype=np.float32)
    parts, items, pos = [gap], {}, GAP
    for k in sorted(clips):
        y = clips[k]
        items[k] = [round(pos, 4), round(len(y) / OUT_SR, 4)]
        parts += [y, gap]
        pos += len(y) / OUT_SR + GAP
    audio = np.concatenate(parts)
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / 'sprite.wav'
        sf.write(wav, audio, OUT_SR)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-ac', '1', '-ar', str(OUT_SR),
                        '-c:a', 'libmp3lame', '-b:a', '56k', str(out_mp3)], check=True)
    meta = dict(meta, file=out_mp3.name, sampleRate=OUT_SR, pad=0.05, items=items)
    out_json.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    return audio, items


# ---------- bản nghe thử: mõ + chuông (tạo bằng toán) + giọng VieNeu ----------
def synth_mo(sr, v=1.0):
    n = int(0.25 * sr); t = np.arange(n) / sr
    f = 390 + (560 - 390) * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / sr) * np.exp(-t / 0.045) * 0.75
    click = np.sin(2 * np.pi * 1210 * t) * np.exp(-t / 0.012) * 0.16
    noise = np.random.randn(n) * np.exp(-t / 0.006) * 0.08
    return ((body + click + noise) * v).astype(np.float32)


def synth_bell(sr, v=1.0, base=174.0):
    dur = 9.0; n = int(dur * sr); t = np.arange(n) / sr
    out = np.zeros(n, dtype=np.float64)
    for r, a, d in [(0.5, .34, 9), (1, .55, 7), (1.19, .26, 5.5), (1.5, .17, 4.5), (2, .3, 4), (2.52, .11, 3), (2.66, .1, 2.6), (3.01, .11, 2.2), (4.07, .06, 1.6)]:
        for det in (-0.7, 0.7):
            out += np.sin(2 * np.pi * (base * r + det) * t) * a * 0.28 * np.exp(-t * 6.9 / d)
    return (out * v).astype(np.float32)


def render_demo(track, clips, out_path: Path):
    sr = OUT_SR
    beat = track['beat']
    beats = []
    for li, line in enumerate(track['lines']):
        words = line.split()
        for si, w in enumerate(words):
            beats.append((li, si, w))
        if line.rstrip()[-1:] in '.!:':
            beats.append((li, -1, None))
    total = len(beats) * beat + 9.5
    mix = np.zeros(int(total * sr) + sr, dtype=np.float32)
    def add(sig, at):
        i = int(at * sr); mix[i:i + len(sig)] += sig[:len(mix) - i]
    mo, bell = synth_mo(sr), synth_bell(sr)
    prev_line_end_stop = True
    for i, (li, si, w) in enumerate(beats):
        t = 1.0 + i * beat
        add(mo * (1.0 if si == 0 else 0.8), t)
        if si == 0 and (li == 0 or prev_line_end_stop):
            add(bell * 0.6, t)
        if w:
            c = clips.get(key(w))
            if c is not None:
                add(c * 1.1, t + 0.01)
        if si == 0:
            prev_line_end_stop = track['lines'][li].rstrip()[-1:] in '.!'
    end = 1.0 + len(beats) * beat + 0.3
    for k in range(3):
        add(bell * 0.8, end + k * 2.6)
    # vang nhẹ như trong chánh điện
    ir_n = int(2.4 * sr); ir = np.random.randn(ir_n).astype(np.float32) * np.power(1 - np.arange(ir_n) / ir_n, 3.4)
    wet = np.convolve(mix, ir * 0.02, mode='full')[:len(mix)]
    out = mix + 0.35 * wet
    out = out / max(1e-6, float(np.abs(out).max())) * 0.9
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / 'demo.wav'
        sf.write(wav, out, sr)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '96k', str(out_path)], check=True)


def main():
    ap = argparse.ArgumentParser(description='Tạo giọng tụng kinh bằng VieNeu-TTS v3 Turbo')
    ap.add_argument('--voice', default='Thiền Tâm Đức', help='Tên giọng mẫu của VieNeu')
    ap.add_argument('--tries', type=int, default=2, help='Số bản sinh cho mỗi chữ để chọn bản tốt nhất')
    ap.add_argument('--pitch', type=float, default=0.0, help='Mức kéo cao độ về giọng tụng chung (0 = giữ nguyên, 1 = đều hẳn). Kéo nhiều làm mờ chữ.')
    ap.add_argument('--form', choices=['single', 'middle'], default='single', help='single: đọc riêng một chữ (rõ chữ nhất khi đo bằng Whisper); middle: đọc "x x x" rồi lấy chữ giữa (ít hạ giọng cuối nhưng dễ dính phụ âm)')
    ap.add_argument('--onnx-dir', default=None, help='Thư mục onnx_update đã tải sẵn (nếu cần)')
    ap.add_argument('--out', default=str(ROOT / 'public' / 'audio'), help='Thư mục xuất')
    ap.add_argument('--demo', default=None, help='Xuất thêm bản nghe thử Bát Nhã (MP3)')
    ap.add_argument('--cache', default=None, help='File .npz lưu bản thu gốc; có sẵn thì dùng lại, không sinh lại')
    args = ap.parse_args()

    from vieneu import Vieneu
    tracks = chant_data()
    syl = sorted({key(w) for t in tracks.values() if t['voice'] for line in t['lines'] for w in line.split() if key(w)})
    print(f'{len(syl)} chữ cần tạo, giọng "{args.voice}"')
    if args.cache and Path(args.cache).exists():
        data = np.load(args.cache)
        picked = {k: data[k] for k in data.files}
        print(f'Dùng lại {len(picked)} chữ từ {args.cache}')
    else:
        tts = Vieneu(onnx_dir=args.onnx_dir) if args.onnx_dir else Vieneu()
        picked = generate(tts, syl, args.voice, args.tries, args.form)
        if args.cache:
            np.savez_compressed(args.cache, **picked)
    clips, target = process(picked, args.pitch)
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    meta = {
        'model': 'pnnbao-ump/VieNeu-TTS-v3-Turbo', 'sdk': 'vieneu ' + importlib.metadata.version('vieneu'),
        'voice': args.voice, 'form': args.form, 'license': 'Apache-2.0', 'pitchHz': round(target, 1) if target else None,
        'note': 'Giọng tổng hợp bằng VieNeu-TTS (https://github.com/pnnbao97/VieNeu-TTS), tác giả Phạm Nguyễn Ngọc Bảo.'
    }
    write_sprite(clips, out / 'chant-voice.mp3', out / 'chant-voice.json', meta)
    print(f'Đã ghi {out / "chant-voice.mp3"} ({(out / "chant-voice.mp3").stat().st_size // 1024} KB) và chant-voice.json · {len(clips)} chữ')
    if args.demo:
        render_demo(tracks['batnha'], clips, Path(args.demo))
        print(f'Bản nghe thử: {args.demo}')


if __name__ == '__main__':
    main()
