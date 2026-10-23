const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// បង្កើត folder សម្រាប់ទុកဖိုင် MP3 បណ្តោះអាសន្ន
const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

// API Endpoint ទទួលលីងពីវេបសាយ
app.post('/api/download', (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'សូមបញ្ចូល YouTube URL!' });
    }

    const timestamp = Date.now();
    const outputFilename = `audio_${timestamp}.mp3`;
    const outputPath = path.join(downloadDir, outputFilename);

    // คำสั่ง yt-dlp សម្រាប់ទាញយក និងបម្លែងជា MP3 តែមួយមុខគត់
    const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${url}"`;

    console.log(`[INFO] កំពុងបម្លែងជា MP3៖ ${url}`);

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`[ERROR]:`, stderr);
            return res.status(500).json({ error: 'មិនអាចបម្លែងជា MP3 បានទេ។ សូមពិនិត្យលីងម្តងទៀត!' });
        }

        // ផ្ញើဖိုင် MP3 ទៅឱ្យ Frontend
        res.download(outputPath, outputFilename, (err) => {
            if (err) console.error(err);
            // លុបဖိုင်ចេញពី Server វិញក្រោយ ១០ វិនាទី
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
