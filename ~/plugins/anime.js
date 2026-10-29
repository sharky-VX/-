const U = require('../lib/utils');
const media = require('../lib/media');
const db = require('../lib/db');
const config = require('../config');

const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'anime', run });
const tag = (j) => '@' + j.split('@')[0].split(':')[0];

// ── Reacciones animadas (nekos.best, gratis y sin key) ──
// [categoría, texto con otra persona, texto solo, alias]
const ACTIONS = [
  ['hug', 'abraza a', 'se abraza a sí mismo/a', ['abrazar']], ['kiss', 'besa a', 'manda un beso', ['besar']],
  ['pat', 'acaricia a', 'pide cariño', ['acariciar']], ['slap', 'abofetea a', 'se da una cachetada', ['bofetada']],
  ['bite', 'muerde a', 'muerde el aire', ['morder']], ['cuddle', 'se acurruca con', 'quiere acurrucarse', []],
  ['poke', 'molesta a', 'toca por tocar', []], ['punch', 'golpea a', 'golpea el aire', ['golpear']],
  ['kick', 'patea a', 'patea una piedra', []], ['tickle', 'hace cosquillas a', 'se ríe de cosquillas', ['cosquillas']],
  ['wave', 'saluda a', 'saluda', ['saludar']], ['highfive', 'choca los cinco con', 'choca los cinco al aire', []],
  ['handhold', 'toma de la mano a', 'extiende la mano', []], ['handshake', 'estrecha la mano de', 'estrecha una mano', []],
  ['feed', 'da de comer a', 'come algo rico', ['alimentar']], ['peck', 'da un piquito a', 'manda un piquito', []],
  ['cry', 'llora por', 'llora', ['llorar']], ['dance', 'baila con', 'baila', ['bailar']],
  ['laugh', 'se ríe de', 'se ríe', ['reir']], ['smile', 'le sonríe a', 'sonríe', ['sonreir']],
  ['blush', 'se sonroja por', 'se sonroja', ['sonrojar']], ['happy', 'está feliz con', 'está feliz', []],
  ['sleep', 'duerme con', 'duerme', ['dormir']], ['yawn', 'bosteza por', 'bosteza', []],
  ['shrug', 'se encoge de hombros con', 'se encoge de hombros', []], ['think', 'piensa en', 'piensa', []],
  ['nod', 'asiente a', 'asiente', []], ['nope', 'le dice que no a', 'dice que no', []],
  ['pout', 'hace pucheros a', 'hace pucheros', []], ['run', 'corre de', 'corre', ['correr']],
  ['smug', 'presume ante', 'presume', []], ['stare', 'mira fijamente a', 'mira fijamente', []],
  ['bored', 'se aburre con', 'se aburre', []], ['angry', 'se enoja con', 'se enoja', ['enojar']],
  ['facepalm', 'se da un facepalm por', 'se da un facepalm', []], ['baka', 'le dice baka a', 'dice baka', []],
  ['lurk', 'espía a', 'espía', []], ['spin', 'da vueltas con', 'da vueltas', []],
  ['thumbsup', 'le da un pulgar arriba a', 'da un pulgar arriba', []], ['wink', 'le guiña el ojo a', 'guiña el ojo', []],
  ['yeet', 'lanza lejos a', 'lanza algo', []], ['nom', 'se come a', 'come ñam ñam', []],
];

// Envía un GIF de verdad (WhatsApp solo reproduce mp4, así que se convierte con ffmpeg).
// Nunca manda el enlace: si falta ffmpeg lo dice claro y deja el texto.
async function sendAnimated(c, url, text, mentions) {
  const { sock, from, m } = c;
  const buf = await U.getBuffer(url, { timeout: 30000 });
  const height = Number(db.data.gifHeight || config.gifHeight || 1080);
  let mp4 = null, why = '';
  try { mp4 = await media.toMp4HD(buf, height, 'gif'); }
  catch (e) {
    why = String(e?.message || e);
    console.error('Anime GIF (HD):', why);
    if (!/ffmpeg no est/i.test(why)) {
      try { mp4 = await media.toMp4(buf, 'gif'); } catch (e2) { why = String(e2?.message || e2); console.error('Anime GIF:', why); }
    }
  }
  if (mp4) return sock.sendMessage(from, { video: mp4, caption: text, gifPlayback: true, mimetype: 'video/mp4', mentions }, { quoted: m });
  // Sin ffmpeg no se puede hacer un mp4: último recurso, el GIF tal cual como imagen (nunca el enlace)
  const noFf = /ffmpeg no est/i.test(why);
  try {
    return await sock.sendMessage(from, { image: buf, mimetype: 'image/gif', caption: noFf ? `${text}\n\n(Para que se mueva falta ffmpeg: ${process.env.PREFIX ? 'pkg install -y ffmpeg' : 'npm install @ffmpeg-installer/ffmpeg'} y reinicia el bot)` : text, mentions }, { quoted: m });
  } catch {
    return sock.sendMessage(from, { text: `${text}\n\n${noFf ? 'Falta ffmpeg para el GIF.' : `No pude animar el GIF: ${why.slice(0, 120)}`}`, mentions }, { quoted: m });
  }
}

async function react(c, cat, withTarget, solo) {
  const d = await U.getJson(`https://nekos.best/api/v2/${cat}`);
  const r = d.results?.[0];
  if (!r?.url) throw new Error('La API de anime no respondió. Intenta de nuevo.');
  const t = c.mentioned[0] || c.quoted?.sender;
  const text = t ? `*${c.pushName}* ${withTarget} ${tag(t)}` : `*${c.pushName}* ${solo}`;
  const mentions = t ? [t] : [];
  if (/\.gif(\?|$)/i.test(r.url)) return sendAnimated(c, r.url, text, mentions);
  return c.sock.sendMessage(c.from, { image: await U.getBuffer(r.url), caption: text, mentions }, { quoted: c.m });
}

// 'kick' ya existe en grupos (expulsar), así que la reacción se llama 'patada'
const list = ACTIONS.map(([cat, withT, solo, aliases]) =>
  mk(cat === 'kick' ? 'patada' : cat, `Reacción anime: ${cat}`, '[@usuario]', (c) => react(c, cat, withT, solo), aliases)
);

// ── Imágenes de anime ──
const IMAGES = [
  ['waifu', 'nekos.best', 'waifu'], ['neko', 'nekos.best', 'neko'], ['husbando', 'nekos.best', 'husbando'], ['kitsune', 'nekos.best', 'kitsune'],
  ['shinobu', 'waifu.pics', 'shinobu'], ['megumin', 'waifu.pics', 'megumin'], ['awoo', 'waifu.pics', 'awoo'],
  ['waifu2', 'waifu.pics', 'waifu'], ['neko2', 'waifu.pics', 'neko'],
];
for (const [name, api, cat] of IMAGES) {
  list.push(mk(name, `Imagen anime: ${name}`, '', async (c) => {
    const d = await U.getJson(api === 'nekos.best' ? `https://nekos.best/api/v2/${cat}` : `https://api.waifu.pics/sfw/${cat}`);
    const url = api === 'nekos.best' ? d.results?.[0]?.url : d.url;
    if (!url) throw new Error('La API de anime no respondió.');
    if (/\.gif(\?|$)/i.test(url)) return sendAnimated(c, url, `🌸 ${name}`, []);
    await c.sendImage(await U.getBuffer(url), `🌸 ${name}`);
  }));
}

module.exports = list;
