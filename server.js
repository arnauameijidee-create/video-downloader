const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = `--user-agent "${UA}" --add-header "Accept-Language:en-US,en;q=0.9"`;

app.post('/api/info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  exec(`yt-dlp --dump-json --no-playlist ${HEADERS} "${url}"`, { timeout: 30000 }, (error, stdout) => {
    if (error) return res.status(500).json({ error: 'No se pudo obtener el vídeo. Comprueba el link.' });
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

app.get('/api/download', (req, res) => {
  const { url, quality } = req.query;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  const height = (quality || '720p').replace('p', '');
  const tmpFile = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);
  const cmd = `yt-dlp -f "bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best" --merge-output-format mp4 ${HEADERS} -o "${tmpFile}" "${url}"`;

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