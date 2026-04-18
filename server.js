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

const YTDLP_OPTS = `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --add-header "Accept-Language:en-US,en;q=0.9" --extractor-args "youtube:player_client=android" --no-check-certificates`;

app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));

app.post('/api/info', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  console.log('Intentando obtener:', url);

  exec(`yt-dlp --dump-json --no-playlist ${YTDLP_OPTS} "${url}"`, { timeout: 30000 }, (error, stdout, stderr) => {
    if (error) {
      console.error('ERROR yt-dlp:', stderr);
      return res.status(500).json({ error: 'No se pudo obtener el vídeo.' });
    }
    try {
      const info = JSON.parse(stdout);
      console.log('OK:', info.title);
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
      console.error('ERROR parse:', e.message);
      res.status(500).json({ error: 'Error procesando la respuesta' });
    }
  });
});

app.get('/api/download', (req, res) => {
  const { url, quality } = req.query;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  const height = (quality || '720p').replace('p', '');
  const tmpFile = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);
  const cmd = `yt-dlp -f "bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best" --merge-output-format mp4 ${YTDLP_OPTS} -o "${tmpFile}" "${url}"`;

  console.log('Descargando:', url, 'calidad:', quality);

  exec(cmd, { timeout: 300000 }, (error, stdout, stderr) => {
    if (error || !fs.existsSync(tmpFile)) {
      console.error('ERROR descarga:', stderr);
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