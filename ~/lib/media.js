const { downloadMediaMessage, normalizeMessageContent } = require('@whiskeysockets/baileys');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const TMP = path.join(process.cwd(), 'tmp');
fs.mkdirSync(TMP, { recursive: true });

const silent = { level: 'silent', info() {}, warn() {}, error() {}, debug() {}, trace() {}, fatal() {}, child() { return silent; } };
const KINDS = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', stickerMessage: 'sticker', documentMessage: 'document' };

function detect(message) {
  const c = normalizeMessageContent(message) || {};
  for (const [k, t] of Object.entries(KINDS)) if (c[k]) return { type: t, content: c[k] };
  return null;
}

// Busca el archivo en el mensaje respondido primero y luego en el mensaje actual
async function getMedia(sock, m, quoted, kinds = ['image', 'video', 'audio', 'sticker']) {
  const cands = [];
  if (quoted?.message) cands.push({ key: { remoteJid: m.key.remoteJid, id: quoted.id, participant: quoted.sender }, message: quoted.message });
  cands.push(m);
  for (const c of cands) {
    const d = detect(c.message);
    if (d && kinds.includes(d.type)) {
      const buffer = await downloadMediaMessage(c, 'buffer', {}, { logger: silent, reuploadRequest: sock.updateMediaMessage });
      return {
        type: d.type,
        buffer,
        mimetype: d.content.mimetype || '',
        seconds: d.content.seconds || 0,
        animated: !!(d.content.isAnimated || d.content.gifPlayback),
      };
    }
  }
  return null;
}

// ── ffmpeg ──
const uid = () => Date.now() + '_' + Math.random().toString(36).slice(2, 7);

function ff(args, timeout = 180000) {
  return new Promise((resolve, reject) => {
    const bin = require('./ffbin').resolve();
    if (!bin) return reject(new Error('ffmpeg no está instalado (Termux: pkg install ffmpeg · panel: npm install @ffmpeg-installer/ffmpeg)'));
    execFile(bin, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { timeout }, (err, _o, se) => {
      if (!err) return resolve();
      if (err.code === 'ENOENT') return reject(new Error('ffmpeg no está instalado (pkg install ffmpeg)'));
      reject(new Error(String(se || err.message).trim().split('\n').slice(-2).join(' ').slice(0, 200)));
    });
  });
}

async function runFf(buffer, outExt, makeArgs, inExt = 'bin', timeout = 180000) {
  const id = uid();
  const inp = path.join(TMP, `${id}_in.${inExt}`);
  const out = path.join(TMP, `${id}_out.${outExt}`);
  fs.writeFileSync(inp, buffer);
  try {
    await ff(makeArgs(inp, out), timeout);
    return fs.readFileSync(out);
  } finally {
    fs.unlink(inp, () => {});
    fs.unlink(out, () => {});
  }
}

const PAD = 'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0';

const toSticker = (buffer, isVideo) =>
  runFf(buffer, 'webp', (i, o) =>
    isVideo
      ? ['-i', i, '-t', '8', '-vf', `fps=15,scale=512:512:force_original_aspect_ratio=decrease,format=rgba,${PAD}`, '-c:v', 'libwebp', '-q:v', '45', '-loop', '0', '-an', o]
      : ['-i', i, '-vf', `scale=512:512:force_original_aspect_ratio=decrease,format=rgba,${PAD}`, '-c:v', 'libwebp', '-q:v', '70', '-an', o]
  );

const toImage = (buffer) => runFf(buffer, 'png', (i, o) => ['-i', i, '-frames:v', '1', o], 'webp');
const toMp3 = (buffer) => runFf(buffer, 'mp3', (i, o) => ['-i', i, '-vn', '-ar', '44100', '-ac', '2', '-b:a', '128k', o]);
const toVoice = (buffer) => runFf(buffer, 'ogg', (i, o) => ['-i', i, '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', o]);
const toMp4 = (buffer, inExt = 'bin') =>
  runFf(buffer, 'mp4', (i, o) => ['-i', i, '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast', '-an', o], inExt);
// GIF → mp4 en alta calidad: sube la resolución (lanczos + nitidez) hasta 'height' px de alto y casi sin pérdida
const toMp4HD = (buffer, height = 1080, inExt = 'gif') =>
  runFf(buffer, 'mp4', (i, o) => [
    '-i', i, '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
    '-vf', `scale=-2:'trunc(max(ih,${height})/2)*2':flags=lanczos,unsharp=5:5:0.7:5:5:0.0`,
    '-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', '-an', o,
  ], inExt);
const audioFx = (buffer, filter) => runFf(buffer, 'mp3', (i, o) => ['-i', i, '-vn', '-af', filter, '-b:a', '128k', o]);
const videoFx = (buffer, vf, af) =>
  runFf(buffer, 'mp4', (i, o) => [
    '-i', i, '-vf', vf + ',scale=trunc(iw/2)*2:trunc(ih/2)*2', ...(af ? ['-af', af] : ['-an']),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', o,
  ]);

// ── Imágenes con Jimp (JavaScript puro, funciona en Termux) ──
async function imageFx(buffer, fn, mime = 'image/jpeg') {
  let Jimp;
  try { Jimp = require('jimp'); } catch { throw new Error('Falta jimp. Ejecuta: npm install'); }
  const img = await Jimp.read(buffer);
  if (img.bitmap.width > 1280) img.resize(1280, Jimp.AUTO);
  await fn(img, Jimp);
  return img.getBufferAsync(mime);
}

module.exports = { getMedia, detect, ff, runFf, toSticker, toImage, toMp3, toVoice, toMp4, toMp4HD, audioFx, videoFx, imageFx };
