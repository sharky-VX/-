const media = require('../lib/media');
const U = require('../lib/utils');

const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'media', run });

// Pide un archivo (imagen, video...) en el mensaje o en el mensaje respondido
const need = async (c, kinds, hint) => {
  const f = await c.getMedia(kinds);
  if (!f) await c.reply(`📎 ${hint}`);
  return f;
};

const list = [
  mk('sticker', 'Convierte imagen/video corto en sticker', '<imagen o video>', async (c) => {
    const f = await need(c, ['image', 'video', 'sticker'], `Envía o responde a una imagen/video con ${c.prefix}sticker`);
    if (!f) return;
    if (f.type === 'video' && f.seconds > 12) return c.reply('⏱️ El video debe durar máximo 10 segundos.');
    await c.react('⏳');
    await c.sendSticker(await media.toSticker(f.buffer, f.type === 'video' || f.animated));
    await c.react('✅');
  }, ['s', 'stiker']),

  mk('toimg', 'Sticker → imagen', '<sticker>', async (c) => {
    const f = await need(c, ['sticker'], 'Responde a un sticker.');
    if (!f) return;
    await c.sendImage(await media.toImage(f.buffer), '🖼️');
  }, ['toimage', 'stickerimg']),

  mk('tomp3', 'Video/nota de voz → audio MP3', '<video o audio>', async (c) => {
    const f = await need(c, ['video', 'audio'], 'Responde a un video o audio.');
    if (!f) return;
    await c.react('⏳');
    await c.sendAudio(await media.toMp3(f.buffer));
    await c.react('✅');
  }, ['mp3', 'toaudio']),

  mk('tovoice', 'Audio → nota de voz', '<audio>', async (c) => {
    const f = await need(c, ['audio', 'video'], 'Responde a un audio.');
    if (!f) return;
    await c.sendAudio(await media.toVoice(f.buffer), true);
  }, ['nota', 'tovn']),

  mk('togif', 'Video/sticker animado → GIF', '<video>', async (c) => {
    const f = await need(c, ['video', 'sticker'], 'Responde a un video o sticker animado.');
    if (!f) return;
    await c.react('⏳');
    const mp4 = f.type === 'sticker' ? await media.toMp4(f.buffer, 'webp') : await media.toMp4(f.buffer);
    await c.sendGif(mp4);
  }, ['gif']),

  mk('tomp4', 'Sticker animado/GIF → video MP4', '<sticker o gif>', async (c) => {
    const f = await need(c, ['video', 'sticker'], 'Responde a un sticker animado o gif.');
    if (!f) return;
    await c.sendVideo(f.type === 'sticker' ? await media.toMp4(f.buffer, 'webp') : await media.toMp4(f.buffer), '🎬');
  }, ['tovideo']),

  mk('getpp', 'Foto de perfil de alguien', '[@usuario]', async (c) => {
    const jid = c.mentioned[0] || c.quoted?.sender || c.sender;
    let url;
    try { url = await c.sock.profilePictureUrl(jid, 'image'); } catch {}
    if (!url) return c.reply('❌ No tiene foto de perfil o es privada.');
    await c.sendImage(url, '🖼️ Foto de perfil');
  }, ['pp']),
];

// ── Efectos de audio (ffmpeg) ──
const AUDIO_FX = {
  bass: ['Graves potentes', 'bass=g=18,volume=1.5'],
  nightcore: ['Más rápido y agudo', 'asetrate=44100*1.25,aresample=44100'],
  slow: ['Lento y grave', 'asetrate=44100*0.8,aresample=44100'],
  fast: ['Más rápido', 'atempo=1.5'],
  reverseaudio: ['Al revés', 'areverse'],
  echo: ['Eco', 'aecho=0.8:0.9:1000:0.3'],
  robot: ['Voz de robot', 'afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75'],
  deep: ['Voz grave', 'asetrate=44100*0.7,aresample=44100,atempo=1.2'],
  chipmunk: ['Voz de ardilla', 'asetrate=44100*1.6,aresample=44100'],
  loud: ['Sube el volumen', 'volume=2.5'],
  vaporaudio: ['Vaporwave', 'asetrate=44100*0.8,aresample=44100,aecho=0.8:0.88:60:0.4'],
  telephone: ['Efecto teléfono', 'highpass=f=300,lowpass=f=3400'],
  underwater: ['Bajo el agua', 'lowpass=f=600'],
  tremolo: ['Tremolo', 'tremolo=f=6:d=0.7'],
  vibrato: ['Vibrato', 'vibrato=f=8:d=0.6'],
  pulse8d: ['Audio 8D', 'apulsator=hz=0.125'],
};
for (const [name, [desc, filter]] of Object.entries(AUDIO_FX)) {
  list.push(mk(name, `Audio: ${desc}`, '<audio>', async (c) => {
    const f = await need(c, ['audio', 'video'], 'Responde a un audio o nota de voz.');
    if (!f) return;
    await c.react('⏳');
    await c.sendAudio(await media.audioFx(f.buffer, filter));
    await c.react('✅');
  }));
}

// ── Efectos de video (ffmpeg) ──
const VIDEO_FX = {
  videoreverse: ['Video al revés', 'reverse', 'areverse'],
  videoslow: ['Cámara lenta', 'setpts=2.0*PTS', null],
  videofast: ['Video acelerado', 'setpts=0.5*PTS', null],
  videogray: ['Blanco y negro', 'hue=s=0', 'anull'],
  videomirror: ['Espejo horizontal', 'hflip', 'anull'],
  videoflip: ['Voltea verticalmente', 'vflip', 'anull'],
  videomute: ['Quita el audio', 'null', null],
};
for (const [name, [desc, vf, af]] of Object.entries(VIDEO_FX)) {
  list.push(mk(name, `Video: ${desc}`, '<video>', async (c) => {
    const f = await need(c, ['video'], 'Responde a un video (máx. 30 s).');
    if (!f) return;
    if (f.seconds > 40) return c.reply('⏱️ El video debe durar máximo 40 segundos.');
    await c.react('⏳');
    let out;
    try { out = await media.videoFx(f.buffer, vf, af); }
    catch { out = await media.videoFx(f.buffer, vf, null); } // videos sin pista de audio
    await c.sendVideo(out, '✅');
  }));
}

// ── Efectos de imagen (Jimp) ──
const num = (c, d, a, b) => U.clamp(parseFloat(c.args[0]) || d, a, b);
const IMG_FX = {
  blur: ['Desenfocar', (i, c) => i.blur(num(c, 6, 1, 30))],
  gris: ['Blanco y negro', (i) => i.greyscale()],
  negativo: ['Colores invertidos', (i) => i.invert()],
  sepia: ['Tono sepia', (i) => i.sepia()],
  pixelar: ['Pixelar', (i, c) => i.pixelate(num(c, 12, 2, 80))],
  espejo: ['Espejo horizontal', (i) => i.flip(true, false)],
  voltear: ['Voltea verticalmente', (i) => i.flip(false, true)],
  rotar: ['Rota N grados', (i, c) => i.rotate(num(c, 90, -360, 360))],
  rotar180: ['Gira 180°', (i) => i.rotate(180)],
  brillo: ['Más brillo', (i, c) => i.brightness(num(c, 0.3, 0, 1))],
  oscurecer: ['Más oscuro', (i, c) => i.brightness(-num(c, 0.3, 0, 1))],
  contraste: ['Más contraste', (i, c) => i.contrast(num(c, 0.4, 0, 1))],
  bajocontraste: ['Menos contraste', (i, c) => i.contrast(-num(c, 0.4, 0, 1))],
  posterizar: ['Pocos colores', (i, c) => i.posterize(num(c, 4, 2, 20))],
  dither: ['Efecto retro 565', (i) => i.dither565()],
  normalizar: ['Normaliza colores', (i) => i.normalize()],
  nitidez: ['Más nitidez', (i) => i.convolute([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])],
  relieve: ['Efecto relieve', (i) => i.convolute([[-2, -1, 0], [-1, 1, 1], [0, 1, 2]])],
  bordes: ['Detecta bordes', (i) => i.greyscale().convolute([[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]])],
  calido: ['Tono cálido', (i) => i.color([{ apply: 'red', params: [35] }, { apply: 'blue', params: [-25] }])],
  frio: ['Tono frío', (i) => i.color([{ apply: 'blue', params: [35] }, { apply: 'red', params: [-25] }])],
  verde: ['Tono verde', (i) => i.color([{ apply: 'green', params: [40] }])],
  vintage: ['Aspecto vintage', (i) => i.sepia().contrast(-0.15).brightness(-0.05)],
  recortecuadrado: ['Recorta en cuadrado', (i, c, J) => i.cover(Math.min(i.bitmap.width, i.bitmap.height), Math.min(i.bitmap.width, i.bitmap.height))],
  thumb256: ['Miniatura 256px', (i) => i.cover(256, 256)],
  transparente: ['Semitransparente (PNG)', (i) => i.opacity(0.5), 'image/png'],
  circulo: ['Recorte circular (PNG)', (i) => i.cover(Math.min(i.bitmap.width, i.bitmap.height), Math.min(i.bitmap.width, i.bitmap.height)).circle(), 'image/png'],
};
for (const [name, [desc, fn, mime]] of Object.entries(IMG_FX)) {
  list.push(mk(name, `Imagen: ${desc}`, '<imagen> [valor]', async (c) => {
    const f = await need(c, ['image', 'sticker'], `Envía o responde a una imagen con ${c.prefix}${name}`);
    if (!f) return;
    await c.react('⏳');
    const out = await media.imageFx(f.buffer, (img, J) => fn(img, c, J), mime || 'image/jpeg');
    await c.sendImage(out, `✅ ${desc}`);
    await c.react('✅');
  }));
}

module.exports = list;
