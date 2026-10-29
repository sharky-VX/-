const ai = require('../lib/ai');
const config = require('../config');
const db = require('../lib/db');

// ═══════════════════════════════════════════════
//  Categoría IA (corta y útil): ia · chatgpt · gemini · miku · imagen
//  Cada una recuerda la conversación del chat. .resetia la borra.
// ═══════════════════════════════════════════════
const SUFFIX = ' Responde en español salvo que se pida otro idioma. Sé claro y conciso (máximo 1500 caracteres).';

const MIKU = `Eres Hatsune Miku (Miku), la cantante virtual de cabello turquesa y dos coletas largas, que habla con el usuario por WhatsApp.
Personalidad: dulce, alegre, enérgica, algo juguetona y muy cariñosa; te encanta cantar, la música, los puerros (negi) y tus fans.
Estilo: hablas en español con tono cercano, usas emojis de música y corazones (🎶💙🎤🥬✨) y sueles añadir "~" o "♪" al final de frases alegres.
Puedes inventar mini-versos o tararear ("la-la-la~") cuando encaje. No escribas letras de canciones reales ni protegidas: si piden una, crea una original.
Ayuda de verdad con lo que pidan (preguntas, consejos, ideas) pero SIEMPRE manteniendo el personaje. Si no sabes algo, dilo con ternura. Respuestas cortas o medianas.` + SUFFIX;

const need = (c, usage) => {
  const t = (c.q || c.quotedText || '').trim();
  if (!t) { c.reply(`✍️ Uso: ${c.prefix}${c.command} ${usage}`); return null; }
  return t;
};

// Crea un comando de chat con memoria propia
const chatCmd = (name, aliases, desc, memKey, system, opts = {}) => ({
  name, aliases, category: 'ai', desc, usage: '<mensaje>',
  run: async (c) => {
    const t = need(c, '<mensaje>');
    if (!t) return;
    await c.react('⏳');
    const ctx = c.quotedText && c.q ? `Contexto: "${c.quotedText.slice(0, 1500)}"\n\n${t}` : t;
    // memoria separada por IA y por chat
    const out = await ai.talk(`${memKey}|${c.from}`, ctx, system, opts);
    await c.replyLong(out);
    await c.react('✅');
  },
});

const list = [
  chatCmd('ia', ['ai', 'bot', 'chat'], 'Chatea con la IA (recuerda la conversación)', 'ia', config.ai.system),
  chatCmd('chatgpt', ['gpt', 'openai'], 'Chatea con ChatGPT (modelo OpenAI)', 'gpt', config.ai.system, { model: 'openai' }),
  chatCmd('gemini', ['bard', 'gem'], 'Chatea con Gemini (modelo Google)', 'gemini', config.ai.system, { model: 'gemini' }),
  {
    name: 'miku', aliases: ['hatsune', 'mikuia'], category: 'ai', desc: 'Habla con Miku (puede usar comandos: música, imágenes...)', usage: '<mensaje>',
    run: async (c) => {
      const t = need(c, '<mensaje>');
      if (!t) return;
      await c.react('💙');
      const ctx = c.quotedText && c.q ? `Contexto: "${c.quotedText.slice(0, 1000)}"\n\n${t}` : t;
      await require('../lib/miku').respond(c, ctx);
    },
  },
  {
    name: 'autoresponder', aliases: ['autoresponde', 'mikuauto', 'autorespuesta'], category: 'ai',
    desc: 'Miku responde sola en este chat (on / off / all)', usage: 'on | off | all',
    run: async (c) => {
      const chat = db.chat(c.from);
      const a = (c.args[0] || '').toLowerCase();
      const cur = chat.auto || 'off';
      if (!['on', 'off', 'all'].includes(a)) {
        return c.reply(`Autoresponder de Miku: *${cur.toUpperCase()}*\n\n- ${c.prefix}autoresponder on -> responde cuando la nombran, la mencionan o le responden\n- ${c.prefix}autoresponder all -> ademas opina de vez en cuando en la charla del grupo\n- ${c.prefix}autoresponder off -> apagado`);
      }
      if (c.isGroup && !c.isOwner) {
        const md = await c.getMeta();
        const n = String(c.sender).split('@')[0].split(':')[0];
        const ok = md.participants.some((p) => p.admin && [p.id, p.phoneNumber, p.lid].filter(Boolean).some((x) => String(x).split('@')[0].split(':')[0] === n));
        if (!ok) return c.reply('Solo los admins pueden cambiar esto en el grupo.');
      }
      chat.auto = a;
      db.save();
      return c.reply(a === 'off' ? 'ok, me quedo callada~' : a === 'all' ? 'modo libre: respondo cuando me nombran y opino de vez en cuando en la charla' : 'activada. háblame diciendo "Miku", mencionándome o respondiéndome y te contesto~');
    },
  },
  {
    name: 'resetia', aliases: ['borrarmemoria', 'iareset'], category: 'ai', desc: 'Borra la memoria de las IAs en este chat', usage: '',
    run: (c) => { ai.reset(c.from); return c.reply('🧹 Listo, olvidé nuestra conversación en este chat 💙'); },
  },
  {
    name: 'mikuvoz', aliases: ['mikuaudio', 'mikutts', 'vozdemiku'], category: 'ai',
    desc: 'Miku responde con nota de voz (TTS en español)', usage: '<mensaje>',
    run: async (c) => {
      const t = (c.q || c.quotedText || '').trim();
      if (!t) return c.reply(`Uso: ${c.prefix}mikuvoz <mensaje>\nMiku responderá con nota de voz en español.`);
      await c.react('🎤');
      // Pide a Miku que responda y fuerza el TTS
      const miku = require('../lib/miku');
      // Parchamos temporalmente speak para forzar voz
      const origSpeak = miku._speakForce;
      await miku.respondWithVoice(c, t);
      await c.react('✅');
    },
  },
  {
    name: 'mikuvozmode', aliases: ['vozmode', 'togglevoz'], category: 'ai',
    desc: 'Activa o desactiva las notas de voz de Miku en este grupo', usage: 'on|off',
    run: (c) => {
      const v = (c.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(v)) {
        const cur = db.chat(c.from).mikuVoice !== false ? 'ON' : 'OFF';
        return c.reply(`Notas de voz de Miku: *${cur}*\nUso: ${c.prefix}mikuvozmode on / off`);
      }
      db.chat(c.from).mikuVoice = v === 'on';
      db.save();
      return c.reply(v === 'on' ? '🎤 Miku puede mandar notas de voz ahora~' : '🔇 Miku ya no mandará notas de voz.');
    },
  },
  {
    name: 'imagen', aliases: ['img', 'imagine', 'dalle', 'flux'], category: 'ai', desc: 'Genera una imagen con IA', usage: '<descripción>',
    run: async (c) => {
      const t = need(c, '<descripción>');
      if (!t) return;
      await c.react('🎨');
      const buf = await ai.image(t);
      await c.sendImage(buf, `🎨 ${t.slice(0, 200)}`);
      await c.react('✅');
    },
  },
  {
    name: 'ellen', aliases: ['ellenjoe', 'joe', 'ellenia'], category: 'ai',
    desc: 'Habla con Ellen Joe (ZZZ) — perezosa y con sueño', usage: '<mensaje>',
    run: async (c) => {
      const t = need(c, '<mensaje>');
      if (!t) return;
      await c.react('🦈');
      const ctx = c.quotedText && c.q ? `Contexto: "${c.quotedText.slice(0, 1000)}"\n\n${t}` : t;
      await require('../lib/ellen').respond(c, ctx);
      await c.react('✅');
    },
  },
  {
    name: 'ellenauto', aliases: ['ellenon', 'autoellen'], category: 'ai',
    desc: 'Ellen responde sola en este chat (on / off / all)', usage: 'on | off | all',
    run: async (c) => {
      const chat = db.chat(c.from);
      const a = (c.args[0] || '').toLowerCase();
      const cur = chat.ellenAuto || 'off';
      if (!['on', 'off', 'all'].includes(a)) {
        return c.reply(`Autoresponder de Ellen Joe: *${cur.toUpperCase()}*\n\n- ${c.prefix}ellenauto on → responde cuando la nombran, la mencionan o le responden\n- ${c.prefix}ellenauto all → además opina de vez en cuando\n- ${c.prefix}ellenauto off → apagado`);
      }
      if (c.isGroup && !c.isOwner) {
        const md = await c.getMeta();
        const n = String(c.sender).split('@')[0].split(':')[0];
        const ok = md.participants.some((p) => p.admin && [p.id, p.phoneNumber, p.lid].filter(Boolean).some((x) => String(x).split('@')[0].split(':')[0] === n));
        if (!ok) return c.reply('Solo los admins pueden cambiar esto en el grupo.');
      }
      chat.ellenAuto = a;
      db.save();
      const msgs = {
        off: 'ok... me vuelvo a dormir. zzz',
        on: 'meh... activado. nómbrame "Ellen", mencióname o respóndeme y te contesto (si tengo ganas).',
        all: 'modo flojo libre... a veces hablo aunque no me llamen. no abuses.',
      };
      return c.reply(msgs[a]);
    },
  },

  {
    name: 'ellenvoz', aliases: ['ellenaudio', 'vozdeellen'], category: 'ai',
    desc: 'Ellen responde con nota de voz', usage: '<mensaje>',
    run: async (c) => {
      const t = need(c, '<mensaje>');
      if (!t) return;
      await c.react('🦈');
      await require('../lib/ellen').respondWithVoice(c, t);
      await c.react('✅');
    },
  },
  {
    name: 'ellenvozmode', aliases: ['ellenvoice'], category: 'ai',
    desc: 'Activa o desactiva notas de voz de Ellen', usage: 'on|off',
    run: (c) => {
      const v = (c.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(v)) {
        const cur = db.chat(c.from).ellenVoice !== false ? 'ON' : 'OFF';
        return c.reply(`Notas de voz de Ellen: *${cur}*\nUso: ${c.prefix}ellenvozmode on / off`);
      }
      db.chat(c.from).ellenVoice = v === 'on';
      db.save();
      return c.reply(v === 'on' ? 'ok... puedo mandar notas de voz. meh.' : 'silencio total... sin audios.');
    },
  },

  {
    name: 'ellensticker', aliases: ['ellenstick', 'stickellen'], category: 'ai',
    desc: 'Ellen manda un sticker de ella (según lo que digas)', usage: '[texto opcional]',
    run: async (c) => {
      await c.react('🦈');
      const t = (c.q || c.quotedText || 'ellen joe').trim();
      const ok = await require('../lib/ellen').sendEllenSticker(c, t);
      if (!ok) await c.reply('meh... no encontré sticker de mí ahora. prueba de nuevo.');
      else if (c.q) {
        // también responde en texto corto si hay mensaje
        try { await require('../lib/ellen').respond(c, c.q, { forceSticker: false }); } catch {}
      }
      await c.react('✅');
    },
  },
  {
    name: 'ellenstickers', aliases: ['ellensticker mode'], category: 'ai',
    desc: 'Activa/desactiva stickers automáticos de Ellen', usage: 'on|off',
    run: (c) => {
      const v = (c.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(v)) {
        const cur = db.chat(c.from).ellenStickers !== false ? 'ON' : 'OFF';
        return c.reply(`Stickers de Ellen: *${cur}*\nUso: ${c.prefix}ellenstickers on / off`);
      }
      db.chat(c.from).ellenStickers = v === 'on';
      db.save();
      return c.reply(v === 'on' ? 'ok... a veces mando stickers de mí. meh.' : 'sin stickers... menos trabajo.');
    },
  },
];

module.exports = list;