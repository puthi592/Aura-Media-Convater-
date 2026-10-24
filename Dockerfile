FROM node:20-slim

# python3 + pip for yt-dlp, ffmpeg for MP3 conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Latest yt-dlp. "[default]" includes the YouTube JS solver (yt-dlp-ejs).
# --break-system-packages is required on Debian 12 (PEP 668).
RUN pip3 install --no-cache-dir --upgrade --break-system-packages "yt-dlp[default]"

ENV NODE_ENV=production
EXPOSE 10000

CMD ["node", "server.js"]
