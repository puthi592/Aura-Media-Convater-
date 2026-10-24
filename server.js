const express = require('express');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Serve the frontend from the "public" folder (public/index.html)
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 10000;

// Temporary folder for MP3 files
const downloadDir = path.join(os.tmpdir(), 'aura-downloads');
fs.mkdirSync(downloadDir, { recursive: true });

// Remove leftover files from previous runs
try {
    for (const f of fs.readdirSync(downloadDir)) {
        fs.rmSync(path.join(downloadDir, f), { force: true });
    }
} catch (e) {}

// ---- Settings ----
const MAX_CONCURRENT = 2;          // conversions at the same time
const TIMEOUT_MS = 10 * 60 * 1000; // kill a conversion after 10 minutes
const MAX_DURATION_SEC = 60 * 60;  // refuse videos longer than 1 hour
const ALLOWED_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
]);

// Helper to find yt-dlp binary path safely across platforms
function getYtDlpPath() {
    if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH;
    try {
        const cmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
        return execSync(cmd).toString().trim();
    } catch {
        return 'yt-dlp'; // Fallback to global command
    }
}

const YTDLP_BIN = getYtDlpPath();
console.log(`[INFO] Using yt-dlp binary at: ${YTDLP_BIN}`);

let cookiesPath = null;
const secretCookies = process.env.YT_COOKIES_FILE || '/etc/secrets/cookies.txt';
if (fs.existsSync(secretCookies)) {
    cookiesPath = path.join(os.tmpdir(), 'yt-cookies.txt');
    fs.copyFileSync(secretCookies, cookiesPath);
    console.log('[INFO] cookies file loaded');
}

let activeJobs = 0;

function parseYouTubeUrl(raw) {
    try {
        const u = new URL(String(raw || '').trim());
        if (!['http:', 'https:'].includes(u.protocol)) return null;
        if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return null;
        return u.toString();
    } catch {
        return null;
    }
}

function cleanup(base) {
    try {
        for (const f of fs.readdirSync(downloadDir)) {
            if (f.startsWith(base)) fs.rmSync(path.join(downloadDir, f), { force: true });
        }
    } catch (e) {
        console.error('[CLEANUP]', e.message);
    }
}

function friendlyError(stderr) {
    const s = String(stderr || '').toLowerCase();
    if (s.includes('sign in to confirm') || s.includes('not a bot') || s.includes('cookies')) {
        return 'YouTube បានរារាំង Server នេះ។ សូមព្យាយាមម្តងទៀតពេលក្រោយ ឬបន្ថែម cookies។';
    }
    if (s.includes('private video') || s.includes('video unavailable') || s.includes('not available')) {
        return 'វីដេអូនេះមិនអាចប្រើបាន ឬជាវីដេអូឯកជន។';
    }
    if (s.includes('age') && s.includes('restricted')) {
        return 'វីដេអូនេះមានកំណត់អាយុ មិនអាចបម្លែងបានទេ។';
    }
    return 'មិនអាចបម្លែងជា MP3 បានទេ។ សូមពិនិត្យលីងម្តងទៀត!';
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/download', (req, res) => {
    const url = parseYouTubeUrl(req.body && req.body.url);
    if (!url) {
        return res.status(400).json({ error: 'សូមបញ្ចូលលីង YouTube ឱ្យបានត្រឹមត្រូវ!' });
    }

    if (activeJobs >= MAX_CONCURRENT) {
        return res.status(429).json({ error: 'Server កំពុងរវល់។ សូមរង់ចាំបន្តិច រួចព្យាយាមម្តងទៀត។' });
    }

    const id = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const base = `audio_${id}`;
    const outputPath = path.join(downloadDir, `${base}.mp3`);

    const args = [
        '--no-playlist',
        '--no-warnings',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--match-filter', `duration<=${MAX_DURATION_SEC}`,
        '-o', path.join(downloadDir, `${base}.%(ext)s`),
    ];
    if (cookiesPath) args.push('--cookies', cookiesPath);
    args.push('--', url);

    console.log(`[INFO] Converting: ${url}`);
    activeJobs++;

    let child;
    try {
        child = spawn(YTDLP_BIN, args);
    } catch (err) {
        activeJobs--;
        console.error('[ERROR] Failed to spawn yt-dlp:', err.message);
        return res.status(500).json({ error: 'Server មិនទាន់ដំឡើង yt-dlp ត្រឹមត្រូវទេ។' });
    }

    let stderr = '';
    let finished = false;

    child.stderr.on('data', (d) => {
        stderr += d.toString();
        if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });

    const timer = setTimeout(() => {
        console.error('[ERROR] timeout, killing yt-dlp');
        try { child.kill('SIGKILL'); } catch (e) {}
    }, TIMEOUT_MS);

    const finish = () => {
        if (finished) return false;
        finished = true;
        clearTimeout(timer);
        activeJobs--;
        return true;
    };

    res.on('close', () => {
        if (child.exitCode === null && child.signalCode === null) {
            try { child.kill('SIGKILL'); } catch (e) {}
        }
    });

    child.on('error', (err) => {
        if (!finish()) return;
        console.error('[ERROR] cannot start yt-dlp:', err.message);
        cleanup(base);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server មិនទាន់ដំឡើង yt-dlp ទេ។' });
        }
    });

    child.on('close', (code) => {
        if (!finish()) return;

        if (code !== 0 || !fs.existsSync(outputPath)) {
            console.error('[ERROR]', stderr.trim().split('\n').slice(-5).join('\n'));
            cleanup(base);
            if (res.headersSent || res.destroyed) return;
            const tooLong = code === 0;
            return res.status(tooLong ? 413 : 500).json({
                error: tooLong
                    ? 'វីដេអូនេះវែងពេក (អតិបរមា ១ ម៉ោង)។'
                    : friendlyError(stderr),
            });
        }

        res.download(outputPath, 'audio.mp3', (err) => {
            if (err) console.error('[ERROR] send failed:', err.message);
            cleanup(base);
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
