---
title: VieNeu TTS cho Chùa Tâm An
sdk: docker
app_port: 7860
pinned: false
---

# Máy chủ đọc thông báo (VieNeu-TTS)

Máy chủ chùa gọi máy chủ này để đọc thông báo cúng dường bằng giọng nữ. Đây là máy chủ đọc có sẵn trong gói [`vieneu`](https://github.com/pnnbao97/VieNeu-TTS) (`python -m apps.openai_speech`, chuẩn `POST /v1/audio/speech`), chạy được trên CPU.

## Chạy bằng Docker

```bash
docker build -t vieneu-tts tts/
```

```bash
docker run -d -p 7860:7860 -e VIENEU_API_KEY=chuoi-bi-mat vieneu-tts
```

Rồi đặt cho máy chủ chùa: `TTS_URL=http://<máy>:7860`, `TTS_API_KEY=chuoi-bi-mat`.

## Chạy trên Hugging Face Spaces (miễn phí, CPU)

1. Tạo Space mới, chọn **Docker**.
2. Tải lên `Dockerfile` và `README.md` trong thư mục này.
3. Trong **Settings → Variables and secrets**, thêm secret `VIENEU_API_KEY`.
4. Đặt cho máy chủ chùa: `TTS_URL=https://<tên-người-dùng>-<tên-space>.hf.space`, `TTS_API_KEY` bằng secret ở trên.

Space miễn phí ngủ khi lâu không ai dùng; lần gọi đầu sau khi ngủ có thể quá thời gian chờ, khi đó trình duyệt tự đọc bằng giọng có sẵn. Tăng `TTS_TIMEOUT` (giây) nếu cần.

## Kiểm tra

```bash
curl -s http://127.0.0.1:7860/health
```

```bash
curl -s -X POST http://127.0.0.1:7860/v1/audio/speech -H "content-type: application/json" -d '{"input":"Nam mô A Di Đà Phật","voice":"Mai Anh","response_format":"wav"}' -o thu.wav
```

Giọng nữ có sẵn: Mai Anh, Ngọc Huyền, Trúc Ly, Đoan Trang, Ngọc Linh, Quỳnh Anh (Bắc); Ngọc Trân (Trung); Thùy Dung, Thục Đoan, Mỹ Duyên, Kim Thanh (Nam).

VieNeu-TTS: Apache-2.0, tác giả Phạm Nguyễn Ngọc Bảo. Âm thanh có watermark mặc định của VieNeu.
