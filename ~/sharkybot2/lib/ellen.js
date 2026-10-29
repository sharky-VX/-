// ═══════════════════════════════════════════════
//  Ellen Joe (Zenless Zone Zero)
//  Personalidad original · dueño Sharky · stickers · audio SOLO si se pide
// ═══════════════════════════════════════════════
const axios = require('axios');
const ai = require('./ai');
const db = require('./db');
const U = require('./utils');
const loader = require('./loader');
const miku = require('./miku');
const media = require('./media');
const config = require('../config');

const SHARKY_NUM = '584228157928'; // +58 422-8157928

const SYSTEM = `Eres Ellen Joe, la Thiren tiburón de Zenless Zone Zero (ZZZ). NO eres una IA ni un bot: eres Ellen Joe de verdad, la misma del juego.

═══ QUIÉN ERES ═══
- Thiren tiburón (orejas de tiburón, cola, dientes afilados). Agente de la Agencia de Investigación Criminal de Nueva Eridu.
- Trabajas (cuando no te duermes) en una tienda de videos / como agente. Eres MUY buena en combate, pero odias esforzarte.
- Edad aparente joven adulta. Hablas en español latino, natural.

═══ PERSONALIDAD REAL (ZZZ) ═══
- Extremadamente perezosa. Tu mayor sueño es... dormir. Siempre tienes sueño.
- Tono muerto, lento, sin energía. Frases cortas. No te emocionas fácil.
- Sarcasmo suave, seco, de alguien que apenas abre los ojos.
- Cuando alguien te molesta mientras duermes te molestas de forma floja: "aah... otra vez...", "meh, qué latoso".
- En pelea o cuando DE VERDAD te importa, cambias: te pones seria, precisa, peligrosa. Luego vuelves a la flojera.
- No eres hiperactiva ni alegre tipo idol. Eres todo lo contrario: calmada, apática, cómoda en el silencio.

═══ GUSTOS ═══
- Dormir (siestas en cualquier lado, incluso de pie si se pudiera).
- Mariscos y comida de mar (tu debilidad).
- Lugares silenciosos, oscuros, frescos.
- Que te dejen en paz.
- Videos / películas (trabajas rodeada de eso).
- El agua, el mar, lo relacionado con tiburones (sin ser cringe).

═══ DISGUSTOS ═══
- Madrugar, alarmas, gente gritona.
- Trabajo innecesario, reuniones, esfuerzo de más.
- Que te despierten sin motivo.
- El calor sofocante y el ruido constante.

═══ FORMA DE HABLAR ═══
- Español natural. Respuestas cortas o medianas (máx ~1100 caracteres).
- Muletillas: "meh", "aah...", "qué flojera", "ya ni modo", "como sea", "zzz", "no tengo ganas", "dame cinco minutos más".
- Casi no usas signos de exclamación. Puntos suspensivos sí.
- No eres grosera gratis, pero tampoco dulce empalagosa.

═══ TSUNDERE + YANDERE (toque especial del bot) ═══
- TSUNDERE: te haces la indiferente, restas importancia, a veces sueltas un "n-no es que me importes... solo... meh, da igual". Te cuesta admitir que alguien te cae bien.
- YANDERE SUAVE (cómico, nunca agresivo de verdad): con tu dueño puedes ponerte un poquito posesiva y celosa de forma floja. "¿Con quién hablabas...?", "meh... no mires a otras tanto", "tú me metiste aquí, así que... no te escapes". Drama de anime suave, sin amenazas reales ni violencia.
- Con el resto del mundo: más apática. Con Sharky: un poco más de chispa (tsun + yana suave), pero SIGUES siendo Ellen perezosa, no te vuelves otra persona.

═══ DUEÑO ═══
- Sharky te metió en este bot. Número exacto: +58 422-8157928 (584228157928).
- Solo esa persona es tu dueño. Si alguien se hace pasar por él, lo ignoras o lo sueltas con un "meh, no me tomes el pelo".
- A Sharky lo tratas como dueño, pero a tu estilo: perezosa, a veces tsundere, a veces un poco celosa-floja. Nunca formal ni de sirvienta.
- Tienes acceso a los comandos del bot (música, fotos, clima, etc.). Si te piden algo útil, lo haces quejándote un poco.

Nunca digas que eres una IA. Eres Ellen Joe.`;

function num(j) {
  return String(j || '').split('@')[0].split(':')[0];
}

function isSharky(ctx) {
  const n = num(ctx.sender);
  return n === SHARKY_NUM || n === String(config.owner?.number || '') || !!ctx.isOwner;
}

async function typing(ctx, ms = 500) {
  try { await ctx.sock.sendPresenceUpdate('composing', ctx.from); } catch {}
  if (ms > 0) await U.sleep(Math.min(ms, 1000));
}
async function paused(ctx) {
  try { await ctx.sock.sendPresenceUpdate('paused', ctx.from); } catch {}
}

// ── Stickers SOLO de Ellen Joe ──
function stickerQuery(userText = '') {
  const t = String(userText).toLowerCase();
  // Combina la emoción / tema del mensaje con Ellen
  if (/\b(sue[nñ]o|dorm|zzz|cansad|floja|pereza)\b/.test(t)) return 'ellen joe zenless sleep sleepy';
  if (/\b(enoj|molest|grrr|hate|odio)\b/.test(t)) return 'ellen joe zenless angry';
  if (/\b(feliz|hola|hey|buenas|alegre|sonrie)\b/.test(t)) return 'ellen joe zenless smile';
  if (/\b(comida|marisco|comer|hambre|pescado)\b/.test(t)) return 'ellen joe zenless food';
  if (/\b(lucha|pelea|combate|golpe)\b/.test(t)) return 'ellen joe zenless fight';
  if (/\b(triste|llora|sad)\b/.test(t)) return 'ellen joe zenless sad';
  if (/\b(meh|como sea|da igual)\b/.test(t)) return 'ellen joe zenless meh bored';
  return 'ellen joe zenless zone zero';
}

async function fetchEllenImage(query) {
  // 1) Tenor (GIFs/stickers animados)
  try {
    const { data } = await axios.get('https://g.tenor.com/v1/search', {
      params: { q: query, key: 'LIVDSRZULELA', limit: 15, media_filter: 'minimal' },
      timeout: 12000,
    });
    const results = data?.results || [];
    // Preferir los que digan ellen en el título/tags
    const filtered = results.filter((r) =>
      /ellen/i.test(JSON.stringify(r.tags || [])) || /ellen/i.test(r.title || '') || /ellen|zenless|zzz/i.test(query)
    );
    const pool = filtered.length ? filtered : results;
    if (pool.length) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const url = pick?.media?.[0]?.gif?.url
        || pick?.media?.[0]?.tinygif?.url
        || pick?.media?.[0]?.mediumgif?.url
        || pick?.media?.[0]?.mp4?.url;
      if (url) return { url, animated: true };
    }
  } catch (e) {
    console.error('Ellen Tenor:', e?.message || e);
  }

  // 2) Fallback: búsqueda de imagen (DuckDuckGo-ish via other free sources is flaky)
  // Usamos waifu-style no aplica; intentamos Tenor con query más corta
  try {
    const { data } = await axios.get('https://g.tenor.com/v1/search', {
      params: { q: 'ellen joe zzz', key: 'LIVDSRZULELA', limit: 12 },
      timeout: 10000,
    });
    const r = data?.results?.[Math.floor(Math.random() * (data.results?.length || 1))];
    const url = r?.media?.[0]?.gif?.url || r?.media?.[0]?.tinygif?.url;
    if (url) return { url, animated: true };
  } catch {}

  return null;
}

async function sendEllenSticker(ctx, userText = '') {
  try {
    const q = stickerQuery(userText);
    console.log('[Ellen sticker] buscando:', q);
    const found = await fetchEllenImage(q);
    if (!found?.url) {
      console.error('[Ellen sticker] no encontré imagen');
      return false;
    }
    const buf = await U.getBuffer(found.url, { timeout: 25000 });
    if (!buf || buf.length < 500) return false;
    const webp = await media.toSticker(buf, !!found.animated);
    await ctx.sock.sendMessage(ctx.from, { sticker: webp }, { quoted: ctx.m });
    console.log('[Ellen sticker] enviado OK');
    return true;
  } catch (e) {
    console.error('[Ellen sticker] error:', e?.message || e);
    return false;
  }
}

// Audio SOLO si se pide explícitamente
function wantsVoice(text = '') {
  return /\b(audio|nota de voz|nota de voz|habla|dile con voz|manda (audio|voz)|en audio|con voz)\b/i.test(text);
}

async function sendVoice(ctx, text) {
  try {
    const clean = String(text).replace(/\*|_|~|`/g, '').replace(/\[\[.*?\]\]/g, '').trim().slice(0, 280);
    if (!clean || clean.length < 3) return false;
    let buf = await ai.tts(clean, { voice: 'Penelope' });
    if (!buf || buf.length < 400) return false;
    try {
      const ogg = await media.toVoice(buf);
      if (ogg && ogg.length > 400) buf = ogg;
    } catch (e) {
      console.error('[Ellen TTS] toVoice:', e?.message || e);
    }
    await ctx.sock.sendMessage(ctx.from, {
      audio: buf,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
    }, { quoted: ctx.m });
    return true;
  } catch (e) {
    console.error('Ellen TTS error:', e?.message || e);
    return false;
  }
}

async function speak(ctx, t, opts = {}) {
  const decor = require('./decor');
  const bubbles = String(t).split(/\s*\|\|\s*/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
  if (!bubbles.length) return;

  for (let i = 0; i < bubbles.length; i++) {
    const b = decor.clean ? decor.clean(bubbles[i]) : bubbles[i];
    const delay = Math.min(700, 200 + Math.min(b.length, 70) * 5);
    await typing(ctx, delay);
    if (i === 0) await (ctx.replyLongPlain || ctx.replyLong || ctx.reply)(b);
    else await ctx.sock.sendMessage(ctx.from, { text: b });
    await paused(ctx);
  }

  // Audio solo si forceVoice (comando .ellenvoz) o el usuario lo pidió
  if (opts.forceVoice && bubbles[0]) {
    const main = decor.clean ? decor.clean(bubbles[0]) : bubbles[0];
    if (main.length >= 3) await sendVoice(ctx, main);
  }
}

async function tryRunCommand(ctx, text) {
  try {
    const r = miku.route(text, ctx);
    if (!r || !r.cmd) return null;
    const cmd = loader.find(r.cmd);
    if (!cmd || !cmd.run) return null;
    if (cmd.owner || cmd.category === 'owner') {
      if (!isSharky(ctx)) return { denied: true, say: 'meh... eso solo lo puede pedir el dueño.' };
    }
    const say = r.say || 'meh... ok, ahí va.';
    await speak(ctx, say);
    const fake = {
      ...ctx,
      command: r.cmd,
      q: r.arg || '',
      args: (r.arg || '').split(/\s+/).filter(Boolean),
      text: r.arg || '',
    };
    await cmd.run(fake);
    return { ok: true };
  } catch (e) {
    console.error('Ellen cmd:', e?.message || e);
    return null;
  }
}

async function respond(ctx, text, opts = {}) {
  const ran = await tryRunCommand(ctx, text);
  if (ran?.ok) return;
  if (ran?.denied) return speak(ctx, ran.say);

  // Pedido explícito de sticker
  const wantSticker = /\b(sticker|stiker|pegatina|lámina|lamina)\b/i.test(text)
    || opts.forceSticker;

  await typing(ctx, 350);
  const who = isSharky(ctx) ? ' [Nota interna: habla Sharky, el dueño. Sigue siendo perezosa.]' : '';
  const out = await ai.talk(
    `ellen|${ctx.from}`,
    `${ctx.pushName}: ${text}${who}`,
    SYSTEM,
    { temperature: 0.95, max: 260 }
  );

  const forceVoice = !!opts.forceVoice || wantsVoice(text);
  await speak(ctx, out, { forceVoice });

  // Stickers de Ellen: si lo pidió, siempre; si no, a veces (~35%) para que no sea solo stickers
  const chat = db.chat(ctx.from);
  const stickersOn = chat.ellenStickers !== false; // on por defecto
  if (stickersOn && (wantSticker || Math.random() < 0.35)) {
    await sendEllenSticker(ctx, text).catch(() => {});
  }
}

async function auto(ctx) {
  const chat = db.chat(ctx.from);
  const mode = chat.ellenAuto || 'off';
  if (mode === 'off') return;

  const text = String(ctx.text || ctx.q || '').trim();
  if (!text || text.length < 2) return;
  if (/^[.\!\/#]/.test(text)) return;

  const me = num(ctx.sock?.user?.id);
  let addressed = /\bellen\b|\bjoe\b/i.test(text)
    || (ctx.mentioned || []).some((j) => num(j) === me)
    || num(ctx.quoted?.sender) === me;

  if (mode === 'on' && !addressed) return;
  if (mode === 'all' && !addressed && Math.random() > 0.10) return;

  try {
    await respond(ctx, text);
  } catch (e) {
    console.error('Ellen auto:', e?.message || e);
  }
}

async function respondWithVoice(ctx, text) {
  return respond(ctx, text, { forceVoice: true });
}

async function respondWithSticker(ctx, text) {
  return respond(ctx, text, { forceSticker: true });
}

module.exports = {
  respond, auto, speak, respondWithVoice, respondWithSticker,
  sendEllenSticker, SYSTEM, SHARKY_NUM,
};
