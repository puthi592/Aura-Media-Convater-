# ប្រើប្រាស់ Node.js official image ជា base ព្រោះ project យើងជា Node.js/Express app
FROM node:18-slim

# ដំឡើង Python3, pip, និង ffmpeg សម្រាប់ yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# កំណត់ Working Directory
WORKDIR /app

# ចម្លង package.json និងដំឡើង Node packages
COPY package*.json ./
RUN npm install

# ចម្លងកូដដែលសល់ទាំងអស់ចូល
COPY . .

# អាប់ដេត yt-dlp ឱ្យជា Version ចុងក្រោយបំផុត ដើម្បីការពារ Error 429
RUN pip3 install --no-cache-dir --upgrade yt-dlp

# បើក Port 10000 សម្រាប់ Render
EXPOSE 10000

# ចាប់ផ្តើម Run Server
CMD ["node", "server.js"]
