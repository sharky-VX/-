const U = require('../lib/utils');
const media = require('../lib/media');
const db = require('../lib/db');
const config = require('../config');

const mk = (name, desc, usage, run, aliases = []) => ({ name, aliases, desc, usage, category: 'anime', run });
const tag = (j) => '@' + j.split('@')[0].split(':')[0];

// ── Reacciones animadas (nekos.best, gratis y sin key) ──
// [categoría, texto con otra persona, texto solo, alias]
const ACTIONS = [
  ['hug', 'abraza a', 'se abraza a sí mismo/a', ['abrazar', 'abrazo']], ['kiss', 'besa a', 'manda un beso', ['besar', 'beso']],
  ['pat', 'acaricia a', 'pide cariño', ['acariciar']], ['slap', 'abofetea a', 'se da una cachetada', ['bofetada', 'cachetada']],
  ['bite', 'muerde a', 'muerde el aire', ['morder', 'mordisco', 'nom']], ['cuddle', 'se acurruca con', 'quiere acurrucarse', []],
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
// Cache en memoria: mismo GIF no se convierte 2 veces
const gifCache = new Map(); // url -> Buffer mp4
const GIF_CACHE_MAX = 80;

async function sendAnimated(c, url, text, mentions) {
  const { sock, from, m } = c;
  const u = String(url || '');
  // Ya es mp4 → enviar directo (sin ffmpeg)
  if (/\.mp4(\?|$)/i.test(u)) {
    try {
      const buf = await U.getBuffer(u, { timeout: 20000 });
      return sock.sendMessage(from, { video: buf, caption: text, gifPlayback: true, mimetype: 'video/mp4', mentions }, { quoted: m });
    } catch (e) {
      console.error('anime mp4 direct:', e?.message || e);
    }
  }
  // Cache
  if (gifCache.has(u)) {
    return sock.sendMessage(from, { video: gifCache.get(u), caption: text, gifPlayback: true, mimetype: 'video/mp4', mentions }, { quoted: m });
  }
  const buf = await U.getBuffer(u, { timeout: 15000 });
  let mp4 = null, why = '';
  // 1) RAPIDO (ultrafast 480p) — lo que tarda 2 min en HD
  try { mp4 = await media.toMp4Fast(buf, 'gif'); }
  catch (e) {
    why = String(e?.message || e);
    console.error('Anime GIF fast:', why);
    try { mp4 = await media.toMp4(buf, 'gif'); } catch (e2) {
      why = String(e2?.message || e2);
      console.error('Anime GIF:', why);
    }
  }
  if (mp4) {
    if (gifCache.size >= GIF_CACHE_MAX) gifCache.delete(gifCache.keys().next().value);
    gifCache.set(u, mp4);
    return sock.sendMessage(from, { video: mp4, caption: text, gifPlayback: true, mimetype: 'video/mp4', mentions }, { quoted: m });
  }
  const noFf = /ffmpeg no est/i.test(why);
  try {
    return await sock.sendMessage(from, { image: buf, mimetype: 'image/gif', caption: text, mentions }, { quoted: m });
  } catch {
    return sock.sendMessage(from, { text: text + (noFf ? '\n\nFalta ffmpeg para animar.' : ''), mentions }, { quoted: m });
  }
}

const FACES = {
  hug: '(つ≧▽≦)つ', kiss: '( ˘ ³˘)♥', pat: '(｡・//ε//・｡)', slap: '(╬ Ò ‸ Ó)',
  bite: '(≧∀≦)', cuddle: '(⊃｡•́‿•̀｡)⊃', poke: '(・∀・)', punch: '(ง •̀_•́)ง',
  kick: '(ﾉ°Д°)ﾉ', tickle: '(*≧▽≦)', wave: '(＾▽＾)', highfive: '(๑>ᴗ<๑)',
  handhold: '(◕‿◕)♡', handshake: '(￣▽￣)', feed: '(っ˘ڡ˘ς)', peck: '(*^3^)/~☆',
  cry: '(Ｔ▽Ｔ)', dance: '♪┏(・o･)┛♪', laugh: '(≧∇≦)/', smile: '(◠‿◠)',
  blush: '(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)', happy: '(ﾉ´ヮ`)ﾉ*: ･ﾟ', sleep: '(∪｡∪)｡｡｡zzz',
  default: '(つ≧▽≦)つ',
};
const PHRASE = {
  hug: ['abrazo muy fuerte a', 'se abraza a si mismo'],
  kiss: ['beso con mucha pasion a', 'manda un beso al aire'],
  pat: ['acaricia la cabeza de', 'pide caricias'],
  slap: ['abofetea a', 'se da una cachetada'],
  bite: ['muerde a', 'muerde el aire'],
  cuddle: ['se acurruca con', 'quiere acurrucarse'],
  poke: ['molesta a', 'toca por tocar'],
  punch: ['golpea a', 'golpea el aire'],
  kick: ['patea a', 'patea una piedra'],
  tickle: ['hace cosquillas a', 'se rie de cosquillas'],
  wave: ['saluda a', 'saluda a todos'],
  highfive: ['choca los cinco con', 'choca los cinco al aire'],
  handhold: ['toma de la mano a', 'extiende la mano'],
  handshake: ['estrecha la mano de', 'estrecha una mano'],
  feed: ['da de comer a', 'come algo rico'],
  peck: ['da un piquito a', 'manda un piquito'],
  cry: ['llora por', 'llora'],
  dance: ['baila con', 'baila'],
  laugh: ['se rie de', 'se rie'],
  smile: ['le sonrie a', 'sonrie'],
  blush: ['se sonroja por', 'se sonroja'],
  happy: ['esta feliz con', 'esta feliz'],
  sleep: ['duerme con', 'se va a dormir'],
};

async function react(c, cat, withTarget, solo) {
  const target = c.mentioned[0] || c.quoted?.sender;
  const face = FACES[cat] || FACES.default;
  const ph = PHRASE[cat] || [withTarget, solo];
  const me = tag(c.sender);
  const text = target
    ? `${me} ${ph[0]} ${tag(target)}\n${face}`
    : `${me} ${ph[1] || solo}\n${face}`;
  const mentions = target ? [c.sender, target] : [c.sender];

  // APIs que SÍ funcionan (anime GIF reales)
  // 1) purrbot  2) otakugifs  3) nekos.life
  const purrMap = {
    hug: 'hug', kiss: 'kiss', pat: 'pat', slap: 'slap', cuddle: 'cuddle',
    dance: 'dance', poke: 'poke', tickle: 'tickle', bite: 'bite', blush: 'blush',
    cry: 'cry', smile: 'smile', lick: 'lick', neko: 'neko', feed: 'feed',
  };
  const otakuMap = {
    hug: 'hug', kiss: 'kiss', pat: 'pat', slap: 'slap', cuddle: 'cuddle',
    dance: 'dance', happy: 'happy', smile: 'happy', confused: 'confused',
    blush: 'blush', cry: 'cry', wink: 'happy', lick: 'kiss',
  };

  const sources = [];
  if (purrMap[cat]) {
    sources.push(async () => {
      const d = await U.getJson(`https://purrbot.site/api/img/sfw/${purrMap[cat]}/gif`);
      return d?.link || d?.url;
    });
  }
  if (otakuMap[cat]) {
    sources.push(async () => {
      const d = await U.getJson(`https://api.otakugifs.xyz/gif?reaction=${otakuMap[cat]}`);
      return d?.url;
    });
  }
  sources.push(async () => {
    const d = await U.getJson(`https://nekos.life/api/v2/img/${cat}`);
    return d?.url;
  });
  // fallback hug si la cat no existe en ninguna
  sources.push(async () => {
    const d = await U.getJson('https://purrbot.site/api/img/sfw/hug/gif');
    return d?.link;
  });

  let url = null, lastErr = '';
  for (const fn of sources) {
    try {
      const u = await fn();
      if (u && /^https?:\/\//i.test(u)) { url = u; break; }
    } catch (e) {
      lastErr = U.friendlyError(e);
      console.error('Anime API:', lastErr);
    }
  }
  if (!url) throw new Error(lastErr || 'No pude obtener un GIF de anime. Prueba de nuevo.');

  try {
    try { await c.react('⚡'); } catch {}
    return await sendAnimated(c, url, text, mentions);
  } catch (e) {
    console.error('Anime GIF convert:', e?.message || e);
  }
  try {
    const buf = await U.getBuffer(url, { timeout: 45000 });
    return await c.sock.sendMessage(c.from, { image: buf, caption: text, mentions }, { quoted: c.m });
  } catch {
    return c.sock.sendMessage(c.from, { text: text + '\n\n(No pude cargar el GIF)', mentions }, { quoted: c.m });
  }
}


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
