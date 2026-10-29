// ═══════════════════════════════════════════════
//  Escaneo AntiNSFW — caption + frame + APIs
// ═══════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { downloadMediaMessage, normalizeMessageContent } = require('@whiskeysockets/baileys');
const config = require('../config');

const silent = { level: 'silent', info() {}, warn() {}, error() {}, debug() {}, trace() {}, fatal() {}, child() { return silent; } };

const NSFW_RE = /\b(porn|porno|xxx|nsfw|onlyfans|nudes?|nude|sex\b|sexo|pussy|dick|cock|hentai|rule34|boobs|tits|ass\b|culo|tetas|pene|verga|coño|vagina|anal\b|oral\b|cum\b|semen|fap|masturb|desnud|encuer|gore.?porn|r34|nhentai|xnxx|xvideos|pornhub|spankbang|redtube)\b/i;

function captionOf(msg) {
  const c = normalizeMessageContent(msg) || msg || {};
  return String(
    c.imageMessage?.caption ||
    c.videoMessage?.caption ||
    c.documentMessage?.caption ||
    c.documentMessage?.fileName ||
    c.conversation ||
    c.extendedTextMessage?.text ||
    ''
  );
}

function mediaNode(msg) {
  const c = normalizeMessageContent(msg) || msg || {};
  return (
    c.imageMessage ||
    c.videoMessage ||
    c.stickerMessage ||
    c.documentMessage ||
    null
  );
}

function mediaKind(node) {
  if (!node) return null;
  if (node.mimetype) {
    const m = String(node.mimetype).toLowerCase();
    if (m.includes('video')) return 'video';
    if (m.includes('gif') || m.includes('webp')) return 'gif';
    if (m.includes('image')) return 'image';
    if (m.includes('sticker') || m.includes('webp')) return 'sticker';
  }
  return 'image';
}

async function downloadMsg(sock, m) {
  try {
    const node = mediaNode(m.message);
    if (!node) return null;
    const buffer = await downloadMediaMessage(m, 'buffer', {}, { logger: silent, reuploadRequest: sock.updateMediaMessage });
    if (!buffer || buffer.length < 200) return null;
    return { buffer, kind: mediaKind(node), mimetype: node.mimetype || '' };
  } catch (e) {
    console.error('nsfwscan dl:', e?.message || e);
    return null;
  }
}

async function toJpegFrame(buffer, kind) {
  const tmpIn = path.join(os.tmpdir(), 'nsfw_in_' + Date.now());
  const tmpOut = path.join(os.tmpdir(), 'nsfw_out_' + Date.now() + '.jpg');
  try {
    fs.writeFileSync(tmpIn, buffer);
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const exec = promisify(execFile);
    // Un frame al segundo 0.3
    await exec('ffmpeg', [
      '-y', '-i', tmpIn, '-ss', '0.3', '-vframes', '1',
      '-q:v', '4', '-vf', 'scale=512:-2', tmpOut,
    ], { timeout: 25000 });
    if (fs.existsSync(tmpOut)) return fs.readFileSync(tmpOut);
  } catch (e) {
    // Si no es video, probar jimp
    try {
      const Jimp = require('jimp');
      const img = await Jimp.read(buffer);
      img.resize(512, Jimp.AUTO);
      return await img.quality(80).getBufferAsync(Jimp.MIME_JPEG);
    } catch (e2) {
      console.error('nsfwscan frame:', e?.message || e, e2?.message || e2);
    }
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
  return null;
}

/** Heurística simple: mucha piel en tono carne (apoyo, no definitivo) */
async function skinScore(jpegBuf) {
  try {
    const Jimp = require('jimp');
    const img = await Jimp.read(jpegBuf);
    img.resize(64, 64);
    let skin = 0, total = 64 * 64;
    img.scan(0, 0, 64, 64, function (x, y, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      // tonos de piel aproximados
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15 && r - b > 15) skin++;
      // anime: rosa / piel clara
      if (r > 200 && g > 150 && b > 140 && r >= g && g >= b) skin++;
    });
    return skin / total;
  } catch {
    return 0;
  }
}

async function apiCheck(jpegBuf) {
  const key = (config.deepaiKey || process.env.DEEPAI_KEY || '').trim();
  // DeepAI nsfw-detector (opcional)
  if (key) {
    try {
      const FormData = global.FormData;
      const form = new FormData();
      form.append('image', new Blob([jpegBuf], { type: 'image/jpeg' }), 'frame.jpg');
      const { data } = await axios.post('https://api.deepai.org/api/nsfw-detector', form, {
        headers: { 'api-key': key },
        timeout: 20000,
      });
      const score = Number(data?.output?.nsfw_score ?? data?.output?.score ?? 0);
      if (score >= 0.55) return { nsfw: true, score, via: 'deepai' };
      if (score > 0) return { nsfw: false, score, via: 'deepai' };
    } catch (e) {
      console.error('deepai:', e?.message || e);
    }
  }
  return null;
}

/**
 * Devuelve true si el mensaje debe borrarse por NSFW.
 */
async function isNsfwMessage(sock, m) {
  const cap = captionOf(m.message);
  if (NSFW_RE.test(cap)) return { hit: true, reason: 'caption' };

  const node = mediaNode(m.message);
  if (!node) return { hit: false };

  // Solo media visual
  const kind = mediaKind(node);
  if (!kind) return { hit: false };

  const dl = await downloadMsg(sock, m);
  if (!dl) return { hit: false };

  let jpeg = null;
  if (kind === 'video' || kind === 'gif' || /video|gif|webp/i.test(dl.mimetype)) {
    jpeg = await toJpegFrame(dl.buffer, kind);
  } else {
    try {
      const Jimp = require('jimp');
      const img = await Jimp.read(dl.buffer);
      img.resize(512, Jimp.AUTO);
      jpeg = await img.quality(80).getBufferAsync(Jimp.MIME_JPEG);
    } catch {
      jpeg = await toJpegFrame(dl.buffer, kind);
    }
  }
  if (!jpeg) return { hit: false };

  // API si hay key
  const api = await apiCheck(jpeg);
  if (api && api.nsfw) return { hit: true, reason: 'api', score: api.score };

  // Heurística de piel (umbrales altos para no borrar fotos normales)
  const skin = await skinScore(jpeg);
  // GIF/video animado con mucha "piel" → sospechoso
  if ((kind === 'gif' || kind === 'video' || kind === 'sticker') && skin >= 0.42) {
    return { hit: true, reason: 'skin', score: skin };
  }
  if (kind === 'image' && skin >= 0.55) {
    return { hit: true, reason: 'skin', score: skin };
  }

  // Si API dijo score medio + skin medio
  if (api && api.score >= 0.35 && skin >= 0.30) {
    return { hit: true, reason: 'combo', score: api.score };
  }

  return { hit: false, skin, api };
}

module.exports = { isNsfwMessage, NSFW_RE, captionOf };
