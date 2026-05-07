const express = require('express');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 3001;

const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.projectsegfault.net',
    'https://pipedapi.adminforge.de',
];

function extractVideoId(url) {
    const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return match ? match[1] : null;
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { reject(new Error('JSON parse error')); }
            });
        }).on('error', reject);
    });
}

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: String(PORT) });
});

app.get('/stream', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const videoId = extractVideoId(url);
    if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

    console.log('[ytproxy] Requête stream :', videoId);

    for (const instance of PIPED_INSTANCES) {
        try {
            const data = await fetchJson(`${instance}/streams/${videoId}`);
            if (data.audioStreams && data.audioStreams.length > 0) {
                const audio = data.audioStreams
                    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
                console.log('[ytproxy] Redirect audio via', instance);
                return res.redirect(302, audio.url);
            }
        } catch(e) {
            console.warn('[ytproxy] Instance', instance, 'échouée:', e.message);
        }
    }

    res.status(503).json({ error: 'Toutes les instances Piped ont échoué' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('[ytproxy] Service démarré sur le port', PORT);
});
