FROM node:22-alpine
WORKDIR /app
# ffmpeg: nén giọng đọc thông báo sang MP3 cho nhẹ (không có thì gửi WAV)
RUN apk add --no-cache ffmpeg
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]
