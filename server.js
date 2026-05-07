/**
 * newl_ytproxy — Proxy audio YouTube pour xsound/FiveM
 * Lance : node server.js
 * Port  : 3001 (modifiable via variable d'environnement PORT)
 */

const express = require('express');
const ytdl    = require('@distube/ytdl-core');

const app  = express();
const PORT = process.env.PORT || 3001;

// CORS — autoriser les requêtes depuis le CEF de FiveM
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin',  '*');
    res.header('Access-Control-Allow-Headers', 'Range, Origin, Content-Type, Accept');
    res.header('Access-Control-Expose-Headers','Content-Length, Content-Range, Accept-Ranges');
    next();
});

// GET /stream?url=YOUTUBE_URL  →  stream audio
app.get('/stream', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).send('Paramètre url manquant');
    }
    if (!ytdl.validateURL(url)) {
        return res.status(400).send('URL YouTube invalide : ' + url);
    }

    console.log('[ytproxy] Requête stream :', url);

    try {
        const info   = await ytdl.getInfo(url);
        const format = ytdl.chooseFormat(info.formats, {
            filter:  'audioonly',
            quality: 'highestaudio',
        });

        if (!format) {
            return res.status(404).send('Aucun format audio disponible');
        }

        const contentType = format.mimeType ? format.mimeType.split(';')[0] : 'audio/webm';

        res.header('Content-Type',   contentType);
        res.header('Accept-Ranges',  'none');
        res.header('Cache-Control',  'no-cache');

        const stream = ytdl.downloadFromInfo(info, { format });

        stream.pipe(res);

        stream.on('error', (err) => {
            console.error('[ytproxy] Erreur stream :', err.message);
            if (!res.headersSent) res.status(500).send('Erreur stream');
        });

        req.on('close', () => {
            stream.destroy();
        });

    } catch (err) {
        console.error('[ytproxy] Erreur extraction :', err.message);
        if (!res.headersSent) res.status(500).send('Erreur : ' + err.message);
    }
});

// GET /health  →  vérification que le service tourne
app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ytproxy] Service démarré sur le port ${PORT}`);
    console.log(`[ytproxy] Test : http://localhost:${PORT}/health`);
});
