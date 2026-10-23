FROM python:3.10-slim

# Install system dependencies, ffmpeg, and curl/nodejs
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy all project files
COPY . .

# Upgrade yt-dlp to the latest version to bypass 429 / extraction issues
RUN pip install --no-cache-dir --upgrade yt-dlp

# Expose port and start the application
EXPOSE 10000
CMD ["node", "server.js"]
