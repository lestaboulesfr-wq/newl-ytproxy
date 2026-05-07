const express = require('express');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 3001;

const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.darkness.services',
    'https://piped-api.garudalinux.org',
    'https://pipedapi.moomoo.me',
];

const INVIDIOUS_INSTANCES = [
    'https://invidious.io',
    'https://yt.cdaut.de',
    'https://inv.nadeko.net',
    'https://invidious.flokinet.to',
];

function extractVideoId(url) {
    const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
    return match ? match[1] : null;
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                if (res.statusCode !== 200)
                    return reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 120)}`));
                try { resolve(JSON.parse(data)); }
                catch(e) { reject(new Error(`JSON invalide: ${data.substring(0, 120)}`)); }
            });
        });
        req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
    });
}

async function getAudioUrlPiped(videoId, instance) {
    const data = await fetchJson(`${instance}/streams/${videoId}`);
    if (!data.audioStreams || data.audioStreams.length === 0) throw new Error('Aucun flux audio');
    return data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0].url;
}

async function getAudioUrlInvidious(videoId, instance) {
    const data = await fetchJson(`${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats`);
    const formats = (data.adaptiveFormats || []).filter(f => f.type && f.type.startsWith('audio/'));
    if (formats.length === 0) throw new Error('Aucun flux audio');
    return formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0].url;
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
            const audioUrl = await getAudioUrlPiped(videoId, instance);
            console.log('[ytproxy] OK via Piped', instance);
            return res.redirect(302, audioUrl);
        } catch(e) {
            console.warn('[ytproxy] Piped', instance, ':', e.message);
        }
    }

    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const audioUrl = await getAudioUrlInvidious(videoId, instance);
            console.log('[ytproxy] OK via Invidious', instance);
            return res.redirect(302, audioUrl);
        } catch(e) {
            console.warn('[ytproxy] Invidious', instance, ':', e.message);
        }
    }

    res.status(503).json({ error: 'Toutes les instances ont échoué' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('[ytproxy] Service démarré sur le port', PORT);
});
