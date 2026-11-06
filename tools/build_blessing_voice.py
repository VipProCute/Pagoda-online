#!/usr/bin/env python3
"""
Tạo giọng NỮ đọc lời chúc (hiện cùng meme khi công đức chạm mốc 100, 300, 500, 888, 999, 1000...)
bằng VieNeu-TTS v3 Turbo (mã nguồn mở, Apache-2.0), rồi xuất:

    public/audio/blessings/binh-an-1.mp3 ... binh-an-4.mp3   (đơn kênh, 24 kHz, 48 kbps, dưới ~4,5 giây)
    public/audio/blessings/manifest.json                      (server đọc file này để gửi cho trình duyệt)

Đã chạy thật với vieneu 3.8.3 (CPU, ONNX) và giọng "Trúc Ly" (nữ, Bắc). Bộ file đang có trong repo được làm như sau:
mỗi câu sinh 4 bản (và 4 bản với dấu câu khác), cho Whisper nhận dạng lại từng bản, giữ bản đọc đúng chữ nhất
(độ khớp 0,96 đến 1,00; "A Di Đà" nghe thành "Azi Đà" là cách đọc miền Bắc của chữ Di), kiểm tra cao độ F0 khoảng 240 đến 280 Hz
(đúng giọng nữ), rồi cho qua đúng các bước trong file này: cắt lặng, nén nhẹ, cân âm lượng về -16 đến -17 LUFS, mã hóa MP3.
Script này chọn bản gần độ dài trung vị nhất (không có bước nhận dạng); muốn chọn kỹ hơn thì tự nghe lại từng bản.
Hãy NGHE LẠI từng file rồi mới commit. Nếu giọng chưa ưng, đổi --voice (xem danh sách bằng --list-voices) hoặc tăng --tries.

Cài đặt (CPU là đủ, không cần GPU):
    python -m venv .venv && . .venv/bin/activate
    pip install vieneu librosa soundfile "onnxruntime==1.22.1"
Chạy:
    python tools/build_blessing_voice.py --list-voices
    python tools/build_blessing_voice.py --voice "Trúc Ly" --tries 3 --notice

Ghi chú:
  * onnxruntime >= 1.23 từ chối đọc mô hình qua bộ nhớ đệm Hugging Face; nếu gặp lỗi
    "External data path escapes model directory", ghim 1.22.1 như trên hoặc tải sẵn bằng
    huggingface_hub.snapshot_download(..., local_dir=...) rồi dùng --onnx-dir (xem build_chant_voice.py).
  * Cần `ffmpeg` trong PATH (cân âm lượng loudnorm hai lượt + mã hóa MP3).
  * Câu chữ phải khớp với BLESSINGS trong public/js/celebrate.js (trình duyệt dùng cùng các câu này
    để đọc bằng speechSynthesis khi không có file MP3).
  * Âm thanh giữ watermark mặc định của VieNeu (không tắt).
"""
import argparse
import importlib.metadata
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SRC_SR = 48000          # VieNeu v3 Turbo xuất 48 kHz
OUT_SR = 24000
PAD = 0.12              # khoảng lặng đầu/cuối mỗi file (giây)
MAX_SEC = 4.5           # độ dài tối đa sau khi cắt lặng (không tính PAD)
TARGET_LUFS = -16.0
TRUE_PEAK = -2.0        # chừa dư ~1 dB cho bước mã hóa MP3 để đỉnh cuối cùng vẫn <= -1 dBFS
DEFAULT_VOICE = 'Trúc Ly'   # nữ · Bắc · tự nhiên (giọng được VieNeu xếp trong nhóm chọn lọc)

# Phải khớp với hợp đồng (celebrate.js dùng cùng các câu khi phải đọc bằng speechSynthesis).
BLESSINGS = [
    ('binh-an-1.mp3', 'Chúc bạn một ngày bình an.'),
    ('binh-an-2.mp3', 'A Di Đà Phật. Chúc bạn một ngày mới an lành.'),
    ('binh-an-3.mp3', 'Chúc bạn thân tâm an lạc, vạn sự như ý.'),
    ('binh-an-4.mp3', 'Công đức viên mãn. Chúc bạn bình an, hạnh phúc.'),
]

NOTICE_MARK = 'binh-an-1.mp3'


# ---------- xử lý tín hiệu ----------
def frame_rms(y, sr, ms=10):
    hop = max(1, int(sr * ms / 1000))
    n = len(y) // hop
    if n == 0:
        return np.zeros(0, dtype=np.float32), hop
    return np.sqrt(np.mean(y[:n * hop].reshape(n, hop) ** 2, axis=1)), hop


def trim_silence(y, sr, floor_db=-42.0):
    """Cắt lặng đầu/cuối: ngưỡng = đỉnh RMS khung 10 ms hạ xuống floor_db."""
    rms, hop = frame_rms(y, sr)
    if rms.size == 0 or rms.max() <= 0:
        return y[:0]
    on = np.where(rms > rms.max() * 10 ** (floor_db / 20))[0]
    if on.size == 0:
        return y[:0]
    a = max(0, on[0] * hop - int(0.02 * sr))
    b = min(len(y), (on[-1] + 1) * hop + int(0.04 * sr))
    return y[a:b]


def pad_edges(y, sr, pad=PAD):
    z = np.zeros(int(pad * sr), dtype=y.dtype)
    return np.concatenate([z, y, z])


def fade(y, sr, ms=8):
    n = min(int(sr * ms / 1000), len(y) // 2)
    if n > 0:
        ramp = np.linspace(0, 1, n, dtype=y.dtype)
        y = y.copy()
        y[:n] *= ramp
        y[-n:] *= ramp[::-1]
    return y


def median_f0(y, sr):
    """Cao độ trung vị (Hz) để kiểm tra có đúng giọng nữ (~160-280 Hz) không. None nếu thiếu librosa."""
    try:
        import librosa
    except ImportError:
        return None
    y16 = librosa.resample(y, orig_sr=sr, target_sr=16000)
    f0, voiced, _ = librosa.pyin(y16, fmin=70, fmax=450, sr=16000, frame_length=1024)
    f0 = f0[voiced & ~np.isnan(f0)]
    return float(np.median(f0)) if f0.size else None


# ---------- ffmpeg ----------
def run_ffmpeg(args, capture=False):
    cmd = ['ffmpeg', '-hide_banner', '-nostats', '-y'] + args
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError('ffmpeg lỗi: ' + ' '.join(cmd) + '\n' + res.stderr[-1500:])
    return res.stderr if capture else ''


# Nén nhẹ trước khi cân âm lượng: đỉnh bớt nhô lên thì loudnorm (đang bị chặn bởi đỉnh thật -2 dBFS) mới kéo được
# cả bốn câu về gần nhau, không câu nào nhỏ hơn hẳn câu khác.
PRE = 'acompressor=threshold=-22dB:ratio=3:attack=4:release=90:makeup=3dB,'


def loudnorm_two_pass(wav_in: Path, mp3_out: Path):
    base = f'I={TARGET_LUFS}:TP={TRUE_PEAK}:LRA=20'
    log = run_ffmpeg(['-i', str(wav_in), '-af', f'{PRE}loudnorm={base}:print_format=json', '-f', 'null', '-'], capture=True)
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', log, re.S)
    if not m:
        raise RuntimeError('Không đọc được kết quả đo loudnorm:\n' + log[-800:])
    s = json.loads(m.group(0))
    flt = (f'{PRE}loudnorm={base}:measured_I={s["input_i"]}:measured_TP={s["input_tp"]}:measured_LRA={s["input_lra"]}'
           f':measured_thresh={s["input_thresh"]}:offset={s["target_offset"]}:linear=true,aresample={OUT_SR}')
    run_ffmpeg(['-i', str(wav_in), '-af', flt, '-ac', '1', '-ar', str(OUT_SR),
                '-c:a', 'libmp3lame', '-b:a', '48k', str(mp3_out)])


def measure(mp3: Path):
    """Đo lại file đã mã hóa: thời lượng, codec, LUFS tích hợp, đỉnh mẫu, đỉnh thật."""
    pr = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration,bit_rate',
                         '-of', 'json', str(mp3)], capture_output=True, text=True, check=True)
    info = json.loads(pr.stdout)
    log = run_ffmpeg(['-i', str(mp3), '-af', 'ebur128=peak=true,volumedetect', '-f', 'null', '-'], capture=True)
    lufs = re.findall(r'I:\s+(-?[\d.]+)\s+LUFS', log)
    tp = re.findall(r'Peak:\s+(-?[\d.]+)\s+dBFS', log)
    mx = re.search(r'max_volume:\s+(-?[\d.]+) dB', log)
    return {
        'duration': float(info['format']['duration']),
        'codec': info['streams'][0]['codec_name'],
        'rate': int(info['streams'][0]['sample_rate']),
        'channels': int(info['streams'][0]['channels']),
        'lufs': float(lufs[-1]) if lufs else None,
        'true_peak': float(tp[-1]) if tp else None,
        'max_volume': float(mx.group(1)) if mx else None,
    }


# ---------- sinh giọng ----------
def pick_take(takes, sr, words):
    """Trong vài bản sinh, bỏ bản quá dài/quá ngắn (đọc thừa, nuốt chữ) rồi lấy bản có độ dài gần trung vị nhất."""
    trimmed = [trim_silence(np.asarray(t, dtype=np.float32), sr) for t in takes]
    durs = [len(t) / sr for t in trimmed]
    ok = [i for i, d in enumerate(durs) if 0.18 * words <= d <= min(MAX_SEC, 0.7 * words)]
    if not ok:
        print(f'  ! không bản nào nằm trong khoảng hợp lý ({[round(d, 2) for d in durs]} s), lấy bản ngắn nhất', file=sys.stderr)
        i = int(np.argmin(durs))
        return trimmed[i]
    med = float(np.median([durs[i] for i in ok]))
    best = min(ok, key=lambda i: abs(durs[i] - med))
    return trimmed[best]


def bundled_voices():
    """Giọng mẫu v3 Turbo nằm sẵn trong gói vieneu (assets/voices_v3_turbo.json), đọc được khi không có mạng."""
    import importlib.util
    spec = importlib.util.find_spec('vieneu')
    if spec is None or not spec.submodule_search_locations:
        sys.exit('Chưa cài gói vieneu (pip install vieneu).')
    path = Path(list(spec.submodule_search_locations)[0]) / 'assets' / 'voices_v3_turbo.json'
    presets = json.loads(path.read_text(encoding='utf-8')).get('presets', {})
    return {n: {k: v.get(k) for k in ('gender', 'region', 'description')} for n, v in presets.items()}


def notice_text(voice, version):
    return (
        '\nbinh-an-1.mp3 ... binh-an-4.mp3 (thư mục blessings/) — lời chúc giọng nữ tổng hợp bằng VieNeu-TTS v3 Turbo\n'
        'Mô hình: https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo\n'
        'Mã nguồn: https://github.com/pnnbao97/VieNeu-TTS\n'
        f'Tác giả: Phạm Nguyễn Ngọc Bảo · Giấy phép: Apache License 2.0 · SDK: vieneu {version}\n'
        f'Giọng mẫu: {voice} (preset voice nữ phát hành cùng mô hình, Apache-2.0)\n'
        'Codec: MOSS-Audio-Tokenizer-Nano (OpenMOSS-Team), Apache-2.0\n'
        'Âm thanh do máy tổng hợp và có watermark mặc định của VieNeu.\n'
    )


def main():
    ap = argparse.ArgumentParser(description='Tạo giọng nữ đọc lời chúc bằng VieNeu-TTS v3 Turbo')
    ap.add_argument('--voice', default=DEFAULT_VOICE, help='Tên giọng mẫu nữ của VieNeu (xem --list-voices)')
    ap.add_argument('--list-voices', action='store_true', help='Liệt kê giọng mẫu rồi thoát')
    ap.add_argument('--tries', type=int, default=3, help='Số bản sinh cho mỗi câu để chọn bản tốt nhất')
    ap.add_argument('--onnx-dir', default=None, help='Thư mục onnx_update đã tải sẵn (nếu cần)')
    ap.add_argument('--out', default=str(ROOT / 'public' / 'audio' / 'blessings'), help='Thư mục xuất')
    ap.add_argument('--keep-wav', default=None, help='Thư mục lưu thêm bản WAV 48 kHz chưa xử lý (để so sánh)')
    ap.add_argument('--notice', action='store_true', help='Ghi thêm đoạn ghi công vào public/audio/NOTICE.txt (nếu chưa có)')
    args = ap.parse_args()

    if args.list_voices:                        # đọc thẳng file giọng đi kèm gói vieneu, không cần tải mô hình
        for name, v in bundled_voices().items():
            print(f'{name}\t{v.get("gender", "?")}\t{v.get("description", "")}')
        return

    from vieneu import Vieneu
    tts = Vieneu(onnx_dir=args.onnx_dir) if args.onnx_dir else Vieneu()
    names = {n for _, n in tts.list_preset_voices()}    # [(nhãn, tên giọng), ...]
    if args.voice not in names:
        sys.exit(f'Không có giọng "{args.voice}". Dùng --list-voices; chọn giọng có gender=female.')
    meta = tts.get_preset_voice(args.voice)
    if meta.get('gender') != 'female':
        print(f'! Cảnh báo: giọng "{args.voice}" không được đánh dấu là nữ (gender={meta.get("gender")})', file=sys.stderr)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest, report = [], []
    for fname, text in BLESSINGS:
        words = len(text.replace('.', ' ').replace(',', ' ').split())
        print(f'{fname}: "{text}"')
        takes = [np.asarray(tts.infer(text, voice=args.voice), dtype=np.float32) for _ in range(max(1, args.tries))]
        if args.keep_wav:
            Path(args.keep_wav).mkdir(parents=True, exist_ok=True)
            for k, t in enumerate(takes):
                sf.write(Path(args.keep_wav) / f'{Path(fname).stem}-take{k + 1}.wav', t, SRC_SR)
        y = pick_take(takes, SRC_SR, words)
        if len(y) == 0:
            sys.exit(f'{fname}: bản sinh bị im lặng, dừng.')
        f0 = median_f0(y, SRC_SR)
        y = fade(pad_edges(y, SRC_SR), SRC_SR)
        with tempfile.TemporaryDirectory() as td:
            wav = Path(td) / 'in.wav'
            sf.write(wav, y, SRC_SR, subtype='FLOAT')
            loudnorm_two_pass(wav, out / fname)
        m = measure(out / fname)
        m['f0'] = f0
        report.append((fname, m))
        manifest.append({'file': fname, 'text': text})
        flag = []
        if m['duration'] > MAX_SEC + 2 * PAD + 0.3:
            flag.append('QUÁ DÀI')
        if m['true_peak'] is not None and m['true_peak'] > -0.9:
            flag.append('ĐỈNH CAO')
        if m['lufs'] is not None and abs(m['lufs'] - TARGET_LUFS) > 1.5:
            flag.append('LỆCH LUFS')
        if f0 is not None and not (150 <= f0 <= 300):
            flag.append(f'F0={f0:.0f}Hz NGOÀI KHOẢNG GIỌNG NỮ')
        print(f'  {m["duration"]:.2f}s · {m["codec"]} {m["rate"]}Hz x{m["channels"]} · {m["lufs"]} LUFS · peak {m["true_peak"]} dBFS'
              f' · F0 {f0 and round(f0)} Hz {" ".join("<" + f + ">" for f in flag)}')

    (out / 'manifest.json').write_text(json.dumps({'lines': manifest}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    total = sum((out / f).stat().st_size for f, _ in BLESSINGS)
    print(f'Đã ghi {len(manifest)} file + manifest.json vào {out} ({total // 1024} KB). HÃY NGHE LẠI TRƯỚC KHI COMMIT.')

    if args.notice:
        notice = ROOT / 'public' / 'audio' / 'NOTICE.txt'
        cur = notice.read_text(encoding='utf-8') if notice.exists() else ''
        if NOTICE_MARK in cur:
            print('NOTICE.txt đã có ghi công lời chúc, bỏ qua.')
        else:
            notice.write_text(cur.rstrip('\n') + '\n' + notice_text(args.voice, importlib.metadata.version('vieneu')), encoding='utf-8')
            print('Đã thêm ghi công vào', notice)


if __name__ == '__main__':
    main()
