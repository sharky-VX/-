// ═══════════════════════════════════════════════
//  SHAZAM → misma API que .play (yt-dlp)
//  Portada + info decorada + audio completo
// ═══════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const config = require('../config');
const U = require('../lib/utils');
const yt = require('../lib/ytdlp');
const { card, wrap, sans, C } = require('../lib/deco');

const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({
  name, aliases, desc, usage, category: 'downloads', run, ...extra,
});

const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

async function extractAudioBuffer(ctx) {
  const media = await ctx.getMedia(['audio', 'video', 'document', 'ptt']);
  if (!media || !media.buffer) return null;
  let buf = media.buffer;
  const mime = (media.mimetype || '').toLowerCase();
  if (mime.includes('video') || mime.includes('mp4') || mime.includes('mkv') || mime.includes('webm')) {
    const tmpIn = path.join(os.tmpdir(), 'shz_in_' + Date.now() + '.mp4');
    const tmpOut = path.join(os.tmpdir(), 'shz_out_' + Date.now() + '.mp3');
    try {
      fs.writeFileSync(tmpIn, buf);
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      await promisify(execFile)('ffmpeg', ['-y', '-i', tmpIn, '-t', '25', '-vn', '-acodec', 'libmp3lame', '-q:a', '4', tmpOut], { timeout: 90000 });
      buf = fs.readFileSync(tmpOut);
    } catch (e) {
      console.error('ffmpeg shazam:', e?.message || e);
    } finally {
      try { fs.unlinkSync(tmpIn); } catch {}
      try { fs.unlinkSync(tmpOut); } catch {}
    }
  }
  if (buf.length > 2.5 * 1024 * 1024) buf = buf.slice(0, 2.5 * 1024 * 1024);
  return buf;
}

async function recognize(buf) {
  const token = (config.auddKey || process.env.AUDD_API_TOKEN || '').trim();
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'audio/mpeg' }), 'sample.mp3');
  form.append('return', 'apple_music,spotify');
  if (token) form.append('api_token', token);
  const { data } = await axios.post('https://api.audd.io/', form, { timeout: 45000, maxContentLength: 15 * 1024 * 1024 });
  if (!data || data.status !== 'success' || !data.result) {
    throw new Error(data?.error?.error_message || data?.status || 'sin resultado');
  }
  return data.result;
}

function externalCover(result) {
  try {
    const art = result.apple_music?.artwork;
    if (art?.url) return String(art.url).replace('{w}', '800').replace('{h}', '800');
  } catch {}
  try {
    if (result.spotify?.album?.images?.[0]?.url) return result.spotify.album.images[0].url;
  } catch {}
  return '';
}

module.exports = [
  mk('shazam', 'Reconoce musica + portada + audio completo (API de play)', '', async (c) => {
    const sample = await extractAudioBuffer(c);
    if (!sample) {
      return c.reply(wrap('Responde a un audio o video con:\n' + c.prefix + 'shazam', 'shazam'));
    }

    await c.react('🔎');
    let result;
    try {
      result = await recognize(sample);
    } catch (e) {
      console.error('shazam recognize:', e?.message || e);
      return c.reply(wrap('No pude reconocer la musica. Prueba un audio mas claro o pon auddKey en config.', 'shazam'));
    }

    const title = result.title || 'Desconocida';
    const artist = result.artist || '';
    const album = result.album || result.spotify?.album?.name || '';
    const release = result.release_date || '';
    const query = [title, artist].filter(Boolean).join(' ');

    await c.react('⏳');

    // ═══ Misma API que .play ═══
    let hits = [];
    try {
      hits = await yt.search(query + ' audio', 5);
    } catch (e) {
      console.error('shazam yt.search:', e?.message || e);
    }
    if (!hits.length) {
      try { hits = await yt.search(query, 5); } catch {}
    }
    if (!hits.length) {
      return c.reply(wrap('Reconocida: ' + title + (artist ? ' — ' + artist : '') + '\nNo encontre la pista en play. Prueba: ' + c.prefix + 'play ' + query, 'shazam'));
    }

    const yv = hits[0];
    let d;
    try {
      d = await yt.download(yv.url, { audio: true });
    } catch (e) {
      console.error('shazam yt.download:', e?.message || e);
      return c.reply(wrap('Reconocida: ' + title + '\nPlay no pudo descargar el audio. Prueba: ' + c.prefix + 'play ' + query, 'shazam'));
    }

    try {
      // Portada: thumb de YouTube (play) o Apple/Spotify
      let cover = null;
      if (yv.thumb) {
        try { cover = await U.getBuffer(yv.thumb, { timeout: 15000 }); } catch {}
      }
      if (!cover) {
        const cu = externalCover(result);
        if (cu) {
          try { cover = await U.getBuffer(cu, { timeout: 15000 }); } catch {}
        }
      }

      const cap = [
        C.ftop + ' ' + sans('shazam') + ' 𓆪 ❀',
        '',
        '  ' + C.bul + ' ' + sans('Titulo') + '  ── ' + title,
        artist ? ('  ' + C.bul + ' ' + sans('Artista') + ' ── ' + artist) : '',
        album ? ('  ' + C.bul + ' ' + sans('Album') + '   ── ' + album) : '',
        release ? ('  ' + C.bul + ' ' + sans('Fecha') + '   ── ' + release) : '',
        yv.duration ? ('  ' + C.bul + ' ' + sans('Duracion') + '── ' + dur(yv.duration)) : '',
        '  ' + C.bul + ' ' + sans('Fuente') + '  ── play',
        '',
        C.fbot,
      ].filter((x) => x !== '').join('\n');

      // 1) Banner = imagen de la musica + info
      if (cover) {
        await c.sock.sendMessage(c.from, { image: cover, caption: cap }, { quoted: c.m });
      } else {
        await c.reply(cap);
      }

      // 2) Audio completo (igual que .play)
      const audioBuf = fs.readFileSync(d.file);
      await c.sock.sendMessage(c.from, {
        audio: audioBuf,
        mimetype: 'audio/mpeg',
        fileName: (title + (artist ? ' - ' + artist : '') + '.mp3').replace(/[^\w\s\.\-]/gi, '').slice(0, 90),
      }, { quoted: c.m }).catch(async () => {
        await c.sock.sendMessage(c.from, {
          document: audioBuf,
          mimetype: 'audio/mpeg',
          fileName: 'cancion.mp3',
          caption: wrap(title + (artist ? ' — ' + artist : ''), 'shazam'),
        }, { quoted: c.m });
      });

      await c.react('✅');
    } finally {
      try { d.cleanup && d.cleanup(); } catch {}
    }
  }, ['queescancion', 'reconocermusica', 'whatmusic', 'songfind']),
];
