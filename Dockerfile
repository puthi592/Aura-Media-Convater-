FROM node:18-slim

# ដំឡើង Python, ffmpeg និង curl សម្រាប់ yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ដំឡើង yt-dlp ជំនាន់ចុងក្រោយ
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# คัดចម្លង package.json និងដំឡើង Node modules
COPY package*.json ./
RUN npm install

# คัดចម្លងកូដទាំងអស់ចូល Server
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
