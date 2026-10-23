FROM node:18-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN pip3 install --no-cache-dir --upgrade yt-dlp

EXPOSE 10000

CMD ["node", "server.js"]
