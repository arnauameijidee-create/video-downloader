const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 🔥 CACHE
const cache = new Map();

const YTDLP_OPTS = `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --no-check-certificates`;

app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));

// ✅ NUEVA RUTA LIGERA
app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});



// =========================
// ⚡ API INFO (con cache)
// =========================
app.post('/api/info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  if (cache.has(url)) {
    console.log('CACHE HIT');
    return res.json(cache.get(url));
  }

  exec(`yt-dlp --dump-json --no-playlist ${YTDLP_OPTS} "${url}"`, { timeout: 15000 }, (error, stdout) => {
    if (error) {
      return res.status(500).json({ error: 'No se pudo obtener el vídeo.' });
    }

    try {
      const info = JSON.parse(stdout);

      const response = {
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration_string,
        formats: [
          { quality: '480p', label: '480p · Estándar' },
          { quality: '720p', label: '720p · HD' },
          { quality: '1080p', label: '1080p · Full HD' }
        ]
      };

      cache.set(url, response);
      setTimeout(() => cache.delete(url), 600000);

      res.json(response);
    } catch {
      res.status(500).json({ error: 'Error procesando la respuesta' });
    }
  });
});



// =========================
// 🚀 DESCARGA ULTRA RÁPIDA
// =========================
app.get('/api/download', (req, res) => {
  const { url, quality } = req.query;
  if (!url) return res.status(400).send('URL requerida');

  const height = (quality || '720p').replace('p', '');

  console.log('Redirigiendo descarga:', url);

  const cmd = `yt-dlp -f "best[height<=${height}]" --get-url ${YTDLP_OPTS} "${url}"`;

  exec(cmd, { timeout: 15000 }, (error, stdout) => {
    if (error || !stdout) {
      return res.status(500).send('Error obteniendo el vídeo');
    }

    const videoUrl = stdout.trim().split('\n')[0];

    res.redirect(videoUrl);
  });
});



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));