const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// 🚀 ១. កំណត់ឱ្យ Server ស្គាល់ Folder public
app.use(express.static(path.join(__dirname, 'public')));

// 🚀 ២. ពេលគេចូល Link Render (/) ឱ្យវាផ្ញើဖိုင် public/index.html ទៅបង្ហាញ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// បង្កើត folder សម្រាប់ទុកဖိုင် MP3 បណ្តោះអាសន្ន
const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

// API Endpoint សម្រាប់បម្លែង
app.post('/api/download', (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'សូមបញ្ចូល YouTube URL!' });
    }

    const timestamp = Date.now();
    const outputFilename = `audio_${timestamp}.mp3`;
    const outputPath = path.join(downloadDir, outputFilename);

    const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${url}"`;

    console.log(`[INFO] កំពុងបម្លែងជា MP3៖ ${url}`);

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`[ERROR]:`, stderr);
            return res.status(500).json({ error: 'មិនអាចបម្លែងជា MP3 បានទេ។ សូមពិនិត្យលីងម្តងទៀត!' });
        }

        res.download(outputPath, outputFilename, (err) => {
            if (err) console.error(err);
            setTimeout(() => {
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            }, 10000);
        });
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server ដំណើរការលើ Port ${PORT}`);
});
