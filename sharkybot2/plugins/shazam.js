// ═══════════════════════════════════════════════
//  SHAZAM — portada (banner) + info + audio (via play/yt)
// ═══════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const config = require('../config');
const U = require('../lib/utils');
const { wrap, sans, C } = require('../lib/deco');

const mk = (name, desc, usage, run, aliases = [], extra = {}) => ({
  name, aliases, desc, usage, category: 'downloads', run, ...extra,
});

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

function coverFromResult(result) {
  try {
    const art = result.apple_music?.artwork;
    if (art?.url) return String(art.url).replace('{w}', '800').replace('{h}', '800');
  } catch {}
  try {
    if (result.spotify?.album?.images?.[0]?.url) return result.spotify.album.images[0].url;
  } catch {}
  return '';
}

/** Misma pipeline que .play: busca en YouTube y descarga audio + thumb */
async function playPipeline(title, artist) {
  const yt = require('../lib/ytdlp');
  const q = [title, artist].filter(Boolean).join(' ');
  const queries = [q + ' official audio', q + ' audio', q];
  for (const query of queries) {
    let hits = [];
    try { hits = await yt.search(query, 5); } catch (e) {
      console.error('shazam play search:', e?.message || e);
      continue;
    }
    for (const h of hits || []) {
      try {
        let thumbBuf = null;
        if (h.thumb) {
          try { thumbBuf = await U.getBuffer(h.thumb, { timeout: 15000 }); } catch {}
        }
        const got = await yt.download(h.url, { audio: true });
        if (!got?.file) continue;
        const audioBuf = fs.readFileSync(got.file);
        try { got.cleanup && got.cleanup(); } catch {}
        if (audioBuf.length < 5000) continue;
        return { audioBuf, thumbBuf, ytTitle: h.title || title, ytUrl: h.url };
      } catch (e) {
        console.error('shazam play dl:', e?.message || e);
      }
    }
  }
  return null;
}

module.exports = [
  mk('shazam', 'Reconoce musica (responde a audio/video) + portada + audio completo', '', async (c) => {
    const buf = await extractAudioBuffer(c);
    if (!buf) {
      return c.reply(wrap('Responde a un audio o video con:\n' + c.prefix + 'shazam', 'shazam'));
    }
    await c.react('🔎');
    let result;
    try {
      result = await recognize(buf);
    } catch (e) {
      console.error('shazam:', e?.message || e);
      return c.reply(wrap('No pude reconocer la musica. Audio mas claro o config.auddKey (audd.io).', 'shazam'));
    }

    const title = result.title || 'Desconocida';
    const artist = result.artist || '';
    const album = result.album || result.spotify?.album?.name || '';
    const release = result.release_date || '';

    await c.react('⏳');
    // Conectado a la misma API de .play (yt-dlp search + download)
    const play = await playPipeline(title, artist);

    // Banner = imagen de la musica
    let coverBuf = play?.thumbBuf || null;
    if (!coverBuf) {
      const cu = coverFromResult(result);
      if (cu) {
        try { coverBuf = await U.getBuffer(cu, { timeout: 20000 }); } catch {}
      }
    }

    const cap = [
      C.ftop + ' ' + sans('shazam') + ' 𓆪 ❀',
      '',
      '  ' + C.bul + ' ' + sans('Titulo') + '  ── ' + title,
      artist ? ('  ' + C.bul + ' ' + sans('Artista') + ' ── ' + artist) : '',
      album ? ('  ' + C.bul + ' ' + sans('Album') + '   ── ' + album) : '',
      release ? ('  ' + C.bul + ' ' + sans('Fecha') + '   ── ' + release) : '',
      play?.ytTitle ? ('  ' + C.bul + ' ' + sans('Fuente') + '  ── play') : '',
      '',
      C.fbot,
    ].filter((x) => x !== '').join('\n');

    if (coverBuf) {
      await c.sock.sendMessage(c.from, { image: coverBuf, caption: cap }, { quoted: c.m });
    } else {
      await c.reply(cap);
    }

    if (play?.audioBuf) {
      await c.sock.sendMessage(c.from, {
        audio: play.audioBuf,
        mimetype: 'audio/mpeg',
        fileName: (title + (artist ? ' - ' + artist : '') + '.mp3').replace(/[^\w\s\.\-]/gi, '').slice(0, 90),
      }, { quoted: c.m }).catch(async () => {
        await c.sock.sendMessage(c.from, {
          document: play.audioBuf,
          mimetype: 'audio/mpeg',
          fileName: 'cancion.mp3',
          caption: wrap(title + (artist ? ' — ' + artist : ''), 'shazam'),
        }, { quoted: c.m });
      });
      await c.react('✅');
    } else {
      await c.reply(wrap('Reconocida: ' + title + (artist ? ' — ' + artist : '') + '\nNo pude bajar el audio. Prueba: ' + c.prefix + 'play ' + title, 'shazam'));
      await c.react('✅');
    }
  }, ['queescancion', 'reconocermusica', 'whatmusic', 'songfind']),
];
