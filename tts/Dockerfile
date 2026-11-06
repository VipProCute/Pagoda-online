# Máy chủ đọc VieNeu-TTS (chuẩn POST /v1/audio/speech) cho thông báo cúng dường của chùa.
# Chạy trên CPU. Lần đầu khởi động sẽ tải mô hình từ Hugging Face (vài phút).
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir vieneu fastapi uvicorn
ENV VIENEU_BACKEND=onnx \
    VIENEU_PRECISION=int8 \
    HOST=0.0.0.0 \
    PORT=7860 \
    HF_HOME=/tmp/hf
EXPOSE 7860
CMD ["python", "-m", "apps.openai_speech"]
