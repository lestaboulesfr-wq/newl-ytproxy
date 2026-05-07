const express = require('express');
const { spawn } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

let cookiesPath = null;
if (process.env.YOUTUBE_COOKIES) {
    cookiesPath = path.join(os.tmpdir(), 'yt_cookies.txt');
    fs.writeFileSync(cookiesPath, process.env.YOUTUBE_COOKIES, 'utf8');
    console.log('[ytproxy] Cookies YouTube chargés depuis env');
}

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: String(PORT), cookies: !!cookiesPath });
});

app.get('/stream', (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    console.log('[ytproxy] Requête stream :', url);

    const args = [
        '-m', 'yt_dlp',
        '-f', 'bestaudio',
        '-o', '-',
        '--no-playlist',
        '--quiet',
        '--extractor-args', 'youtube:player_client=mweb',
    ];
    if (cookiesPath) args.push('--cookies', cookiesPath);
    args.push(url);

    const ytdlp = spawn('python3', args);

    res.setHeader('Content-Type', 'audio/webm');
    res.setHeader('Transfer-Encoding', 'chunked');

    ytdlp.stdout.pipe(res);

    let stderrBuf = '';
    ytdlp.stderr.on('data', (d) => { stderrBuf += d.toString(); });

    ytdlp.on('error', (err) => {
        console.error('[ytproxy] spawn erreur:', err.message);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    });

    ytdlp.on('close', (code) => {
        if (code !== 0 && code !== null)
            console.error('[ytproxy] yt-dlp erreur (code', code + '):', stderrBuf.slice(-500));
    });

    req.on('close', () => ytdlp.kill('SIGTERM'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('[ytproxy] Service démarré sur le port', PORT);
});
