const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const COBALT_API = 'https://api.cobalt.tools';

async function cobaltFetch(url) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ url, videoQuality: '720', filenameStyle: 'basic' });
    const options = {
      hostname: 'api.cobalt.tools',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const YTDLP_OPTS = `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --add-header "Accept-Language:en-US,en;q=0.9" --extractor-args "youtube:player_client=android" --no-check-certificates`;

function isYouTube(url) { return url.includes('youtube.com') || url.includes('youtu.be'); }
function isInstagram(url) { return url.includes('instagram.com'); }
function isTikTok(url) { return url.includes('tiktok.com') || url.includes('vm.tiktok'); }

app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  if (isYouTube(url) || isInstagram(url)) {
    try {
      const result = await cobaltFetch(url);
      if (result.status === 'error') return res.status(500).json({ error: 'No se pudo obtener el vídeo.' });
      
      return res.json({
        title: result.filename || 'Vídeo',
        thumbnail: result.thumbnail || '',
        duration: '',
        cobalt: true,
        cobaltUrl: result.url || (result.picker && result.picker[0]?.url),
        formats: [
          { quality: '720p', label: '720p · HD' },
          { quality: '1080p', label: '1080p · Full HD' }
        ]
      });
    } catch (e) {
      return res.status(500).json({ error: 'No se pudo obtener el vídeo.' });
    }
  }

  exec(`yt-dlp --dump-json --no-playlist ${YTDLP_OPTS} "${url}"`, { timeout: 30000 }, (error, stdout) => {
    if (error) return res.status(500).json({ error: 'No se pudo obtener el vídeo.' });
    try {
      const info = JSON.parse(stdout);
      res.json({
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration_string,
        formats: [
          { quality: '480p', label: '480p · Estándar' },
          { quality: '720p', label: '720p · HD' },
          { quality: '1080p', label: '1080p · Full HD' }
        ]
      });
    } catch (e) {
      res.status(500).json({ error: 'Error procesando la respuesta' });
    }
  });
});

app.get('/api/download', async (req, res) => {
  const { url, quality } = req.query;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  if (isYouTube(url) || isInstagram(url)) {
    try {
      const quality_num = quality === '1080p' ? '1080' : '720';
      const result = await cobaltFetch(url);
      if (result.status === 'error') return res.status(500).send('Error obteniendo vídeo');
      const videoUrl = result.url || (result.picker && result.picker[0]?.url);
      if (!videoUrl) return res.status(500).send('No se encontró URL del vídeo');
      return res.redirect(videoUrl);
    } catch (e) {
      return res.status(500).send('Error descargando');
    }
  }

  const height = (quality || '720p').replace('p', '');
  const tmpFile = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);
  const cmd = `yt-dlp -f "bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best" --merge-output-format mp4 ${YTDLP_OPTS} -o "${tmpFile}" "${url}"`;

  exec(cmd, { timeout: 300000 }, (error) => {
    if (error || !fs.existsSync(tmpFile)) {
      if (!res.headersSent) res.status(500).send('Error descargando el vídeo');
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename="video_${height}p.mp4"`);
    res.setHeader('Content-Type', 'video/mp4');
    const stream = fs.createReadStream(tmpFile);
    stream.pipe(res);
    stream.on('close', () => fs.unlink(tmpFile, () => {}));
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));