const express = require('express');
const { spawn } = require('child_process');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: String(PORT) });
});

app.get('/stream', (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    console.log('[ytproxy] Requête stream :', url);

    const ytdlp = spawn('python3', [
        '-m', 'yt_dlp',
        '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio',
        '-o', '-',
        '--no-playlist',
        '--quiet',
        url
    ]);

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
