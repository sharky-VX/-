const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const U = require('./utils');

const TMP = path.join(process.cwd(), 'tmp');
fs.mkdirSync(TMP, { recursive: true });

// Ejecuta yt-dlp SIN shell (execFile + array de argumentos = sin inyección)
const run = (args, timeout = 300000) =>
  new Promise((resolve, reject) => {
    const ffloc = require('./ffbin').resolve(); // si ffmpeg viene de un paquete npm, yt-dlp necesita saber dónde está
    const full = ffloc && ffloc !== 'ffmpeg' ? ['--ffmpeg-location', ffloc, ...args] : args;
    execFile(config.ytdlp, full, { timeout, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        if (err.code === 'ENOENT') return reject(new Error('yt-dlp no está instalado (pip install -U yt-dlp)'));
        const line = (stderr || '').split('\n').filter((l) => /ERROR/.test(l)).pop() || err.message;
        return reject(new Error(line.slice(0, 200)));
      }
      resolve(stdout);
    });
  });

const valid = (u) => /^(yt|sc)search\d*:/i.test(u || '') || U.isPublicUrl(u);

async function search(q, n = 1, prefix = 'ytsearch') {
  const out = await run(
    [`${prefix}${n}:${q}`, '--dump-json', '--flat-playlist', '--skip-download', '--no-warnings'],
    60000
  );
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .map((v) => ({
      id: v.id,
      title: v.title,
      url: v.webpage_url || v.url || `https://www.youtube.com/watch?v=${v.id}`,
      duration: v.duration,
      channel: v.channel || v.uploader,
      views: v.view_count,
      thumb: (v.id && prefix === 'ytsearch') ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : (v.thumbnails && v.thumbnails.length ? v.thumbnails[v.thumbnails.length - 1].url : null),
    }));
}

async function info(url) {
  if (!valid(url)) throw new Error('URL inválida');
  const out = await run([url, '--dump-single-json', '--no-playlist', '--skip-download', '--no-warnings'], 60000);
  const v = JSON.parse(out);
  return {
    id: v.id,
    title: v.title,
    duration: v.duration,
    channel: v.channel || v.uploader,
    views: v.view_count,
    thumb: v.thumbnail,
    url: v.webpage_url || url,
  };
}

async function download(url, { audio = false, height = 720, maxMB = config.maxFileMB, maxDuration = config.maxDurationSec } = {}) {
  if (!valid(url)) throw new Error('URL inválida');
  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const args = [
    url,
    '--no-playlist',
    '--no-warnings',
    '-N', '4',
    '--no-mtime',
    '-o', path.join(TMP, id + '.%(ext)s'),
    '--max-filesize', maxMB + 'M',
    '--match-filter', `duration<=?${maxDuration}`,
  ];
  if (audio) {
    args.push('-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '5');
  } else {
    args.push(
      '-f',
      `bv*[height<=${height}][vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4][height<=${height}]/bv*[height<=${height}]+ba/b`,
      '--merge-output-format', 'mp4'
    );
  }
  await run(args, 600000);
  const f = fs.readdirSync(TMP).find((x) => x.startsWith(id));
  if (!f) throw new Error('No se pudo descargar (muy largo, muy pesado o no disponible)');
  const file = path.join(TMP, f);
  const size = fs.statSync(file).size;
  const cleanup = () => fs.unlink(file, () => {});
  if (size > maxMB * 1024 * 1024) {
    cleanup();
    throw new Error(`El archivo pesa más de ${maxMB} MB`);
  }
  return { file, size, cleanup };
}

module.exports = { search, info, download, valid };
